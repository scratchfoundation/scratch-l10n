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
