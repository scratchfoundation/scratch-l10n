/**
 * @file
 * Helper functions for syncing Freshdesk knowledge base articles with Transifex
 */
import { promises as fsPromises } from 'fs'
import { mkdirp } from 'mkdirp'
import { emitAnnotation } from './annotations.mts'
import { describeJsonParseError, messageOf } from './errors.mts'
import FreshdeskApi, {
  FreshdeskArticleCreate,
  FreshdeskArticleStatus,
  FreshdeskFolder,
  logAuthenticatedAgent,
} from './freshdesk-api.mts'
import { loadBaseline, saveBaseline, SyncBaseline } from './sync-baseline.mts'
import { TransifexStringKeyValueJson, TransifexStringsKeyValueJson, TransifexStrings } from './transifex-formats.mts'
import { TransifexResourceObject } from './transifex-objects.mts'
import {
  txPull,
  txResourcesObjects,
  txAvailableLanguages,
  txResourceLanguageStats,
  transifexEditorLink,
  txPullErrorCause,
  SOURCE_LOCALE,
} from './transifex.mts'
import { emitWarning } from './warnings.mts'

const FD = new FreshdeskApi('https://mitscratch.freshdesk.com', process.env.FRESHDESK_TOKEN ?? '')
const TX_PROJECT = 'scratch-help'

// Collect per-item failures instead of aborting on the first one, so one bad translation or a single
// item the token cannot write still lets every other item sync. Freshdesk rate limiting is handled
// transparently by the client (paced requests, `Retry-After`-aware retries), so anything that reaches
// here is a genuine problem worth a human's attention. `reportFailures` prints a consolidated summary
// and fails the run at the end, so real errors are surfaced rather than lost in the log.
const failures: { context: string; message: string; link?: string }[] = []
const recordFailure = (context: string, error: unknown, link?: string): void => {
  const message = messageOf(error)
  // A txPull error carries the failing (resource, locale) — and, for a parse failure, the raw text —
  // on its `cause`, so we can build a Transifex link and describe malformed JSON without the call site
  // passing anything. An explicit link still wins: some callers know the fix lives on the source (`en`)
  // rather than the translation locale the pull used.
  const cause = txPullErrorCause(error)
  const resolvedLink =
    link ??
    (cause
      ? transifexEditorLink({ project: cause.project, resource: cause.resource, lang: cause.locale })
      : undefined)
  const detail = cause?.buffer != null ? describeJsonParseError(error, cause.buffer) : undefined
  const fullMessage = detail ? `${message} — ${detail}` : message
  // Genuine failures go to stderr (like the consolidated summary), so they stand apart from normal output.
  process.stderr.write(`Error: ${context}: ${fullMessage}${resolvedLink ? ` (${resolvedLink})` : ''}\n`)
  failures.push({ context, message: fullMessage, link: resolvedLink })
  // Surface it on the run page too (no-op off CI). The full list still lives in stderr and the summary.
  emitAnnotation({
    level: 'error',
    title: context,
    message: resolvedLink ? `${fullMessage}\n${resolvedLink}` : fullMessage,
  })
}

/**
 * Print a summary of everything that failed during the sync and mark the process as failed if there
 * was anything. Call once, after all saves have completed.
 */
export const reportFailures = (): void => {
  if (failures.length === 0) {
    return
  }
  console.error(`\n${failures.length} item(s) failed to sync to Freshdesk:`)
  for (const failure of failures) {
    console.error(`  - ${failure.context}: ${failure.message}${failure.link ? ` (${failure.link})` : ''}`)
  }
  process.exitCode = 1
}

// --- Change detection -------------------------------------------------------
// The sync used to push every translation for every locale on every run (~10k+ Freshdesk writes),
// which is what tripped the rate limit. We now pull per-(resource, locale) stats from Transifex once
// and skip any pair whose translations have not changed since the last successful sync, so a normal
// day writes only what actually moved. `DRY_RUN` does everything except issue the Freshdesk writes,
// for validating the gate without mutating the knowledge base.

