import parse from 'format-message-parse'
import {
  TransifexStringChrome,
  TransifexStringKeyValueJson,
  TransifexStringsChrome,
  TransifexStringsKeyValueJson,
} from './transifex-formats.mts'

export type TransifexEditorString = TransifexStringChrome | TransifexStringKeyValueJson
export type TransifexEditorStrings = TransifexStringsChrome | TransifexStringsKeyValueJson

const formatError = (err: unknown): string => {
  if (err instanceof Error) return err.stack ?? err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return '[unserializable error]'
  }
}

/**
 * filter placeholders out of a message
 * @param message - the message to parse
 * @returns an array of placeholder information
 * @example
 * parse('a message with a {value} and {count, plural, one {one} other {more}}.')
 * returns an array:
 * [ 'a message with a ',
 *   [ 'value' ],
 *   ' and ',
 *   [ 'count', 'plural', 0, { one: [Array], other: [Array] } ],
 *   '.'
 * ]
 * placeholders are always an array, so filter for array elements to find the placeholders
 */
const placeholders = (message: string): parse.Placeholder[] =>
  // this will throw an error if the message is not valid ICU
  // single quote (as in French l'année) messes up the parse and is not
  // relevant for this check, so strip them out
  parse(message.replace(/'/g, '')).filter(item => Array.isArray(item))

const getMessageText = (m: TransifexStringKeyValueJson | TransifexStringChrome | undefined): string =>
  m == null ? '' : typeof m === 'string' ? m : m.message

// Matches everything inside brackets, and the brackets themselves.
// e.g. matches '[MOTOR_ID]', '[POWER]' from 'altera a potência de [MOTOR_ID] para [POWER]'
// These are used as block input placeholders in extension translations and must be preserved verbatim.
const bracketPlaceholderRegex = /\[.+?\]/g

/**
 * Find bracket placeholders (e.g. `[PART]`) that exist in the source string but are missing from the translation.
 * A translation that localizes or drops a placeholder (e.g. `[TEIL]` instead of `[PART]`) breaks the editor, so the
 * placeholder text must appear verbatim. Shared by {@link validMessage} (pull-time sanitizing) and the standalone
 * extension-input validator so the two never drift apart.
 * @param message - the translated message to check
 * @param source - the source string the translation is derived from
 * @returns the source placeholders that are absent from the translation (empty if the translation is fine)
 */
export const missingBracketPlaceholders = (
  message: TransifexEditorString | undefined,
  source: TransifexEditorString | undefined,
): string[] => {
  const sourceInputs = getMessageText(source).match(bracketPlaceholderRegex)
  if (!sourceInputs) return []
  const translatedInputs: string[] = getMessageText(message).match(bracketPlaceholderRegex) ?? []
  return sourceInputs.filter(input => !translatedInputs.includes(input))
}

/**
 * @param a - one array of items
 * @param b - another array of items
 * @returns true if the two arrays contain the same items, without consideration of order and duplicates, judged by
 * shallow equality.
 * @example
 * sameItems(['a', 'b'], ['a', 'b']) === true
 * sameItems(['a', 'b'], ['b', 'a']) === true
 * sameItems(['a', 'b'], ['b', 'a', 'b']) === true
 * sameItems(['a', 'b'], ['a']) === false
 */
function sameItems<T>(a: T[], b: T[]): boolean {
  if (!a.every(x => b.includes(x))) {
    return false
  }
  if (!b.every(x => a.includes(x))) {
    return false
  }
  return true
}

/**
 * @param message - the translated message to validate
 * @param source - the source string for this translated message
 * @param options - validation options
 * @param options.checkBracketPlaceholders - also require bracket placeholders (e.g. `[PART]`) to be preserved verbatim
 * @returns `false` if the message definitely has a problem, or `true` if the message might be OK.
 * @throws if ICU parsing fails for a reason other than a `SyntaxError` (e.g. an unexpected error in the parser itself)
 */
export const validMessage = (
  message: TransifexEditorString,
  source: TransifexEditorString,
  options: { checkBracketPlaceholders?: boolean } = {},
): boolean => {
  const msgText = getMessageText(message)
  const srcText = getMessageText(source)

  // Check ICU placeholder names (but not extended plural info)
  // parse() throws a SyntaxError if the message has invalid ICU syntax (e.g. `{{tosLink}`)
  // Treat that as invalid so the translation is replaced with the source string instead of crashing.
  let msgPlaceholderNamesICU: string[]
  let srcPlaceholderNamesICU: string[]
  try {
    msgPlaceholderNamesICU = placeholders(msgText).map(x => x[0])
    srcPlaceholderNamesICU = placeholders(srcText).map(x => x[0])
  } catch (err) {
    // ICU parse error - treat as a validation failure
    if (err instanceof SyntaxError) {
      return false
    }
    // Some other error we didn't expect - re-throw it
    throw err
  }
  if (!sameItems(msgPlaceholderNamesICU, srcPlaceholderNamesICU)) {
    return false
  }

  // Check scratch-blocks numeric placeholders like '%1'
  // TODO: apply this only for resources that use numeric placeholders.
  // Otherwise, sentences with percentages can cause failures in some languages. Example: "göre %48'lik bir artış"
  // const msgPlaceholdersNumeric: string[] = msgText.match(/%[0-9]+/g) ?? []
  // const srcPlaceholdersNumeric: string[] = srcText.match(/%[0-9]+/g) ?? []
  // if (!sameItems(msgPlaceholdersNumeric, srcPlaceholdersNumeric)) {
  //   return false
  // }

  // Check bracket placeholders like '[PART]' (extension block inputs only - see filterInvalidTranslations caller).
  // Applied opt-in because non-extension resources can contain literal brackets in prose (e.g. www quotes).
  if (options.checkBracketPlaceholders && missingBracketPlaceholders(message, source).length > 0) {
    return false
  }

  return true
}

/**
 * Like {@link validMessage}, but treats a thrown (unexpected) error as invalid instead of propagating it. Used when
 * checking a fallback candidate, where any problem simply means "don't use this one".
 * @param message - the message to validate
 * @param source - the source string for the message
 * @param options - validation options, forwarded to {@link validMessage}
 * @param options.checkBracketPlaceholders - also require bracket placeholders (e.g. `[PART]`) to be preserved verbatim
 * @returns true if the message validates without throwing
 */
const safeValidMessage = (
  message: TransifexEditorString,
  source: TransifexEditorString,
  options: { checkBracketPlaceholders?: boolean } = {},
): boolean => {
  try {
    return validMessage(message, source, options)
  } catch {
    return false
  }
}

/**
 * Validate and filter translations.
 * WARNING: Modifies the translations object in place by replacing invalid translations.
 * An invalid translation is replaced with the previous translation if one is supplied and still valid, otherwise with
 * the source string. This keeps a known-good earlier translation rather than regressing all the way to English when
 * only the newest Transifex revision is broken.
 * @param locale - the Transifex locale, for error reporting
 * @param translations - the translations to validate and filter
 * @param source - the source strings for the translations
 * @param options - validation options
 * @param options.previous - the previously committed translations for this locale, used as the preferred fallback
 * @param options.checkBracketPlaceholders - also require bracket placeholders (e.g. `[PART]`) to be preserved;
 *   enable only for resources whose brackets are placeholders rather than prose (i.e. extensions)
 * @returns the messages about problems encountered (every replaced translation has one; some messages such as missing
 * keys do not correspond to a replacement) and `rejected`, the count of translations that failed validation and were
 * replaced.
 */
export const filterInvalidTranslations = (
  locale: string,
  translations: TransifexEditorStrings,
  source: TransifexEditorStrings,
  options: { previous?: TransifexEditorStrings; checkBracketPlaceholders?: boolean } = {},
): { messages: string[]; rejected: number } => {
  const { previous, checkBracketPlaceholders = false } = options
  const messages: string[] = []
  let rejected = 0

  const sourceKeys = Object.keys(source)

  const transKeys = Object.keys(translations).filter(item => {
    if (!sourceKeys.includes(item)) {
      messages.push(`locale ${locale} has key ${item} not in the source`)
      delete translations[item]
      return false
    }
    return true
  })

  sourceKeys.forEach(item => {
    if (!transKeys.includes(item)) {
      messages.push(`locale ${locale} is missing key ${item}`)
    }
  })

  transKeys.forEach(item => {
    let valid: boolean
    let validationError: unknown
    try {
      valid = validMessage(translations[item], source[item], { checkBracketPlaceholders })
    } catch (err) {
      valid = false
      validationError = err
    }
    if (!valid) {
      rejected++
      messages.push(
        [
          `locale ${locale} / item ${item}: message validation failed:`,
          `  msg: ${getMessageText(translations[item])}`,
          `  src: ${getMessageText(source[item])}`,
          ...(validationError != null ? [`  error: ${formatError(validationError)}`] : []),
        ].join('\n'),
      )

      // Prefer the previous translation if we have one and it still validates; otherwise fall back to the source.
      const previousTranslation = previous?.[item]
      const keepPrevious =
        previousTranslation !== undefined &&
        safeValidMessage(previousTranslation, source[item], { checkBracketPlaceholders })
      translations[item] = keepPrevious ? previousTranslation : source[item]
    }
  })

  return { messages, rejected }
}
