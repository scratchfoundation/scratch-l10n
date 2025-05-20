import assert from 'assert'
import parse from 'format-message-parse'
import {
  TransifexStringChrome,
  TransifexStringKeyValueJson,
  TransifexStringsChrome,
  TransifexStringsKeyValueJson,
} from './transifex-formats.mts'

export type TransifexEditorString = TransifexStringChrome | TransifexStringKeyValueJson
export type TransifexEditorStrings = TransifexStringsChrome | TransifexStringsKeyValueJson

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
 */
export const validMessage = (message: TransifexEditorString, source: TransifexEditorString): boolean => {
  const msgText = getMessageText(message)
  const srcText = getMessageText(source)

  // Check ICU placeholders (stringify in case of complex placeholders)
  const msgPlaceholdersICU = placeholders(msgText).map(x => JSON.stringify(x))
  const srcPlaceholdersICU = placeholders(srcText).map(x => JSON.stringify(x))
  if (!sameItems(msgPlaceholdersICU, srcPlaceholdersICU)) {
    return false
  }

  // Check scratch-blocks numeric placeholders like '%1'
  const msgPlaceholdersNumeric: string[] = msgText.match(/%[0-9]+/g) ?? []
  const srcPlaceholdersNumeric: string[] = srcText.match(/%[0-9]+/g) ?? []
  if (!sameItems(msgPlaceholdersNumeric, srcPlaceholdersNumeric)) {
    return false
  }

  return true
}

/**
 * @param translation - the translations to validate and their corresponding source strings
 * @param translation.locale - the Transifex locale, for error reporting
 * @param translation.translations - the translations to validate
 * @param source - the source strings for the translations
 */
export const validateTranslations = (
  { locale, translations }: { locale: string; translations: TransifexEditorStrings },
  source: TransifexEditorStrings,
) => {
  const transKeys = Object.keys(translations)
  const sourceKeys = Object.keys(source)
  assert.strictEqual(transKeys.length, sourceKeys.length, `locale ${locale} has a different number of message keys`)
  transKeys.forEach(item => assert(sourceKeys.includes(item), `locale ${locale} has key ${item} not in the source`))
  sourceKeys.forEach(item => assert(transKeys.includes(item), `locale ${locale} is missing key ${item}`))
  sourceKeys.forEach(item =>
    assert(
      validMessage(translations[item], source[item]),
      `locale ${locale} / item ${item}: "${getMessageText(translations[item])}" is not a valid translation for "${getMessageText(source[item])}"`,
    ),
  )
}
