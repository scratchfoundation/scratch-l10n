/**
 * @file
 * Small shared helpers for working with caught values.
 */

/**
 * Extract a human-readable message from a caught value. `catch` values are typed `unknown` and are
 * not guaranteed to be `Error` instances, so read `.message` only when it really is one.
 * @param err - the caught value
 * @returns the error message, or a string representation of a non-Error throw
 */
export const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/**
 * Describe where a `JSON.parse` failed, for a diagnostic message. V8 reports the byte offset (and, on
 * newer Node, the line and column) in the error message; combined with the original text this pins the
 * problem to a snippet and, for a flat `{"key": "value"}` file, the key whose value is malformed.
 * Best-effort: returns undefined when the error is not a positioned JSON parse error or the text can't
 * be read, so callers fall back to the plain message.
 * @param error - the caught value (expected to be a `SyntaxError` from `JSON.parse`)
 * @param text - the exact string that was parsed
 * @returns a one-line description (location, nearby key, snippet), or undefined
 */
export const describeJsonParseError = (error: unknown, text: string): string | undefined => {
  if (!(error instanceof SyntaxError) || typeof text !== 'string') {
    return undefined
  }
  const posMatch = /in JSON at position (\d+)/.exec(error.message)
  if (!posMatch) {
    return undefined
  }
  const pos = Number(posMatch[1])
  if (!Number.isFinite(pos)) {
    return undefined
  }
  const lineColMatch = /\(line (\d+) column (\d+)\)/.exec(error.message)
  const where = lineColMatch ? `line ${lineColMatch[1]}, column ${lineColMatch[2]}` : `position ${pos}`
  // Recover the enclosing key of a flat KEYVALUEJSON object: the value that failed to parse is
  // preceded by `"<key>":`, so scan back from the error position to that key. Heuristic (a colon or
  // quote inside an earlier string can fool it), so it is reported as "near key", not an exact locator.
  let nearKey: string | undefined
  const before = text.slice(0, pos)
  const colon = before.lastIndexOf(':')
  if (colon > 0) {
    const keyClose = before.lastIndexOf('"', colon)
    if (keyClose > 0) {
      const keyOpen = before.lastIndexOf('"', keyClose - 1)
      if (keyOpen >= 0) {
        nearKey = before.slice(keyOpen + 1, keyClose)
      }
    }
  }
  // A short, whitespace-collapsed window around the failure so the operator can eyeball the bad text.
  const snippet = text
    .slice(Math.max(0, pos - 30), pos + 30)
    .replace(/\s+/g, ' ')
    .trim()
  const keyPart = nearKey ? ` near key "${nearKey}"` : ''
  return `malformed JSON at ${where}${keyPart}: …${snippet}…`
}
