#!/usr/bin/env babel-node

/**
 * @fileoverview
 * Script get Knowledge base articles from Freshdesk and push them to transifex.
 */

const args = process.argv.slice(2);
const {txPush, txCreateResource} = require('../lib/transifex.js');

const usage = `
 Pull knowledge base articles from Freshdesk and push to scratch-help project on transifex. Usage:
   node tx-push-help.js
   NOTE:
   FRESHDESK_TOKEN environment variable needs to be set to a FreshDesk API key with
   access to the Knowledge Base.
   TX_TOKEN environment variable needs to be set with a Transifex API token. See
   the Localization page on the GUI wiki for information about setting up Transifex.
 `;
// Fail immediately if the API tokens are not defined, or there any argument
if (!process.env.TX_TOKEN || !process.env.FRESHDESK_TOKEN || args.length > 0) {
    process.stdout.write(usage);
    process.exit(1);
}

import FreshdeskApi from './freshdesk-api.js';

const FD = new FreshdeskApi('https://mitscratch.freshdesk.com', process.env.FRESHDESK_TOKEN);
const TX_PROJECT = 'scratch-help';

const categoryNames = {};
const folderNames = {};

/**
 * Generate a transifex id from the name and id field of an objects. Remove spaces and '/'
 * from the name and append '.<id>' Transifex ids (slugs) have a max length of 50. Use at most
 * 30 characters of the name to allow for Freshdesk id, and a suffix like '_json'
 * @param  {object} item data from Freshdesk that includes the name and id of a category or folder
 * @return {string}      generated transifex id
 */
const makeTxId = item => {
    return `${item.name.replace(/[ /]/g, '').slice(0, 30)}_${item.id}`;
};

const txPushResource = async (name, articles, type) => {
    const resourceData = {
        slug: name,
        name: name,
        i18n_type: type,
        priority: 0, // default to normal priority
        content: articles
    };

    try {
        await txPush(TX_PROJECT, name, articles);
    } catch (err) {
        if (err.statusCode !== 404) {
            process.stdout.write(`Transifex Error: ${err.message}\n`);
            process.stdout.write(
                `Transifex Error ${err.response.statusCode.toString()}: ${err.response.body}\n`);
            process.exitCode = 1;
            return;
        }

        // file not found - create it, but also give message
        process.stdout.write(`Transifex Resource not found, creating: ${name}\n`);
        if (err.statusCode === 404) {
            await txCreateResource(TX_PROJECT, resourceData);
        }
    }
};

/**
 * get a flattened list of folders
 * @param  {category}  categories array of categories the folders belong to
 * @return {Promise}            flattened list of folders
 */
const getFolders = async (categories) => {
    let categoryFolders = await Promise.all( // eslint-disable-line no-undef
        categories.map(category => FD.listFolders(category))
    );
    return [].concat(...categoryFolders);
};

const PUBLISHED = 2; // in Freshdesk, draft status = 1, and published = 2
const saveArticles = (folder) => {
    FD.listArticles(folder)
        .then(json => {
            let txArticles = json.reduce((strings, current) => {
                if (current.status === PUBLISHED) {
                    strings[`${current.id}`] = {
                        title: {
                            string: current.title
                        },
                        description: {
                            string: current.description
                        }
                    };
                    if (current.tags.length > 0) {
                        strings[`${current.id}`].tags = {string: current.tags.toString()};
                    }
                }
                return strings;
            }, {});
            process.stdout.write(`Push ${folder.name} articles to Transifex\n`);
            txPushResource(`${makeTxId(folder)}_json`, txArticles, 'STRUCTURED_JSON');
        });
};
const getArticles = async (folders) => {
    return Promise.all(folders.map(folder => saveArticles(folder))); // eslint-disable-line no-undef
};

const syncSources = async () => {
    let status = 0;
    status = await FD.listCategories()
        .then(json => {
            // save category names for translation
            for (let cat of json.values()) {
                categoryNames[`${makeTxId(cat)}`] = cat.name;
            }
            return json;
        })
        .then(getFolders)
        .then(data => {
            data.forEach(item => {
                folderNames[`${makeTxId(item)}`] = item.name;
            });
            process.stdout.write('Push category and folder names to Transifex\n');
            txPushResource('categoryNames_json', categoryNames, 'KEYVALUEJSON');
            txPushResource('folderNames_json', folderNames, 'KEYVALUEJSON');
            return data;
        })
        .then(getArticles)
        .catch((e) => {
            process.stdout.write(`Error:${e.message}\n`);
            return 1;
        });
    process.exitCode = status;
};

syncSources();