/** When set (to a non-empty value other than "0"/"false"), do everything except issue Freshdesk writes. */
const DRY_RUN = !!process.env.DRY_RUN && process.env.DRY_RUN !== '0' && process.env.DRY_RUN.toLowerCase() !== 'false'

/**
 * Wall-clock budget for a single run, in minutes (override with `HELP_SYNC_MAX_MINUTES`). When it is
 * exceeded the sync stops starting new writes, persists the baseline for everything that finished, and
 * exits cleanly. Durability across a cancellation is already handled by the incremental baseline flush
 * plus the workflow's save-on-cancel step, so this budget is the graceful path, not the safety net:
 * exiting cleanly under the step's hard `timeout-minutes` lets the run print its failure summary, exit
 * non-zero on genuine errors, and finish as a success rather than a cancellation -- so real problems
 * surface (and alert) while the baseline is still converging instead of being masked by a timeout.
 */
const RUN_TIME_BUDGET_MS = (() => {
  const minutes = Number(process.env.HELP_SYNC_MAX_MINUTES)
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 24) * 60_000
})()
/**
 * When this run began, used to enforce {@link RUN_TIME_BUDGET_MS}. Each sync phase (`pull:help:names`,
 * `pull:help:articles`) runs as its own job step with its own step-level `timeout-minutes`, so this
 * per-process clock starts alongside that step's timeout: the soft budget sits just under it, stopping
 * new writes and exiting cleanly (reporting failures) before the step is hard-killed.
 */
const runStartedAt = Date.now()
/** Count of changed, supported pairs left unattempted because the run hit its time budget. */
let deferredForBudget = 0

/**
 * Whether the run has used up its wall-clock budget and should stop starting new writes. Only active
 * once change detection is initialized, so the locale-debug script (which force-pulls) is unaffected.
 * @returns true if no further writes should be started this run
 */
const runBudgetExhausted = (): boolean => changeDetectionReady && Date.now() - runStartedAt >= RUN_TIME_BUDGET_MS

/** Whether {@link initChangeDetection} has run; until it has, the gate is disabled (sync everything). */
let changeDetectionReady = false
/** Transifex last-update timestamp per `<resourceSlug>:<localeCode>`, loaded once per run. */
let currentStats = new Map<string, string | null>()
/** The baseline recorded by the previous successful sync, loaded once per run. */
let baseline: SyncBaseline = new Map()
/** Pairs synced this run (or, in a dry run, that would sync), folded into the baseline at the end. */
const syncedPairs: SyncBaseline = new Map()
/** Count of Freshdesk writes skipped in a dry run, reported at the end. */
let plannedWrites = 0

/** Whether the Freshdesk supported-language filter is active (helpdesk settings loaded successfully). */
let localeFilterActive = false
/** Freshdesk supported language codes (lowercased) the knowledge base can hold translations for. */
const supportedFreshdeskLocales = new Set<string>()
/** Freshdesk primary language (lowercased); its content lives on the base resource, not a translation. */
let primaryLanguage = ''

/**
 * Load the Transifex per-(resource, locale) stats, the previous baseline, and the Freshdesk helpdesk
 * settings (which languages the KB can hold translations for). Call once before syncing.
 * @returns a promise that resolves once change-detection state is loaded
 */
export const initChangeDetection = async (): Promise<void> => {
  currentStats = await txResourceLanguageStats(TX_PROJECT)
  baseline = loadBaseline()
  try {
    const settings = await FD.getHelpdeskSettings()
    primaryLanguage = (settings.primary_language ?? '').toLowerCase()
    for (const code of settings.supported_languages ?? []) {
      supportedFreshdeskLocales.add(code.toLowerCase())
    }
    localeFilterActive = supportedFreshdeskLocales.size > 0
  } catch (error) {
    // If the settings can't be read, don't gate on language: attempt every locale and let the
    // create path warn about any Freshdesk won't accept.
    console.warn(`Could not read Freshdesk helpdesk settings; not filtering locales: ${messageOf(error)}`)
  }
  changeDetectionReady = true
}

