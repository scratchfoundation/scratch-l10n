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
import { pullAndValidateProject } from './lib/pull-and-validate.mts'

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

const validationResults = await pullAndValidateProject({
  project: PROJECT,
  resources: [RESOURCE],
  mode: MODE,
})

for (const resource of Object.values(validationResults.allStrings)) {
  for (const [locale, strings] of Object.entries(resource)) {
    const file = JSON.stringify(strings, null, 4)
    fs.writeFileSync(`${OUTPUT_DIR}/${locale}.json`, file)
  }
}

if (validationResults.messages.length > 0) {
  console.error(validationResults.messages.join('\n\n'))
}
