/**
 * @file
 * Load and persist the help sync's "last synced" baseline: a map of `<resourceSlug>:<localeCode>` to
 * the Transifex last-translation-update timestamp we most recently pushed to Freshdesk. Comparing a
 * pair's current Transifex stat against this baseline is how the sync decides whether that pair needs
 * re-pushing, so only changed pairs incur Freshdesk writes.
 *
 * The file location is overridable via `HELP_SYNC_BASELINE_FILE` so the persistence mechanism (a
 * committed repo file vs. a restored CI cache) can change without touching this code.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { messageOf } from './errors.mts'

/** A map of `<resourceSlug>:<localeCode>` to the last-synced timestamp (or null if never translated). */
export type SyncBaseline = Map<string, string | null>

/** Default on-disk location of the baseline manifest, relative to the repository root. */
export const DEFAULT_BASELINE_PATH = 'scripts/help-sync-baseline.json'

const baselinePath = (path?: string): string => path ?? process.env.HELP_SYNC_BASELINE_FILE ?? DEFAULT_BASELINE_PATH

/**
 * Load the baseline from disk. A missing baseline means "sync everything" — the safe default — so an
 * absent or unreadable file resolves to an empty map rather than an error.
 * @param path - override for the baseline file location; defaults to `HELP_SYNC_BASELINE_FILE` or {@link DEFAULT_BASELINE_PATH}
 * @returns the persisted baseline, or an empty map if none exists yet
 */
export const loadBaseline = (path?: string): SyncBaseline => {
  const file = baselinePath(path)
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string | null>
    return new Map(Object.entries(parsed))
  } catch (error) {
    // A corrupt or unreadable file must not wedge the run: log (unless it is simply absent) and start
    // fresh, which just means a one-time full sync that repopulates the baseline.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`Could not read help-sync baseline "${file}"; treating as empty: ${messageOf(error)}`)
    }
    return new Map()
  }
}

/**
 * Persist the baseline to disk, sorted by key for a stable, diff-friendly file.
 * @param baseline - the baseline to write
 * @param path - override for the baseline file location; defaults to `HELP_SYNC_BASELINE_FILE` or {@link DEFAULT_BASELINE_PATH}
 */
export const saveBaseline = (baseline: SyncBaseline, path?: string): void => {
  const file = baselinePath(path)
  mkdirSync(dirname(file), { recursive: true })
  const sorted: Record<string, string | null> = {}
  for (const key of [...baseline.keys()].sort()) {
    sorted[key] = baseline.get(key) ?? null
  }
  writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n')
}