/**
 * Whether Freshdesk can hold a translation for a Transifex locale: it must map to a configured
 * supported language and not be the primary language (whose content lives on the base resource).
 * @param locale - the Transifex locale code
 * @returns true if the locale should be pushed to Freshdesk
 */
const localeSupported = (locale: string): boolean => {
  // Until the filter is active (settings not loaded, or the locale-debug script), don't gate.
  if (!localeFilterActive) {
    return true
  }
  const fd = freshdeskLocale(locale).toLowerCase()
  return fd !== primaryLanguage && supportedFreshdeskLocales.has(fd)
}

/**
 * Emit a single warning naming the locales Freshdesk is not configured to hold translations for, so
 * someone reading the logs can decide whether to enable any of them in Freshdesk.
 * @param languages - the Transifex locales the sync would otherwise push
 */
export const reportSkippedLocales = (languages: string[]): void => {
  if (!localeFilterActive) {
    return
  }
  // Report the Freshdesk language codes (deduplicated: several Transifex locales can map to one),
  // because those are what an operator enables in Freshdesk -- not the raw Transifex locale codes.
  const skipped = [...new Set(languages.filter(l => l !== 'en' && !localeSupported(l)).map(freshdeskLocale))].sort()
  if (skipped.length > 0) {
    emitWarning(
      `Skipping ${skipped.length} Freshdesk language(s) not enabled for the knowledge base; their ` +
        `translations cannot sync until they are added under Admin > Helpdesk Settings: ${skipped.join(', ')}.`,
    )
  }
}

/**
 * Whether a (resource, locale) pair has translations worth pushing: it must have translated content
 * and a newer last-update timestamp than the baseline recorded.
 * @param resource - the Transifex resource slug
 * @param locale - the Transifex locale code
 * @returns true if the pair changed since the last successful sync
 */
const pairChanged = (resource: string, locale: string): boolean => {
  // When change detection hasn't been initialized (for example the locale-debug script, which
  // deliberately force-pulls), don't gate — behave as before and sync everything requested.
  if (!changeDetectionReady) {
    return true
  }
  const current = currentStats.get(`${resource}:${locale}`)
  // No stats for the pair, or nothing translated yet -> nothing to push.
  if (!current) {
    return false
  }
  return baseline.get(`${resource}:${locale}`) !== current
}

/**
 * Record that a (resource, locale) pair synced successfully, so its baseline entry advances to the
 * current Transifex timestamp when the run finishes.
 * @param resource - the Transifex resource slug
 * @param locale - the Transifex locale code
 */
const markSynced = (resource: string, locale: string): void => {
  const current = currentStats.get(`${resource}:${locale}`)
  if (current) {
    syncedPairs.set(`${resource}:${locale}`, current)
  }
}

/** Minimum interval between incremental baseline flushes, to bound both progress loss and write churn. */
const BASELINE_FLUSH_INTERVAL_MS = 15_000
/** When the baseline was last flushed to disk, used to debounce {@link maybeFlushBaseline}. */
let lastBaselineFlushAt = 0

/**
 * Merge the pairs synced so far into the baseline and persist it to disk. A no-op in a dry run (which
 * must never mutate the baseline) and before change detection is initialized: a script that calls
 * saveItem without initChangeDetection (the locale-debug pull) leaves baseline/currentStats empty, and
 * persisting then would clobber the real baseline with an empty file, forcing the next sync to re-sync
 * everything. Safe to call from concurrently-running saveItem tasks: JS is single-threaded and
 * {@link saveBaseline} writes atomically, so calls cannot interleave a partial file.
 */
const flushBaseline = (): void => {
  if (DRY_RUN || !changeDetectionReady) {
    return
  }
  for (const [key, timestamp] of syncedPairs) {
    baseline.set(key, timestamp)
  }
  saveBaseline(baseline)
  lastBaselineFlushAt = Date.now()
}

