#!/usr/bin/env node

/**
 * @file
 * Utilities for interfacing with Transifex API 3.
 */

const transifexApi = require('@transifex/api').transifexApi
const download = require('download')

/**
 * @import {Collection, JsonApiResource} from '@transifex/api';
 */

const ORG_NAME = 'llk'
const SOURCE_LOCALE = 'en'

try {
  transifexApi.setup({
    auth: process.env.TX_TOKEN,
  })
} catch (err) {
  if (!process.env.TX_TOKEN) {
    throw new Error('TX_TOKEN is not defined.')
  }
  throw err
}

/*
 * The Transifex JS API wraps the Transifex JSON API, and is built around the concept of a `Collection`.
 * A `Collection` begins as a URL builder: methods like `filter` and `sort` add query parameters to the URL.
 * The `download` method doesn't actually download anything: it returns the built URL. It seems to be intended
 * primarily for internal use, but shows up in the documentation despite not being advertised in the .d.ts file.
 * The `download` method is mainly used to skip the `fetch` method in favor of downloading the resource yourself.
 * The `fetch` method sends a request to the URL and returns a promise that resolves to the first page of results.
 * If there's only one page of results, the `data` property of the collection object will be an array of all results.
 * However, if there are multiple pages of results, the `data` property will only contain the first page of results.
 * Previous versions of this code would unsafely assume that the `data` property contained all results.
 * The `all` method returns an async iterator that yields all results, fetching additional pages as needed.
 */

/**
 * Collects all resources from all pages of a potentially-paginated Transifex collection.
 * It's not necessary, but also not harmful, to call `fetch()` on the collection before calling this function.
 * @param {Collection} collection A collection of Transifex resources.
 * @returns {Promise<JsonApiResource[]>} An array of all resources in the collection.
 */
const collectAll = async function (collection) {
  await collection.fetch() // fetch the first page if it hasn't already been fetched
  const collected = []
  for await (const item of collection.all()) {
    collected.push(item)
  }
  return collected
}

/**
 * Creates a download event for a specific project, resource, and locale.
 * Returns the URL to download the resource.
 * @param {string} projectSlug - project slug (for example,  "scratch-editor")
 * @param {string} resourceSlug - resource slug (for example,  "blocks")
 * @param {string} localeCode - language code (for example,  "ko")
 * @param {string} mode - translation status of strings to include
 * @returns {Promise<string>} - URL to download the resource
 */
const getResourceLocation = async function (projectSlug, resourceSlug, localeCode, mode = 'default') {
  const resource = {
    data: {
      id: `o:${ORG_NAME}:p:${projectSlug}:r:${resourceSlug}`,
      type: 'resources',
    },
  }

  // if locale is English, create a download event of the source file
  if (localeCode === SOURCE_LOCALE) {
    return await transifexApi.ResourceStringsAsyncDownload.download({
      resource,
    })
  }

  const language = {
    data: {
      id: `l:${localeCode}`,
      type: 'languages',
    },
  }

  // if locale is not English, create a download event of the translation file
  return await transifexApi.ResourceTranslationsAsyncDownload.download({
    mode,
    resource,
    language,
  })
}

/**
 * Pulls a translation json from transifex, for a specific project, resource, and locale.
 * @param {string} project - project slug (for example,  "scratch-editor")
 * @param {string} resource - resource slug (for example,  "blocks")
 * @param {string} locale - language code (for example,  "ko")
 * @param {string} mode - translation status of strings to include
 * @returns {Promise<object>} - JSON object of translated resource strings (or, of the original resource
 * strings, if the local is the source language)
 */
const txPull = async function (project, resource, locale, mode = 'default') {
  let buffer
  try {
    const url = await getResourceLocation(project, resource, locale, mode)
    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        console.log(`Retrying txPull download after ${i} failed attempt(s)`)
      }
      try {
        buffer = await download(url) // might throw(?)
        break
      } catch (e) {
        console.error(e, { project, resource, locale, buffer })
      }
    }
    if (!buffer) {
      throw Error(`txPull download failed after 5 retries: ${url}`)
    }
    buffer = buffer.toString()
    return JSON.parse(buffer)
  } catch (e) {
    e.cause = {
      project,
      resource,
      locale,
      buffer,
    }
    throw e
  }
}

/**
 * Given a project, returns a list of the slugs of all resources in the project
 * @param {string} project - project slug (for example,  "scratch-website")
 * @returns {Promise<Array>} - array of strings, slugs identifying each resource in the project
 */
const txResources = async function (project) {
  const resources = transifexApi.Resource.filter({
    project: `o:${ORG_NAME}:p:${project}`,
  })

  const resourcesData = await collectAll(resources)

  const slugs = resourcesData.map(
    r =>
      // r.id is a longer id string, like "o:llk:p:scratch-website:r:about-l10njson"
      // We just want the slug that comes after ":r:" ("about-l10njson")
      r.id.split(':r:')[1],
  )
  return slugs
}

/**
 * @param {string} project - project slug (for example)
 * @returns {Promise<JsonApiResource[]>} - array of resource objects
 */
const txResourcesObjects = async function (project) {
  const resources = transifexApi.Resource.filter({
    project: `o:${ORG_NAME}:p:${project}`,
  })

  return collectAll(resources)
}

/**
 * Gets available languages for a project
 * @param {string} slug - project slug (for example, "scratch-editor")
 * @returns {Promise<string[]>} - list of language codes
 */
const txAvailableLanguages = async function (slug) {
  const project = await transifexApi.Project.get({
    organization: `o:${ORG_NAME}`,
    slug: slug,
  })

  const languages = await project.fetch('languages')
  const languagesData = await collectAll(languages)
  return languagesData.map(l => l.attributes.code)
}

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
      type: 'resources',
    },
  }

  await transifexApi.ResourceStringsAsyncUpload.upload({
    resource: resourceObj,
    content: JSON.stringify(sourceStrings),
  })
}

/**
 * Creates a new resource, and then uploads source strings to it if they are provided
 * @param {string} project - project slug (for example,  "scratch-editor")
 * @param {object} resource - object of resource information
 * @param {string} resource.slug - resource slug (for example,  "blocks")
 * @param {string} resource.name - human-readable name for the resource
 * @param {string} resource.i18nType - i18n format id
 * @param {object} resource.sourceStrings - json object of source strings
 */
const txCreateResource = async function (project, { slug, name, i18nType, sourceStrings }) {
  const i18nFormat = {
    data: {
      id: i18nType || 'KEYVALUEJSON',
      type: 'i18n_formats',
    },
  }

  const projectObj = {
    data: {
      id: `o:${ORG_NAME}:p:${project}`,
      type: 'projects',
    },
  }

  await transifexApi.Resource.create({
    attributes: { slug: slug, name: name },
    relationships: {
      i18n_format: i18nFormat,
      project: projectObj,
    },
  })

  if (sourceStrings) {
    await txPush(project, slug, sourceStrings)
  }
}

module.exports = { txPull, txPush, txResources, txResourcesObjects, txCreateResource, txAvailableLanguages }
