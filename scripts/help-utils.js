#!/usr/bin/env node

/**
 * @fileoverview
 * Helper functions for syncing Freshdesk knowledge base articles with Transifex
 */

const FreshdeskApi = require('./freshdesk-api.js');
const fs = require('fs');
const fsPromises = fs.promises;
const mkdirp = require('mkdirp');
const {txPull, txResourcesObjects, txAvailableLanguages} = require('../lib/transifex.js');

const FD = new FreshdeskApi('https://mitscratch.freshdesk.com', process.env.FRESHDESK_TOKEN);
const TX_PROJECT = 'scratch-help';

const freshdeskLocale = locale => {
    // map between Transifex locale and Freshdesk. Two letter codes are usually fine
    const localeMap = {
        'es_419': 'es-LA',
        'ja': 'ja-JP',
        'ja-Hira': 'ja-JP',
        'lv': 'lv-LV',
        'nb': 'nb-NO',
        'nn': 'nb-NO',
        'pt': 'pt-PT',
        'pt_BR': 'pt-BR',
        'ru': 'ru-RU',
        'sv': 'sv-SE',
        'zh_CN': 'zh-CN',
        'zh_TW': 'zh-TW'
    };
    return localeMap[locale] || locale;
};


/**
 * Pull metadata from Transifex for the scratch-help project
 * @return {Promise} results array containing:
 *                      languages: array of supported languages
 *                      folders: array of tx resources corrsponding to Freshdesk folders
 *                      names: array of tx resources corresponding to the Freshdesk metadata
 */
exports.getInputs = async () => {
    const resources = await txResourcesObjects(TX_PROJECT);
    const languages = await txAvailableLanguages(TX_PROJECT);
    // there are three types of resources differentiated by the file type
    const folders = resources.filter(resource => resource.i18n_type === 'STRUCTURED_JSON');
    const names = resources.filter(resource => resource.i18n_type === 'KEYVALUEJSON');
    // ignore the yaml type because it's not possible to update via API

    return Promise.all([languages, folders, names]); // eslint-disable-line no-undef
};

/**
 * internal function to serialize saving category and folder name translations to avoid Freshdesk rate limit
 * @param  {[type]}  json     [description]
 * @param  {[type]}  resource [description]
 * @param  {[type]}  locale   [description]
 * @return {Promise}          [description]
 */
const serializeNameSave = async (json, resource, locale) => {
    for (let [key, value] of Object.entries(json)) {
        // key is of the form <name>_<id>
        const words = key.split('_');
        const id = words[words.length - 1];
        let status = 0;
        if (resource.name === 'categoryNames_json') {
            status = await FD.updateCategoryTranslation(id, freshdeskLocale(locale), {name: value});
        }
        if (resource.name === 'folderNames_json') {
            status = await FD.updateFolderTranslation(id, freshdeskLocale(locale), {name: value});
        }
        if (status === -1) {
            process.exitCode = 1;
        }
    }
};

/**
 * Internal function serialize Freshdesk requests to avoid getting rate limited
 * @param  {object}  json   object with keys corresponding to article ids
 * @param  {string}  locale language code
 * @return {Promise}        [description]
 */
const serializeFolderSave = async (json, locale) => {
    // json is a map of articles:
    // {
    //   <id>: {
    //     title: {string: <title-value>},
    //     description: {string: <description-value>},
    //     tags: {string: <comma separated strings} // optional
    //   },
    //   <id>: {
    //     title: {string: <title-value>},
    //     description: {string: <description-value>},
    //     tags: {string: <comma separated strings} // optional
    //   }
    // }
    for (let [id, value] of Object.entries(json)) {
        let body = {
            title: value.title.string,
            description: value.description.string,
            status: 2 // set status to published
        };
        if (Object.prototype.hasOwnProperty.call(value, 'tags')) {
            let tags = value.tags.string.split(',');
            let validTags = tags.filter(tag => tag.length < 33);
            if (validTags.length !== tags.length) {
                process.stdout.write(`Warning: tags too long in ${id} for ${locale}\n`);
            }
            body.tags = validTags;
        }
        let status = await FD.updateArticleTranslation(id, freshdeskLocale(locale), body);
        if (status === -1) {
            process.exitCode = 1;
        }
    }
    return 0;
};

/**
 * Process Transifex resource corresponding to a Knowledge base folder on Freshdesk
 * @param  {object}  folder Transifex resource json corresponding to a KB folder
 * @param  {string}  locale locale to pull and submit to Freshdesk
 * @return {Promise}        [description]
 */
exports.localizeFolder = async (folder, locale) => {
    txPull(TX_PROJECT, folder.slug, locale, {mode: 'default'})
        .then(data => {
            serializeFolderSave(data, locale);
        })
        .catch((e) => {
            process.stdout.write(`Error processing ${folder.slug}, ${locale}: ${e.message}\n`);
            process.exitCode = 1; // not ok
        });
};

/**
 * Save Transifex resource corresponding to a Knowledge base folder locally for debugging
 * @param  {object}  folder Transifex resource json corresponding to a KB folder
 * @param  {string}  locale locale to pull and save
 * @return {Promise}        [description]
 */
exports.debugFolder = async (folder, locale) => {
    mkdirp.sync('tmpDebug');
    txPull(TX_PROJECT, folder.slug, locale, {mode: 'default'})
        .then(data => {
            fsPromises.writeFile(
                `tmpDebug/${folder.slug}_${locale}.json`,
                JSON.stringify(data, null, 2)
            );
        })
        .catch((e) => {
            process.stdout.write(`Error processing ${folder.slug}, ${locale}: ${e.message}\n`);
            process.exitCode = 1; // not ok
        });
};

/**
 * Process KEYVALUEJSON resources from scratch-help on transifex
 * Category and Folder names are stored as plain json
 * @param  {object}  resource Transifex resource json for either CategoryNames or FolderNames
 * @param  {string}  locale   locale to pull and submit to Freshdesk
 * @return {Promise}          [description]
 */
exports.localizeNames = async (resource, locale) => {
    txPull(TX_PROJECT, resource.slug, locale, {mode: 'default'})
        .then(data => {
            serializeNameSave(data, resource, locale);
        })
        .catch((e) => {
            process.stdout.write(`Error saving ${resource.slug}, ${locale}: ${e.message}\n`);
            process.exitCode = 1; // not ok
        });
};


const BATCH_SIZE = 2;
/*
 * save resource items in batches to reduce rate limiting errors
 * @param  {object}  item      Transifex resource json, used for 'slug'
 * @param  {array}  languages  Array of languages to save
 * @param  {function}  saveFn  Async function to use to save the item
 * @return {Promise}
 */
exports.saveItem = async (item, languages, saveFn) => {
    const saveLanguages = languages.filter(l => l !== 'en'); // exclude English from update
    let batchedPromises = Promise.resolve(); // eslint-disable-line no-undef
    for (let i = 0; i < saveLanguages.length; i += BATCH_SIZE) {
        batchedPromises = batchedPromises
            .then(() => Promise.all( // eslint-disable-line
                saveLanguages.slice(i, i + BATCH_SIZE).map(l => saveFn(item, l))
            ))
            .catch(err => {
                process.stdout.write(`Error saving item:${err.message}\n${JSON.stringify(item, null, 2)}\n`);
                process.exitCode = 1; // not ok
            });
    }
};
