#!/usr/bin/env node
/**
 * @file
 * Script to pull www translations from transifex for all resources.
 * Expects that the project and that the person running the script
 * has the the TX_TOKEN environment variable set to an api
 * token that has developer access.
 */
import fs from 'fs/promises'
import mkdirp from 'mkdirp'
import path from 'path'
import { batchMap } from '../lib/batch.js'
import { ProgressLogger } from '../lib/progress-logger.mjs'
import { txPull, txResources } from '../lib/transifex.js'
import locales, { localeMap } from '../src/supported-locales.mjs'

/**
 * @file
 * Script to pull www translations from transifex for all resources.
 * Expects that the project and that the person running the script
 * has the the TX_TOKEN environment variable set to an api
 * token that has developer access.
 */

const args = process.argv.slice(2)

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
 `
// Fail immediately if the TX_TOKEN is not defined
if (!process.env.TX_TOKEN || args.length < 1) {
  process.stdout.write(usage)
  process.exit(1)
}

// Globals
const PROJECT = 'scratch-website'
const OUTPUT_DIR = path.resolve(args[0])
// const MODE = {mode: 'reviewed'}; // default is everything for www
const CONCURRENCY_LIMIT = 36

const lang = args.length === 2 ? args[1] : ''

const getLocaleData = async function (item) {
  const locale = item.locale
  const resource = item.resource
  const txLocale = localeMap[locale] || locale

  const translations = await txPull(PROJECT, resource, txLocale)

  const txOutdir = `${OUTPUT_DIR}/${PROJECT}.${resource}`
  const fileName = `${txOutdir}/${locale}.json`

  try {
    mkdirp.sync(txOutdir)
    await fs.writeFile(fileName, JSON.stringify(translations, null, 4))

    return {
      resource,
      locale,
      fileName,
    }
  } catch (e) {
    e.cause = {
      resource,
      locale,
      translations,
      txOutdir,
      fileName,
    }
    throw e
  }
}

const expandResourceFiles = resources => {
  const items = []
  for (const resource of resources) {
    if (lang) {
      items.push({ resource: resource, locale: lang })
    } else {
      for (const locale of Object.keys(locales)) {
        items.push({ resource: resource, locale: locale })
      }
    }
  }
  return items
}

const pullTranslations = async function () {
  const resources = await txResources(PROJECT)
  const allFiles = expandResourceFiles(resources)

  const progress = new ProgressLogger(allFiles.length)

  try {
    await batchMap(allFiles, CONCURRENCY_LIMIT, async item => {
      try {
        await getLocaleData(item)
      } finally {
        progress.increment()
      }
    })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

pullTranslations()
