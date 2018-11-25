import assert from 'assert';
import parse from 'format-message-parse';

const flattenJson = (translations) => {
    let messages = Object.keys(translations).reduce((collection, id) => {
        collection[id] = translations[id].message;
        return collection;
    }, {});
    return JSON.stringify(messages, null, 4);
};

const validMessage = (message, source) => {
    // this will throw an error if the message is not valid icu
    const t = parse(message);
    const s = parse(source);
    // the syntax tree for both messages should have the same number of elements
    return t.length === s.length;
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

export {flattenJson, validateTranslations, validMessage};
