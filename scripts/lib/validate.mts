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

const getMessageText = (m: TransifexStringKeyValueJson | TransifexStringChrome): string =>
  typeof m === 'string' ? m : m.message

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
 * @returns `false` if the message definitely has a problem, or `true` if the message might be OK.
 * @throws if ICU parsing fails for a reason other than a `SyntaxError` (e.g. an unexpected error in the parser itself)
 */
export const validMessage = (message: TransifexEditorString, source: TransifexEditorString): boolean => {
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

  return true
}

/**
 * Validate and filter translations.
 * WARNING: Modifies the translations object in place by replacing invalid translations with source strings.
 * @param locale - the Transifex locale, for error reporting
 * @param translations - the translations to validate and filter
 * @param source - the source strings for the translations
 * @returns a list of messages about errors encountered during validation. Every removed translation will have a
 * message. Some messages may not correspond to removed translations (e.g., when the number of keys differ).
 */
export const filterInvalidTranslations = (
  locale: string,
  translations: TransifexEditorStrings,
  source: TransifexEditorStrings,
): string[] => {
  const messages: string[] = []

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
      valid = validMessage(translations[item], source[item])
    } catch (err) {
      valid = false
      validationError = err
    }
    if (!valid) {
      messages.push(
        [
          `locale ${locale} / item ${item}: message validation failed:`,
          `  msg: ${getMessageText(translations[item])}`,
          `  src: ${getMessageText(source[item])}`,
          ...(validationError != null ? [`  error: ${formatError(validationError)}`] : []),
        ].join('\n'),
      )

      // fall back to source message
      translations[item] = source[item]
    }
  })

  return messages
}
