#!/usr/bin/env tsx
/**
 * @file
 * Script to pull translations from transifex and generate the editor-msgs file.
 * Expects that the project and resource have already been defined in Transifex, and that
 * the person running the script has the the TX_TOKEN environment variable set to an api
 * token that has developer access.
 */
import fs from 'fs'
import path from 'path'
import locales, { localeMap } from '../src/supported-locales.mjs'
import { poolMap } from './lib/concurrent.mts'
import { TransifexStringsKeyValueJson } from './lib/transifex-formats.mts'
import { txPull } from './lib/transifex.mts'
import { TransifexEditorStrings, validateTranslations } from './lib/validate.mts'

const args = process.argv.slice(2)

const usage = `
 Pull supported language translations from Transifex. Usage:
   node tx-pull-editor.js tx-project tx-resource path
     tx-project: project on Transifex (e.g., scratch-editor)
     tx-resource: resource within the project (e.g., interface)
     path: where to put the downloaded json files
   NOTE: TX_TOKEN environment variable needs to be set with a Transifex API token. See
   the Localization page on the GUI wiki for information about setting up Transifex.
 `

// Fail immediately if the TX_TOKEN is not defined
if (!process.env.TX_TOKEN || args.length < 3) {
  process.stdout.write(usage)
  process.exit(1)
}

// Globals
const PROJECT = args[0]
const RESOURCE = args[1]
const OUTPUT_DIR = path.resolve(args[2])
const MODE = 'reviewed'
const CONCURRENCY_LIMIT = 36

const getLocaleData = async function (locale: string) {
  const txLocale = localeMap[locale] || locale
  const data = (await txPull(PROJECT, RESOURCE, txLocale, MODE)) as TransifexEditorStrings
  return {
    locale: locale,
    translations: data,
  }
}

const pullTranslations = async function () {
  const values = await poolMap(Object.keys(locales), CONCURRENCY_LIMIT, getLocaleData)
  const source = values.find(elt => elt.locale === 'en')?.translations
  if (!source) {
    throw new Error('Could not find source strings')
  }
  values.forEach(translation => {
    validateTranslations({ locale: translation.locale, translations: translation.translations }, source)
    // if translation has message & description, we only want the message
    const txs: TransifexStringsKeyValueJson = {}
    for (const key of Object.keys(translation.translations)) {
      const tx = translation.translations[key]
      if (typeof tx === 'string') {
        txs[key] = tx
      } else {
        txs[key] = tx.message
      }
    }
    const file = JSON.stringify(txs, null, 4)
    fs.writeFileSync(`${OUTPUT_DIR}/${translation.locale}.json`, file)
  })
}

await pullTranslations()
