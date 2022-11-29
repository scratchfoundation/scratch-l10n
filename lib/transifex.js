#!/usr/bin/env babel-node

/**
 * @fileoverview
 * Utilities for interfacing with Transifex API 3.
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
 * @returns {Promise<string>} - id of the created download event
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
 * @returns {Promise<object>} - JSON object of translated resource strings (or, of the original resourse
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
            process.stdout.write(`got ${e.message}, retrying after ${i + 1} failed attempt(s)\n`);
        }
    }
    throw Error('failed to pull after 5 retries');
};

/**
 * Given a project, returns a list of the slugs of all resources in the project
 * @param {string} project - project slug (for example,  "scratch-website")
 * @returns {Promise<array>} - array of strings, slugs identifying each resource in the project
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

/**
 * @param {string} project - project slug (for example)
 * @returns {object[]} - array of resource objects
 */
const txResourcesObjects = async function (project) {
    const resources = await transifexApi.Resource.filter({
        project: `o:${ORG_NAME}:p:${project}`
    });

    await resources.fetch();
    return resources.data;
};

/**
 * Gets available languages for a project
 * @param {string} slug - project slug (for example, "scratch-editor")
 * @returns {Promise<string[]>} - list of language codes
 */
const txAvailableLanguages = async function (slug) {
    const project = await transifexApi.Project.get({
        organization: `o:${ORG_NAME}`,
        slug: slug
    });

    const languages = await project.fetch('languages');
    await languages.fetch();
    return languages.data.map(l => l.attributes.code);

};

/**
 * Uploads English source strings to a resource in transifex
 * @param {string} project - project slug (for example,  "scratch-editor")
 * @param {string} resource - resource slug (for example,  "blocks")
 * @param {object} sourceStrings - json of source strings
 */
const txPush = async function (project, resource, sourceStrings) {
    const resourceObj = {
        data: {
            id: `o:${ORG_NAME}:p:${project}:r:${resource}`,
            type: 'resources'
        }
    };

    await transifexApi.ResourceStringsAsyncUpload.upload({
        resource: resourceObj,
        content: JSON.stringify(sourceStrings)
    });
};

/**
 * Creates a new resource, and then uploads source strings to it if they are provided
 * @param {string} project - project slug (for example,  "scratch-editor")
 * @param {object} resource - object of resource information
 * @param {string} resource.slug - resource slug (for example,  "blocks")
 * @param {string} resource.name - resource name
 * @param {string} resource.i18nType - i18n format id
 * @param {object} resource.sourceStrings - json object of source strings
 */
const txCreateResource = async function (project, {slug, name, i18nType, sourceStrings}) {
    const i18nFormat = {
        data: {
            id: i18nType || 'KEYVALUEJSON',
            type: 'i18n_formats'
        }
    };

    const projectObj = {
        data: {
            id: `o:${ORG_NAME}:p:${project}`,
            type: 'projects'
        }
    };

    await transifexApi.Resource.create({
        attributes: {slug: slug, name: name},
        relationships: {
            i18n_format: i18nFormat,
            project: projectObj
        }
    });

    if (sourceStrings) {
        await txPush(project, slug, sourceStrings);
    }
};

module.exports = {txPull, txPush, txResources, txResourcesObjects, txCreateResource, txAvailableLanguages};
