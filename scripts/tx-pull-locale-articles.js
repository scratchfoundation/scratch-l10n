#!/usr/bin/env node

/**
 * @fileoverview
 * Script to pull scratch-help translations from transifex and push to FreshDesk.
 */

const args = process.argv.slice(2);
const usage = `
 Pull knowledge base articles from transifexfor debugging translation errors. Usage:
   node tx-pull-locale-articles.js -d locale-code
   NOTE:
   FRESHDESK_TOKEN environment variable needs to be set to a FreshDesk API key with
   access to the Knowledge Base.
   TX_TOKEN environment variable needs to be set with a Transifex API token. See
   the Localization page on the GUI wiki for information about setting up Transifex.
 `;
// Fail immediately if the API tokens are not defined, or missing argument
if (!process.env.TX_TOKEN || !process.env.FRESHDESK_TOKEN || args.length === 0) {
    process.stdout.write(usage);
    process.exit(1);
}

const {getInputs, saveItem, localizeFolder, debugFolder} = require('./help-utils.js');

let locale = args[0];
let debug = false;
if (locale === '-d') {
    debug = true;
    locale = args[1];
}
const saveFn = debug ? debugFolder : localizeFolder;

getInputs()
    .then(([languages, folders, names]) => { // eslint-disable-line no-unused-vars
        process.stdout.write('Processing articles pulled from Transifex\n');
        return folders.map(item => saveItem(item, [locale], saveFn));
    })
    .catch((e) => {
        process.stdout.write(`Error: ${e.message}\n`);
        process.exitCode = 1; // not ok
    });