/**
 * Persist the baseline if enough time has passed since the last flush. Called as the sync makes
 * progress so a run cancelled mid-sync (for example by its phase step's timeout) still keeps what it
 * finished on disk, letting the workflow's save-on-cancel step cache it and the next run continue
 * instead of restarting a full sync. The graceful path still calls {@link flushBaseline} once more at
 * the end via {@link finalizeSync}.
 */
const maybeFlushBaseline = (): void => {
  // Nothing to persist in a dry run or before change detection is initialized, so skip the debounce
  // entirely rather than calling flushBaseline (a no-op there) on every batch. flushBaseline keeps the
  // same guards for the finalizeSync path.
  if (DRY_RUN || !changeDetectionReady) {
    return
  }
  if (Date.now() - lastBaselineFlushAt >= BASELINE_FLUSH_INTERVAL_MS) {
    flushBaseline()
  }
}

/**
 * Finish the run: persist the advanced baseline (unless this is a dry run) and print the failure
 * summary. Call once, after all saves have completed.
 */
export const finalizeSync = (): void => {
  if (DRY_RUN) {
    console.log(
      `[dry-run] ${syncedPairs.size} (resource, locale) pair(s) changed and would sync, for ` +
        `${plannedWrites} Freshdesk write(s). No writes were issued and the baseline was left unchanged.`,
    )
  } else {
    flushBaseline()
    console.log(`Synced ${syncedPairs.size} (resource, locale) pair(s); baseline now holds ${baseline.size} entries.`)
  }
  if (deferredForBudget > 0) {
    // Informational, not a warning: during a first-time full sync this is expected every run until the
    // backlog clears, and routing it through emitWarning would alert on every one of those runs.
    console.log(
      `Reached the ${RUN_TIME_BUDGET_MS / 60_000}-minute run budget with ${deferredForBudget} changed ` +
        `pair(s) not yet synced; they will sync on subsequent runs as the baseline converges.`,
    )
  }
  reportFailures()
}

/**
 * Log which agent the configured Freshdesk token authenticates as, to aid in diagnosing permission
 * problems. Never throws.
 * @returns a promise that resolves once the agent has been logged
 */
export const logFreshdeskAgent = (): Promise<void> => logAuthenticatedAgent(FD)

const freshdeskLocale = (locale: string): string => {
  // map between Transifex locale and Freshdesk. Two letter codes are usually fine
  const localeMap: Record<string, string> = {
    es_419: 'es-LA',
    ja: 'ja-JP',
    'ja-Hira': 'ja-JP',
    lv: 'lv-LV',
    nb: 'nb-NO',
    nn: 'nb-NO',
    pt: 'pt-PT',
    pt_BR: 'pt-BR',
    ru: 'ru-RU',
    sv: 'sv-SE',
    zh_CN: 'zh-CN',
    zh_TW: 'zh-TW',
  }
  return localeMap[locale] || locale
}

/**
 * Parse a string into an integer.
 * If converting the integer back to a string does not result in the same string, throw.
 * @param str - The (allegedly) numeric string to parse
 * @param radix - Interpret the string as a number in this base. For example, use 10 for decimal values.
 * @returns The numeric value of the string
 */
const parseIntOrThrow = (str: string, radix: number) => {
  const num = parseInt(str, radix)
  if (str != num.toString(radix)) {
    throw new Error(`Could not parse int safely: ${str}`)
  }
  return num
}

/**
 * Pull metadata from Transifex for the scratch-help project
 * @returns Promise for a results object containing:
 * languages - array of supported languages
 * folders - array of tx resources corresponding to Freshdesk folders
 * names - array of tx resources corresponding to the Freshdesk metadata
 */
