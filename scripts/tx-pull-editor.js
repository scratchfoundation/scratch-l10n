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
   node tx-pull-editor.js tx-project tx-resource path
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
import {txPull} from '../lib/transifex.js';
import {validateTranslations} from '../lib/validate.js';
import locales, {localeMap} from '../src/supported-locales.js';
import {batchMap} from '../lib/batch.js';

// Globals
const PROJECT = args[0];
const RESOURCE = args[1];
const OUTPUT_DIR = path.resolve(args[2]);
const MODE = 'reviewed';
const CONCURRENCY_LIMIT = 36;

const getLocaleData = async function (locale) {
    let txLocale = localeMap[locale] || locale;
    const data = await txPull(PROJECT, RESOURCE, txLocale, MODE);
    return {
        locale: locale,
        translations: data
    };
};

const pullTranslations = async function () {
    try {
        const values = await batchMap(Object.keys(locales), CONCURRENCY_LIMIT, getLocaleData);
        const source = values.find(elt => elt.locale === 'en').translations;
        values.forEach(function (translation) {
            validateTranslations({locale: translation.locale, translations: translation.translations}, source);
            // if translation has message & description, we only want the message
            let txs = {};
            for (const key of Object.keys(translation.translations)) {
                const tx = translation.translations[key];
                if (tx.message) {
                    txs[key] = tx.message;
                } else {
                    txs[key] = tx;
                }
            }
            const file = JSON.stringify(txs, null, 4);
            fs.writeFileSync(
                `${OUTPUT_DIR}/${translation.locale}.json`,
                file
            );
        });
    } catch (err) {
        process.stdout.write(err.message);
        process.exit(1);
    }
};

pullTranslations();
