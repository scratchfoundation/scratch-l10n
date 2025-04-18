import assert from 'assert';
import parse from 'format-message-parse';

/**
 * Parse a message and return information about its ICU placeholders
 * @param {string} message - A message that may contain placeholders
 * @returns {Array} - An array of placeholders found in the message
 * @example
 * placeholders('a message with a {value} and {count, plural, one {one} other {more}}.')
 * // might return:
 * // [ [ 'value' ], [ 'count', 'plural', 0, { one: [Array], other: [Array] } ] ]
 */
const placeholders = message => (
    // this will throw an error if the message is not valid ICU
    // single quote (as in French l'année) messes up the parse and is not
    // relevant for this check, so strip them out
    parse(message.replace(/'/g, '')).filter(item => Array.isArray(item))
);

/**
 * Check if a message might be a valid translation for a source message
 * @param {string} message - The translated message
 * @param {string} source - The source message
 * @returns {boolean} - True if no errors are detected. Note that this function does not detect all possible errors.
 */
const validMessage = (message, source) => {
    const transPlaceholders = placeholders(message.toString());
    const srcPlaceholders = placeholders(source.toString());
    // different number of placeholders
    if (transPlaceholders.length !== srcPlaceholders.length) {
        return false;
    }
    // TODO: Add checking to make sure placeholders in source have not been translated
    // TODO: Add validation of scratch-blocks placeholders
    return true;
};

/**
 * Validate a set of translations against a set of source strings
 * @param {object} translation - The translation container to validate
 * @param {string} translation.locale - The locale of the translation
 * @param {object} translation.translations - The translations to validate
 * @param {Record<string, string>} translation.translations - A map of string ID to translated string
 * @param {Record<string, string>} source - A map of string ID to source string
 */
const validateTranslations = (translation, source) => {
    const locale = translation.locale;
    const translations = translation.translations;
    const transKeys = Object.keys(translations);
    const sourceKeys = Object.keys(source);
    assert.strictEqual(transKeys.length, sourceKeys.length, `locale ${locale} has a different number of message keys`);
    transKeys.map(item => assert(sourceKeys.includes(item), `locale ${locale} has key ${item} not in the source`));
    sourceKeys.map(item => assert(transKeys.includes(item), `locale ${locale} is missing key ${item}`));
    sourceKeys.map(item => assert(
        validMessage(translations[item], source[item]),
        `locale ${locale}: "${translations[item]}" is not a valid translation for "${source[item]}"`)
    );
};

export {validateTranslations, validMessage};