export const getInputs = async () => {
  const resourcesPromise = txResourcesObjects(TX_PROJECT)
  const languagesPromise = txAvailableLanguages(TX_PROJECT)

  // there are three types of resources differentiated by the file type
  const foldersPromise = resourcesPromise.then(resources =>
    resources.filter(resource => resource.attributes.i18n_type === 'STRUCTURED_JSON'),
  )
  const namesPromise = resourcesPromise.then(resources =>
    resources.filter(resource => resource.attributes.i18n_type === 'KEYVALUEJSON'),
  )
  // ignore the yaml type because it's not possible to update via API

  const [languages, folders, names] = await Promise.all([languagesPromise, foldersPromise, namesPromise])

  return {
    languages,
    folders,
    names,
  }
}

/**
 * Fetch the current set of valid category and folder IDs from Freshdesk.
 * Used to detect stale entries in Transifex that refer to deleted Freshdesk items.
 * @returns Promise for an object containing:
 * validCategoryIds - set of Freshdesk category IDs that currently exist
 * validFolderIds - set of Freshdesk folder IDs that currently exist
 */
export const getValidFreshdeskIds = async () => {
  const categories = await FD.listCategories()
  const categoriesWithId = categories.filter((c): c is typeof c & { id: number } => c.id !== undefined)
  const validCategoryIds = new Set(categoriesWithId.map(c => c.id))
  const fdFolders: FreshdeskFolder[] = []
  for (const category of categoriesWithId) {
    const folders = await FD.listFolders(category)
    fdFolders.push(...folders)
  }
  const validFolderIds = new Set(fdFolders.map(f => f.id).filter((id): id is number => id !== undefined))
  return { validCategoryIds, validFolderIds }
}

/**
 * internal function to serialize saving category and folder name translations to avoid Freshdesk rate limit
 * @param strings - the string data pulled from Transifex
 * @param resource - the `attributes` property of the resource object which contains these strings
 * @param locale - the Transifex locale code corresponding to these strings
 * @param validIds - set of Freshdesk IDs that currently exist; keys not in this set are skipped
 * @param warnedKeys - tracks which stale resource+ID combinations have already been reported, to avoid repeating the warning
 * @returns true if every entry saved without a failure (stale-key skips do not count as failures)
 */
const serializeNameSave = async (
  strings: TransifexStringsKeyValueJson,
  resource: TransifexResourceObject,
  locale: string,
  validIds: Set<number>,
  warnedKeys: Set<string>,
): Promise<boolean> => {
  let allOk = true
  for (const [key, value] of Object.entries(strings)) {
    // Handle each entry independently: a failure on one item (for example a translation the token
    // is not allowed to write) must not abort the remaining names for this locale.
    try {
      // key is of the form <name>_<id>
      const words = key.split('_')
      const id = parseIntOrThrow(words[words.length - 1], 10)
      if (!validIds.has(id)) {
        const warnedKey = `${resource.attributes.name}:${id}`
        if (!warnedKeys.has(warnedKey)) {
          warnedKeys.add(warnedKey)
          emitWarning(
            `Warning: key "${key}" in Transifex resource "${resource.attributes.name}" refers to Freshdesk id ${id} which no longer exists. Remove this key from the Transifex resource.`,
            // The key is removed from the source, so point at the source language, not a translation.
            transifexEditorLink({ project: TX_PROJECT, resource: resource.attributes.slug, lang: SOURCE_LOCALE }),
          )
        }
        continue
      }
      // Guard against silently dropping an unexpected resource: this function only knows how to write
      // category and folder names. A new KEYVALUEJSON names resource would otherwise no-op while
      // still reporting success.
      if (resource.attributes.name !== 'categoryNames_json' && resource.attributes.name !== 'folderNames_json') {
        throw new Error(`Unexpected names resource "${resource.attributes.name}"; don't know how to save it`)
      }
      if (DRY_RUN) {
        plannedWrites++
      } else if (resource.attributes.name === 'categoryNames_json') {
        // A skipped write (Freshdesk reports it already exists) must not advance the baseline.
        if (!(await FD.updateCategoryTranslation(id, freshdeskLocale(locale), { name: value }))) {
          allOk = false
        }
      } else if (!(await FD.updateFolderTranslation(id, freshdeskLocale(locale), { name: value }))) {
        allOk = false
      }
    } catch (error) {
      // Record the failure so the job still reports a non-zero exit at the end, then move on to the
      // next entry.
      recordFailure(
        `${resource.attributes.name} entry "${key}" for ${locale}`,
        error,
        transifexEditorLink({ project: TX_PROJECT, resource: resource.attributes.slug, lang: locale }),
      )
      allOk = false
    }
  }
  return allOk
}

