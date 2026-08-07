/**
 * @file
 * Emit GitHub Actions workflow annotations for problems found during a run, so they surface at the
 * top of the run page (and inline in the log) instead of only in the raw output. A no-op outside
 * GitHub Actions, so local runs stay quiet.
 */

/** True when running inside a GitHub Actions runner, where `::error::`/`::warning::` are meaningful. */
const IN_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === 'true'

/**
 * GitHub surfaces only about the first ten annotations of each level per step in the run UI. A
 * first-time full sync can fail on many items; emitting hundreds would be truncated there anyway and
 * just spams the log, so cap what we emit and note once when the cap is reached. The full, unbounded
 * list still goes to stderr and the failure summary.
 */
const MAX_ANNOTATIONS_PER_LEVEL = 10

type AnnotationLevel = 'error' | 'warning' | 'notice'

const emittedByLevel: Record<AnnotationLevel, number> = { error: 0, warning: 0, notice: 0 }

// In a workflow command's message, only `%`, CR and LF are special and must be encoded. The order
// matters: encode `%` first so the escapes we add are not themselves re-encoded.
const escapeData = (value: string): string => value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')

// A property value (such as `title`) additionally encodes `:` and `,`.
const escapeProperty = (value: string): string => escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C')

/**
 * Emit a single GitHub Actions annotation. No-op outside Actions and after the per-level display cap
 * is reached (the full list still reaches stderr and the failure summary).
 * @param annotation - the annotation to emit
 * @param annotation.level - annotation severity (`error`, `warning`, or `notice`)
 * @param annotation.message - the annotation body; may contain newlines and a URL
 * @param annotation.title - optional short bold header (for example, the failing item)
 */
export const emitAnnotation = (annotation: { level: AnnotationLevel; message: string; title?: string }): void => {
  const { level, message, title } = annotation
  if (!IN_GITHUB_ACTIONS) {
    return
  }
  emittedByLevel[level]++
  if (emittedByLevel[level] > MAX_ANNOTATIONS_PER_LEVEL) {
    if (emittedByLevel[level] === MAX_ANNOTATIONS_PER_LEVEL + 1) {
      // Say so once; the rest are in the log and the summary rather than the annotations UI.
      console.log(
        `Reached the GitHub annotation display limit for ${level}s; further ${level}s appear in the log only.`,
      )
    }
    return
  }
  const titlePart = title ? ` title=${escapeProperty(title)}` : ''
  process.stdout.write(`::${level}${titlePart}::${escapeData(message)}\n`)
}
