#!/usr/bin/env babel-node

/**
 * @fileoverview
 * Script to validate the www translation json
 */

const args = process.argv.slice(2);
const usage = `
 Validate translation json. Usage:
   babel-node validate_www.js path
     path: root folder for all the www resource folders
 `;
if (args.length < 1) {
    process.stdout.write(usage);
    process.exit(1);
}
import fs from 'fs';
import path from 'path';
import glob from 'glob';
import async from 'async';
import {validateTranslations} from '../lib/validate.js';
import locales from '../src/supported-locales.js';

// Globals
const WWW_DIR = path.resolve(args[0]);
const RESOURCES = glob.sync(`${path.resolve(WWW_DIR)}/*`);

const validate = (localeData, callback) => {
    fs.readFile(localeData.localeFileName, function (err, data) {
        if (err) callback(err);
        // let this throw an error if invalid json
        data = JSON.parse(data);
        const translations = {
            locale: localeData.locale,
            translations: data
        };
        validateTranslations(translations, localeData.sourceData);
    });
};

const validateResource = (resource, callback) => {
    const source = JSON.parse(fs.readFileSync(`${resource}/en.json`));
    const allLocales = Object.keys(locales).map(loc => {
        return {
            locale: loc,
            localeFileName: `${resource}/${loc}.json`,
            sourceData: source
        };
    });
    async.each(allLocales, validate, function (err) {
        if (err) {
            callback(err);
        }
    });
};

async.each(RESOURCES, validateResource, function (err) {
    if (err) {
        console.error(err); // eslint-disable-line no-console
        process.exit(1);
    }
});