/**
 * We use this specific structure in the `STRUCTUREDJSON` resources associated with our Freshdesk folders.
 * This should be compatible with (and stricter than) `TransifexStringStructuredJson`.
 */
interface FreshdeskFolderInTransifex {
  title: { string: string }
  description: { string: string }
  tags: { string: string }
}

/**
 * Internal function serialize Freshdesk requests to avoid getting rate limited
 * @param  json   object with keys corresponding to article ids
 * @param  locale language code
 * @param  resourceSlug Transifex resource slug for these articles, used to build editor links in warnings and failures
 * @returns true if every article saved without a failure
 */
const serializeFolderSave = async (
  json: TransifexStrings<FreshdeskFolderInTransifex>,
  locale: string,
  resourceSlug: string,
): Promise<boolean> => {
  let allOk = true
  for (const [idString, value] of Object.entries(json)) {
    // Handle each article independently: a failure on one must not abort the rest for this locale.
    try {
      const id = parseIntOrThrow(idString, 10)
      const body: FreshdeskArticleCreate = {
        title: value.title.string,
        description: value.description.string,
        status: FreshdeskArticleStatus.published,
      }
      if (Object.prototype.hasOwnProperty.call(value, 'tags')) {
        const tags = value.tags.string.split(',')
        // Freshdesk rejects tags longer than 32 characters, so drop them rather than fail the write.
        const validTags = tags.filter(tag => tag.length < 33)
        const droppedTags = tags.filter(tag => tag.length >= 33)
        if (droppedTags.length > 0) {
          emitWarning(
            `Dropping ${droppedTags.length} tag(s) over Freshdesk's 32-character limit for article ${id} ` +
              `(${locale}); shorten them in Transifex: ${droppedTags
                .map(tag => `"${tag}" (${tag.length} chars)`)
                .join(', ')}.`,
            transifexEditorLink({ project: TX_PROJECT, resource: resourceSlug, lang: locale }),
          )
        }
        body.tags = validTags
      }
      if (DRY_RUN) {
        plannedWrites++
      } else if (!(await FD.updateArticleTranslation(id, freshdeskLocale(locale), body))) {
        // A skipped write (Freshdesk reports it already exists) must not advance the baseline.
        allOk = false
      }
    } catch (error) {
      // Record the failure so the job still reports a non-zero exit at the end, then move on to the
      // next article.
      recordFailure(
        `article ${idString} for ${locale}`,
        error,
        transifexEditorLink({ project: TX_PROJECT, resource: resourceSlug, lang: locale }),
      )
      allOk = false
    }
  }
  return allOk
}

/**
 * Process Transifex resource corresponding to a Knowledge base folder on Freshdesk
 * @param  folderAttributes Transifex resource json corresponding to a KB folder
 * @param  locale locale to pull and submit to Freshdesk
 * @returns true if the folder's articles for this locale all saved without a failure
 */
export const localizeFolder = async (folderAttributes: TransifexResourceObject, locale: string): Promise<boolean> => {
  try {
    const data = await txPull<FreshdeskFolderInTransifex>(
      TX_PROJECT,
      folderAttributes.attributes.slug,
      locale,
      'default',
    )
    return await serializeFolderSave(data, locale, folderAttributes.attributes.slug)
  } catch (e) {
    recordFailure(`${folderAttributes.attributes.slug} for ${locale}`, e)
    return false
  }
}

