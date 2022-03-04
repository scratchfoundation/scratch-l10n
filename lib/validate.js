import assert from 'assert';
import parse from 'format-message-parse';

// filter placeholders out of a message
// parse('a message with a {value} and {count, plural, one {one} other {more}}.')
// returns an array:
// [ 'a message with a ',
//   [ 'value' ],
//   ' and ',
//   [ 'count', 'plural', 0, { one: [Array], other: [Array] } ],
//   '.'
// ]
// placeholders are always an array, so filter for array elements to find the placeholders
const placeholders = message => (
    // this will throw an error if the message is not valid ICU
    // single quote (as in French l'année) messes up the parse and is not
    // relevant for this check, so strip them out
    parse(message.replace(/'/g, '')).filter(item => Array.isArray(item))
);

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
