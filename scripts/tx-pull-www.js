#!/usr/bin/env babel-node

/**
 * @fileoverview
 * Script to pull www translations from transifex for all resources.
 * Expects that the project and that the person running the script
 * has the the TX_TOKEN environment variable set to an api
 * token that has developer access.
 */

const args = process.argv.slice(2);

const usage = `
 Pull supported language translations from Transifex for the 'scratch-website' project.
 It will query transifex for the list of resources.
 Usage:
   node tx-pull-www.js path [lang]
     path: root for the translated resources.
           Each resource will be a subdirectory containing language json files.
     lang: optional language code - will only pull resources for that language
   NOTE: TX_TOKEN environment variable needs to be set with a Transifex API token. 
   See the Localization page on the GUI wiki for information about setting up Transifex.
 `;
// Fail immediately if the TX_TOKEN is not defined
if (!process.env.TX_TOKEN || args.length < 1) {
    process.stdout.write(usage);
    process.exit(1);
}

import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import transifex from 'transifex';
import async from 'async';
import locales, {localeMap} from '../src/supported-locales.js';

// Globals
const PROJECT = 'scratch-website';
const OUTPUT_DIR = path.resolve(args[0]);
// const MODE = {mode: 'reviewed'}; // default is everything for www
const CONCURRENCY_LIMIT = 4;

const lang = args.length === 2 ? args[1] : '';

const TX = new transifex({
    project_slug: PROJECT,
    credential: 'api:' + process.env.TX_TOKEN
});


const getLocaleData = (item, callback) => {
    const locale = item.locale;
    const resource = item.resource;
    let txLocale = localeMap[locale] || locale;
    TX.translationInstanceMethod(PROJECT, resource, txLocale, function (err, data) {
        if (err) {
            callback(err);
        } else {
            const translations = JSON.parse(data);
            const txOutdir = `${OUTPUT_DIR}/${PROJECT}.${resource}`;
            mkdirp.sync(txOutdir);
            const fileName = `${txOutdir}/${locale}.json`;
            fs.writeFileSync(
                fileName,
                JSON.stringify(translations, null, 4)
            );
            callback(null, {
                resource: resource,
                locale: locale,
                file: fileName
            });
        }
    });
};

const expandResourceFiles = (resources) => {
    let items = [];
    for (let resource of resources) {
        if (lang) {
            items.push({resource: resource.slug, locale: lang});
        } else {
            for (let locale of Object.keys(locales)) {
                items.push({resource: resource.slug, locale: locale});
            }
        }
    }
    return items;
};

TX.resourcesSetMethod(PROJECT, (err, resources) => {
    if (err) {
        console.error(err); // eslint-disable-line no-console
        process.exit(1);
    }
    const allFiles = expandResourceFiles(resources);
    async.mapLimit(allFiles, CONCURRENCY_LIMIT, getLocaleData, function (e) {
        if (e) {
            console.error(e); // eslint-disable-line no-console
            process.exit(1);
        }
    });
});
