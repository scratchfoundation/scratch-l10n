#!/usr/bin/env babel-node

/**
 * @fileoverview
 * Utilities for interfacing with Transifex API 3.
 * TODO: add functions for pushing to Transifex
 */

import {transifexApi} from '@transifex/api';
import download from 'download';

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

const timeout = async function (ms) {
    return new Promise(r => setTimeout(r, ms)); // eslint-disable-line no-undef
};

/**
 * Wait until a download is ready, and then get the location of the file to download.
 * In order to do this, we need to check the download status until it 303s. Once it 303s,
 * we can get the download location from the header.
 * @param {*} downloadEventId - id of the transifex download event
 * @param {*} isSourceLocale - whether the locale is the same as the source locale
 * @returns {string} - url of file that is ready to download
 */
const getDownloadFileLocation = async function (downloadEventId, isSourceLocale) {
    const statusEndpoint = isSourceLocale ?
        transifexApi.ResourceStringAsyncDownload :
        transifexApi.ResourceTranslationAsyncDownload;

    let waitMs = 100;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const downloadStatus = await statusEndpoint.get(downloadEventId);

            if (downloadStatus.attributes.status === 'failed') {
                if (downloadStatus.attributes.errors.length() > 0) {
                    throw new Error(downloadStatus.attributes.errors);
                }
                throw new Error('Error downloading file');
            }

            /** If there is no error from getting the status, the download is still pending.
            Wait before trying again. **/
            await timeout(waitMs);

            // exponentially increase wait time
            waitMs = waitMs * 2;
        } catch (err) {
            /** status 303 means the download event is complete and the
            resource can be downloaded at the location uri. **/
            if (err.response.status === 303) {
                return err.response.headers.location;
            }
            throw err;
        }
    }
};

/**
 * Given a download event id, waits for the event to complete and then downloads the file
 * @param {string} downloadEventId - id of the transifex download event
 * @param {boolean} isSourceLocale - whether the locale is the same as the source locale
 * @returns {object} - buffer of downloaded file
 */
const downloadFile = async function (downloadEventId, isSourceLocale) {
    const location = await getDownloadFileLocation(downloadEventId, isSourceLocale);
    return await download(location);
};

/**
 * Creates a download event for a specific project, resource, and locale.
 * @param {string} projectSlug - project slug (for example,  "scratch-editor")
 * @param {string} resourceSlug - resource slug (for example,  "blocks")
 * @param {string} localeCode - language code (for example,  "ko")
 * @param {string} mode - translation status of strings to include (defaults to "reviewed")
 * @returns {string} - id of the created download event
 */
const createDownloadEvent = async function (projectSlug, resourceSlug, localeCode, mode) {
    const resource = {
        data: {
            id: `o:${ORG_NAME}:p:${projectSlug}:r:${resourceSlug}`,
            type: 'resources'
        }
    };

    // if locale is English, create a download event of the source file
    if (localeCode === SOURCE_LOCALE) {
        const sourceDownloadEvent = await transifexApi.ResourceStringAsyncDownload.create({
            attributes: {file_type: 'default'},
            relationships: {resource}
        });

        return sourceDownloadEvent.id;
    }

    const language = {
        data: {
            id: `l:${localeCode}`,
            type: 'languages'
        }
    };

    // if locale is not English, create a download event of the translation file
    const downloadEvent = await transifexApi.ResourceTranslationAsyncDownload.create({
        attributes: {mode: mode},
        relationships: {resource, language}
    });
   
    return downloadEvent.id;
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
    try {
        const downloadId = await createDownloadEvent(project, resource, locale, mode);
        const buffer = await downloadFile(downloadId, locale === SOURCE_LOCALE);
        return JSON.parse(buffer.toString());
    } catch (err) {
        if (err.statusCode === 409) {
            throw new Error({statusCode: 409, message: 'translation does not exist for ' + locale});
        }
        throw err;
    }
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

export {txPull, txResources};
