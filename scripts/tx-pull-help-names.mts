#!/usr/bin/env tsx
/**
 * @file
 * Script to pull scratch-help translations from transifex and push to FreshDesk.
 */
import { getInputs, saveItem, localizeNames } from './lib/help-utils.mts'

const args = process.argv.slice(2)

const usage = `
 Pull knowledge base category and folder names from transifex and push to FreshDesk. Usage:
   node tx-pull-help.js
   NOTE:
   FRESHDESK_TOKEN environment variable needs to be set to a FreshDesk API key with
   access to the Knowledge Base.
   TX_TOKEN environment variable needs to be set with a Transifex API token. See
   the Localization page on the GUI wiki for information about setting up Transifex.
 `
// Fail immediately if the API tokens are not defined, or there any argument
if (!process.env.TX_TOKEN || !process.env.FRESHDESK_TOKEN || args.length > 0) {
  process.stdout.write(usage)
  process.exit(1)
}

const { languages, names } = await getInputs()
console.log('Process Category and Folder Names pulled from Transifex')
await Promise.all(names.map(item => saveItem(item, languages, localizeNames)))
