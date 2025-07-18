#!/usr/bin/env tsx
/**
 * @file
 * Script to pull scratch-help translations from transifex and push to FreshDesk.
 */
import { getInputs, saveItem, localizeFolder } from './lib/help-utils.mts'

const args = process.argv.slice(2)
const usage = `
 Pull knowledge base articles from transifex and push to FreshDesk. Usage:
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

const { languages, folders } = await getInputs()
console.log('Processing articles pulled from Transifex')
await Promise.all(folders.map(item => saveItem(item, languages, localizeFolder)))
