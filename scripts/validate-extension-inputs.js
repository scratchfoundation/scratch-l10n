#!/usr/bin/env babel-node

/**
 * @fileoverview
 * Script to validate extension block input placeholders
 */

import fs from 'fs';
import path from 'path';
import async from 'async';
import assert from 'assert';
import locales from '../src/supported-locales.js';
const args = process.argv.slice(2);

// Globals
const JSON_DIR = path.resolve(args[0]);
const source = JSON.parse(fs.readFileSync(`${JSON_DIR}/en.json`));

// Matches everything inside brackets, and the brackets themselves.
// e.g. matches '[MOTOR_ID]', '[POWER]' from 'altera a potência de [MOTOR_ID] para [POWER]'
const blockInputRegex = /\[.+?\]/g;
const blockPercentRegex = /%\d+/g;
const blockPercentWithQuotesRegex = /"%\d+"|“%\d+”|'%\d+'|「%\d+」|«%\d+»|„%\d+”/g;

let numTotalErrors = 0;

const validateExtensionInputs = (translationData, locale) => {
    let numLocaleErrors = 0;
    for (const block of Object.keys(translationData)) {
        const englishBlockInputs = source[block].match(blockInputRegex);
        if (englishBlockInputs) {
            // If null (meaning no matches), that means that English block inputs exist but translated ones don't.
            // Coerce it to an empty array so that the assertion below fails, instead of getting the less-helpful error
            // that we can't call Array.includes on null.
            const translatedBlockInputs = translationData[block].match(blockInputRegex) || [];

            for (const input of englishBlockInputs) {
                // Currently there are enough errors here that it would be tedious
                // to fix an error, rerun this tool to find the next error, and repeat.
                // So, catch the assertion error and add to the number of total errors.
                // This allows all errors to be displayed when the command is run,
                // rather than just the first encountered.
                try {
                    assert(
                        translatedBlockInputs.includes(input),

                        `Block '${block}' in locale '${locale}' does not include input ${input}:\n` +
                        translationData[block]
                    );
                } catch (err) {
                    numLocaleErrors++;
                    console.error(err.message + '\n'); // eslint-disable-line no-console
                }
            }
        }

        const englishBlockPercents = source[block].match(blockPercentRegex);
        if (englishBlockPercents) {
            const translatedBlockPercents = translationData[block].match(blockPercentRegex) || [];
            for (const percentInput of englishBlockPercents) {
                try {
                    assert(
                        translatedBlockPercents.includes(percentInput),
                        `Block '${block}' in locale '${locale}' does not include input ${percentInput}:\n` +
                        translationData[block]
                    );
                } catch (err) {
                    numLocaleErrors++;
                    console.error(err.message + '\n'); // eslint-disable-line no-console
                }
            }
        }

        // do not add to list of errors, print warning only
        const englishBlockPercentsWithQuotes = source[block].match(blockPercentWithQuotesRegex);
        if (englishBlockPercentsWithQuotes) {
            const translatedBlockPercentsWithQuotes = translationData[block].match(blockPercentWithQuotesRegex) || [];
            if (englishBlockPercentsWithQuotes.length !== translatedBlockPercentsWithQuotes.length) {
                /* eslint-disable no-console */
                console.error(`Warning (nonfatal): Block '${block}' in locale '${locale}'` +
                    ' might not have correct number of quoted inputs in:\n' + translationData[block] + '\n');
                /* eslint-enable no-console */
            }
        }
    }

    if (numLocaleErrors > 0) {
        numTotalErrors += numLocaleErrors;
        throw new Error(`${numLocaleErrors} total error(s) for locale '${locale}'`);
    }
};

const validate = (locale, callback) => {
    fs.readFile(`${JSON_DIR}/${locale}.json`, function (err, data) {
        if (err) callback(err);
        // let this throw an error if invalid json
        data = JSON.parse(data);

        try {
            validateExtensionInputs(data, locale);
        } catch (error) {
            console.error(error.message + '\n'); // eslint-disable-line no-console
        }

        callback();
    });
};

async.each(Object.keys(locales), validate, function (err) {
    if (err) {
        console.error(err); // eslint-disable-line no-console
        process.exit(1);
    }

    if (numTotalErrors > 0) {
        console.error(`${numTotalErrors} total extension input error(s)`); // eslint-disable-line no-console
        process.exit(1);
    }
});
