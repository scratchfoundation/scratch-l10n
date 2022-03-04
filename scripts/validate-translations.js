#!/usr/bin/env babel-node

/**
 * @fileoverview
 * Script to validate the translation json
 */

const args = process.argv.slice(2);
const usage = `
 Validate translation json. Usage:
   babel-node validate_translations.js path
     path: where to find the downloaded json files
 `;
// Fail immediately if the TX_TOKEN is not defined
if (args.length < 1) {
    process.stdout.write(usage);
    process.exit(1);
}
import fs from 'fs';
import path from 'path';
import async from 'async';
import {validateTranslations} from '../lib/validate.js';
import locales from '../src/supported-locales.js';

// Globals
const JSON_DIR = path.resolve(args[0]);

const source = JSON.parse(fs.readFileSync(`${JSON_DIR}/en.json`));

const validate = (locale, callback) => {
    fs.readFile(`${JSON_DIR}/${locale}.json`, function (err, data) {
        if (err) callback(err);
        // let this throw an error if invalid json
        data = JSON.parse(data);
        const translations = {
            locale: locale,
            translations: data
        };
        validateTranslations(translations, source);
    });
};

async.each(Object.keys(locales), validate, function (err) {
    if (err) {
        console.error(err); // eslint-disable-line no-console
        process.exit(1);
    }
});
