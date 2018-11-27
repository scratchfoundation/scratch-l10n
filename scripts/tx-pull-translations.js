#!/usr/bin/env babel-node

/**
 * @fileoverview
 * Script to pull translations from transifex and generate the editor-msgs file.
 * Expects that the project and resource have already been defined in Transifex, and that
 * the person running the script has the the TX_TOKEN environment variable set to an api
 * token that has developer access.
 */

const args = process.argv.slice(2);

const usage = `
 Pull supported language translations from Transifex. Usage:
   node tx-pull-translations.js tx-project tx-resource path
     tx-project: project on Transifex (e.g., scratch-editor)
     tx-resource: resource within the project (e.g., interface)
     path: where to put the downloaded json files
   NOTE: TX_TOKEN environment variable needs to be set with a Transifex API token. See
   the Localization page on the GUI wiki for information about setting up Transifex.
 `;
// Fail immediately if the TX_TOKEN is not defined
if (!process.env.TX_TOKEN || args.length < 3) {
    process.stdout.write(usage);
    process.exit(1);
}

import fs from 'fs';
import path from 'path';
import transifex from 'transifex';
import async from 'async';
import {flattenJson, validateTranslations} from './tx-util.js';
import locales, {localeMap} from '../src/supported-locales.js';

// Globals
const PROJECT = args[0];
const RESOURCE = args[1];
const OUTPUT_DIR = path.resolve(args[2]);
// TODO: convert mode to 'reviewed' before January
const MODE = {mode: 'default'};
const CONCURRENCY_LIMIT = 4;

const TX = new transifex({
    project_slug: PROJECT,
    credential: 'api:' + process.env.TX_TOKEN
});

const getLocaleData = (locale, callback) => {
    let txLocale = localeMap[locale] || locale;
    TX.translationInstanceMethod(PROJECT, RESOURCE, txLocale, MODE, function (err, data) {
        if (err) {
            callback(err);
        } else {
            callback(null, {
                locale: locale,
                translations: JSON.parse(data)
            });
        }
    });
};

async.mapLimit(Object.keys(locales), CONCURRENCY_LIMIT, getLocaleData, function (err, values) {
    if (err) {
        console.error(err); // eslint-disable-line no-console
        process.exit(1);
    }
    const source = JSON.parse(flattenJson(values.find(elt => elt.locale === 'en').translations));
    values.forEach(function (translation) {
        const file = flattenJson(translation.translations);
        validateTranslations({locale: translation.locale, translations: JSON.parse(file)}, source);
        fs.writeFileSync(
            `${OUTPUT_DIR}/${translation.locale}.json`,
            file
        );
    });
});
