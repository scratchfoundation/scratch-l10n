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
 * @param message - the translated message to validate
 * @param source - the source string for this translated message
 * @returns `false` if the message definitely has a problem, or `true` if the message might be OK.
 */
const validMessage = (message: TransifexEditorString, source: TransifexEditorString): boolean => {
  const transPlaceholders = placeholders(getMessageText(message))
  const srcPlaceholders = placeholders(getMessageText(source))
  // different number of placeholders
  if (transPlaceholders.length !== srcPlaceholders.length) {
    return false
  }
  // TODO: Add checking to make sure placeholders in source have not been translated
  // TODO: Add validation of scratch-blocks placeholders
  return true
}

/**
 * @param translation - the translations to validate and their corresponding source strings
 * @param translation.locale - the Transifex locale, for error reporting
 * @param translation.translations - the translations to validate
 * @param source - the source strings for the translations
 */
const validateTranslations = (
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

export { validateTranslations, validMessage }
