#!/usr/bin/env babel-node

/**
 * @fileoverview
 * Script to pull blocks translations from transifex and generate the scratch_msgs file.
 * Blocks uses a flat json file (not Chrome i18n), so needs to be handled separately. Expects
 * that the person running the script has the the TX_TOKEN environment variable set to an api
 * token that has developer access.
 */

const args = process.argv.slice(2);

const usage = `
 Pull blocks translations from Transifex. Usage:
   node tx-pull-blocks.js path
     path: where to put the downloaded json files
   NOTE: TX_TOKEN environment variable needs to be set with a Transifex API token. See
   the Localization page on the GUI wiki for information about setting up Transifex.
 `;
// Fail immediately if the TX_TOKEN is not defined
if (!process.env.TX_TOKEN || args.length < 1) {
    process.stdout.write(usage);
    process.exit(1);
}

import fs from 'fs';
import path from 'path';
import transifex from 'transifex';
import async from 'async';
import locales, {localeMap} from '../src/supported-locales.js';

// Globals
const PROJECT = 'scratch-editor';
const RESOURCE = 'blocks';
const OUTPUT_DIR = path.resolve(args[0]);
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
    values.forEach(function (translation) {
        // skip validation as it's handled in scratch-blocks
        const file = JSON.stringify(translation.translations, null, 4);
        fs.writeFileSync(
            `${OUTPUT_DIR}/${translation.locale}.json`,
            file
        );
    });
});
