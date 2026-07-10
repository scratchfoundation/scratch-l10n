/**
 * @file
 * Shared helper for reporting non-fatal problems during help sync.
 */
import { appendFileSync } from 'fs'
import { messageOf } from './errors.mts'

/**
 * Log a warning to the console and, when the `WARNINGS_FILE` environment variable is set, append it
 * to that file. CI reads the file after the sync to surface warnings in the job summary and to send
 * a notification, so a warning is the right tool for a problem worth a human's attention that should
 * not fail the run (for example, a resource we deliberately skip).
 * @param warning - the warning message; a trailing newline is added when written to the file
 */
export const emitWarning = (warning: string): void => {
  console.warn(warning)
  if (process.env.WARNINGS_FILE) {
    // The file write is best-effort: emitWarning is the non-fatal path (often called from a catch
    // block), so a failed append must not turn a warning into a crash.
    try {
      appendFileSync(process.env.WARNINGS_FILE, warning + '\n')
    } catch (error) {
      console.warn(`Could not append to WARNINGS_FILE "${process.env.WARNINGS_FILE}": ${messageOf(error)}`)
    }
  }
}
