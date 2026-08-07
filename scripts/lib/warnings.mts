/**
 * @file
 * Shared helper for reporting non-fatal problems during help sync.
 */
import { appendFileSync } from 'fs'
import { emitAnnotation } from './annotations.mts'
import { messageOf } from './errors.mts'

/**
 * Log a warning to the console and, when the `WARNINGS_FILE` environment variable is set, append it
 * to that file. CI reads the file after the sync to surface warnings in the job summary and to send
 * a notification, so a warning is the right tool for a problem worth a human's attention that should
 * not fail the run (for example, a resource we deliberately skip). Also emits a GitHub Actions
 * warning annotation (a no-op off CI) so the problem shows on the run page, not just in the log.
 * @param warning - the warning message; a trailing newline is added when written to the file
 * @param link - optional convenience URL (for example, a Transifex editor deep link) appended to the
 *   warning so a reader can jump straight to where the fix is made
 */
export const emitWarning = (warning: string, link?: string): void => {
  const line = link ? `${warning} (${link})` : warning
  console.warn(line)
  if (process.env.WARNINGS_FILE) {
    // The file write is best-effort: emitWarning is the non-fatal path (often called from a catch
    // block), so a failed append must not turn a warning into a crash.
    try {
      appendFileSync(process.env.WARNINGS_FILE, line + '\n')
    } catch (error) {
      console.warn(`Could not append to WARNINGS_FILE "${process.env.WARNINGS_FILE}": ${messageOf(error)}`)
    }
  }
  emitAnnotation({ level: 'warning', message: line })
}