/**
 * Save Transifex resource corresponding to a Knowledge base folder locally for debugging
 * @param  folderAttributes Transifex resource json corresponding to a KB folder
 * @param  locale locale to pull and save
 * @returns true if the resource was pulled and written to the debug file
 */
export const debugFolder = async (folderAttributes: TransifexResourceObject, locale: string): Promise<boolean> => {
  await mkdirp('tmpDebug')
  try {
    const data = await txPull(TX_PROJECT, folderAttributes.attributes.slug, locale, 'default')
    await fsPromises.writeFile(
      `tmpDebug/${folderAttributes.attributes.slug}_${locale}.json`,
      JSON.stringify(data, null, 2),
    )
    return true
  } catch (e) {
    process.stdout.write(`Error processing ${folderAttributes.attributes.slug}, ${locale}: ${messageOf(e)}\n`)
    process.exitCode = 1 // not ok
    return false
  }
}

/**
 * Process KEYVALUEJSON resources from scratch-help on transifex
 * Category and Folder names are stored as plain json
 * @param resource Transifex resource json for either CategoryNames or FolderNames
 * @param locale   locale to pull and submit to Freshdesk
 * @param validCategoryIds - set of Freshdesk category IDs that currently exist
 * @param validFolderIds - set of Freshdesk folder IDs that currently exist
 * @param warnedKeys - tracks which stale resource+ID combinations have already been reported, to avoid repeating the warning
 * @returns true if the names for this locale all saved without a failure
 */
export const localizeNames = async (
  resource: TransifexResourceObject,
  locale: string,
  validCategoryIds: Set<number>,
  validFolderIds: Set<number>,
  warnedKeys: Set<string>,
): Promise<boolean> => {
  const validIds = resource.attributes.name === 'categoryNames_json' ? validCategoryIds : validFolderIds
  try {
    const data = await txPull<TransifexStringKeyValueJson>(TX_PROJECT, resource.attributes.slug, locale, 'default')
    return await serializeNameSave(data, resource, locale, validIds, warnedKeys)
  } catch (e) {
    recordFailure(`${resource.attributes.slug} for ${locale}`, e)
    return false
  }
}

const BATCH_SIZE = 2

type SaveFn = (item: TransifexResourceObject, language: string) => Promise<boolean>

/**
 * Save a resource's translations in batches (to reduce rate-limit pressure), skipping any locale that
 * has not changed since the last successful sync. A locale is recorded as synced only after its save
 * reports success, so a partial or failed run re-syncs that pair next time instead of silently
 * skipping it.
 * @param item - Transifex resource object, used for its slug
 * @param languages - array of locales to consider saving
 * @param saveFn - async function that saves the item for one locale and returns whether it fully succeeded
 * @returns a promise that resolves once every changed locale has been attempted
 */
export const saveItem = async (item: TransifexResourceObject, languages: string[], saveFn: SaveFn): Promise<void> => {
  const slug = item.attributes.slug
  // Exclude English (the source), locales Freshdesk can't hold, and pairs that haven't changed.
  const saveLanguages = languages.filter(l => l !== 'en' && localeSupported(l) && pairChanged(slug, l))
  for (let i = 0; i < saveLanguages.length; i += BATCH_SIZE) {
    // Out of time: leave the rest of this resource's locales for a later run. They stay unmarked, so
    // the next run still sees them as changed and picks them up.
    if (runBudgetExhausted()) {
      deferredForBudget += saveLanguages.length - i
      break
    }
    await Promise.all(
      saveLanguages.slice(i, i + BATCH_SIZE).map(async l => {
        try {
          if (await saveFn(item, l)) {
            markSynced(slug, l)
          }
        } catch (err) {
          recordFailure(
            `saving ${slug} for ${l}`,
            err,
            transifexEditorLink({ project: TX_PROJECT, resource: slug, lang: l }),
          )
        }
      }),
    )
    // Persist progress periodically so a run cancelled mid-sync keeps what it finished (see
    // maybeFlushBaseline); the interval debounce keeps this from writing on every batch.
    maybeFlushBaseline()
  }
}
