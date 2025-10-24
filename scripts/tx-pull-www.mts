#!/usr/bin/env tsx
/**
 * @file
 * Script to pull www translations from transifex for all resources.
 * Expects that the project and that the person running the script
 * has the the TX_TOKEN environment variable set to an api
 * token that has developer access.
 */
import fs from 'fs/promises'
import { mkdirp } from 'mkdirp'
import path from 'path'
import { pullAndValidateProject } from './lib/pull-and-validate.mts'

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

const lang = args.length === 2 ? args[1] : undefined
const validationResults = await pullAndValidateProject({
  project: PROJECT,
  selectedLocales: lang,
})

for (const [resourceName, resource] of Object.entries(validationResults.allStrings)) {
  for (const [locale, translations] of Object.entries(resource)) {
    const txOutdir = `${OUTPUT_DIR}/${PROJECT}.${resourceName}`
    const fileName = `${txOutdir}/${locale}.json`

    try {
      mkdirp.sync(txOutdir)
      await fs.writeFile(fileName, JSON.stringify(translations, null, 4))
    } catch (e) {
      ;(e as Error).cause = {
        resourceName,
        locale,
        translations,
        txOutdir,
        fileName,
      }
      throw e
    }
  }
}

if (validationResults.messages.length > 0) {
  console.error(validationResults.messages.join('\n\n'))
}
