#!/usr/bin/env babel-node

/**
 * @fileoverview
 * Utilities for interfacing with Transifex API 3.
 * TODO: add functions for pushing to Transifex
 */

const transifexApi = require('@transifex/api').transifexApi;
const download = require('download');

const ORG_NAME = 'llk';
const SOURCE_LOCALE = 'en';

try {
    transifexApi.setup({
        auth: process.env.TX_TOKEN
    });
} catch (err) {
    if (!process.env.TX_TOKEN) {
        throw new Error('TX_TOKEN is not defined.');
    }
    throw err;
}

/**
 * Creates a download event for a specific project, resource, and locale.
 * @param {string} projectSlug - project slug (for example,  "scratch-editor")
 * @param {string} resourceSlug - resource slug (for example,  "blocks")
 * @param {string} localeCode - language code (for example,  "ko")
 * @param {string} mode - translation status of strings to include
 * @returns {string} - id of the created download event
 */
const downloadResource = async function (projectSlug, resourceSlug, localeCode, mode = 'default') {
    const resource = {
        data: {
            id: `o:${ORG_NAME}:p:${projectSlug}:r:${resourceSlug}`,
            type: 'resources'
        }
    };

    // if locale is English, create a download event of the source file
    if (localeCode === SOURCE_LOCALE) {
        return await transifexApi.ResourceStringsAsyncDownload.download({
            resource
        });
    }

    const language = {
        data: {
            id: `l:${localeCode}`,
            type: 'languages'
        }
    };

    // if locale is not English, create a download event of the translation file
    return await transifexApi.ResourceTranslationsAsyncDownload.download({
        mode,
        resource,
        language
    });
};

/**
 * Pulls a translation json from transifex, for a specific project, resource, and locale.
 * @param {string} project - project slug (for example,  "scratch-editor")
 * @param {string} resource - resource slug (for example,  "blocks")
 * @param {string} locale - language code (for example,  "ko")
 * @param {string} mode - translation status of strings to include
 * @returns {object} - JSON object of translated resource strings (or, of the original resourse
 * strings, if the local is the source language)
 */
const txPull = async function (project, resource, locale, mode = 'default') {
    const url = await downloadResource(project, resource, locale, mode);
    let buffer;
    for (let i = 0; i < 5; i++) {
        try {
            buffer = await download(url);
            return JSON.parse(buffer.toString());
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(`got ${e.message}, retrying after ${i + 1} failed attempt(s)`);
        }
    }
    throw Error('failed to pull after 5 retries');
};

/**
 * Given a project, returns a list of the slugs of all resources in the project
 * @param {string} project - project slug (for example,  "scratch-website")
 * @returns {array} - array of strings, slugs identifying each resource in the project
 */
const txResources = async function (project) {
    const resources = await transifexApi.Resource.filter({
        project: `o:${ORG_NAME}:p:${project}`
    });

    await resources.fetch();

    const slugs = resources.data.map(r =>
        // r.id is a longer id string, like "o:llk:p:scratch-website:r:about-l10njson"
        // We just want the slug that comes after ":r:" ("about-l10njson")
        r.id.split(':r:')[1]
    );
    return slugs;
};

module.exports = {txPull, txResources};
