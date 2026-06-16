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
import { TransifexEditorStrings } from './lib/validate.mts'

const args = process.argv.slice(2)

const usage = `
 Pull supported language translations from Transifex. Usage:
   node tx-pull-editor.js tx-project tx-resource:path [tx-resource:path ...]
     tx-project: project on Transifex (e.g., scratch-editor)
     tx-resource: resource within the project (e.g., interface)
     path: where to put the downloaded json files for that resource
   Multiple resource:path pairs may be given; they are pulled in a single pass so that one resource's validation
   failures do not prevent the others from being saved.
   NOTE: TX_TOKEN environment variable needs to be set with a Transifex API token. See
   the Localization page on the GUI wiki for information about setting up Transifex.
 `

// Fail immediately if the TX_TOKEN is not defined
if (!process.env.TX_TOKEN || args.length < 2) {
  process.stdout.write(usage)
  process.exit(1)
}

// Globals
const PROJECT = args[0]
const MODE = 'reviewed'

// Resources whose bracket tokens (e.g. `[PART]`) are block input placeholders that must be preserved verbatim.
const BRACKET_PLACEHOLDER_RESOURCES = ['extensions']

// Parse the resource:path pairs. Split on the first ':' so paths with their own colons survive.
const outputDirByResource: Record<string, string> = {}
for (const arg of args.slice(1)) {
  const separator = arg.indexOf(':')
  if (separator < 0) {
    process.stdout.write(usage)
    process.exit(1)
  }
  outputDirByResource[arg.slice(0, separator)] = path.resolve(arg.slice(separator + 1))
}
const resources = Object.keys(outputDirByResource)

const validationResults = await pullAndValidateProject({
  project: PROJECT,
  resources,
  mode: MODE,
  bracketPlaceholderResources: BRACKET_PLACEHOLDER_RESOURCES,
  // The previous translation is whatever is currently on disk, read before we overwrite it below.
  loadPrevious: (resource, locale) => {
    try {
      return JSON.parse(
        fs.readFileSync(`${outputDirByResource[resource]}/${locale}.json`, 'utf8'),
      ) as TransifexEditorStrings
    } catch {
      return undefined
    }
  },
})

for (const [resource, localeStrings] of Object.entries(validationResults.allStrings)) {
  for (const [locale, strings] of Object.entries(localeStrings)) {
    const file = JSON.stringify(strings, null, 4)
    fs.writeFileSync(`${outputDirByResource[resource]}/${locale}.json`, file)
  }
}

if (validationResults.messages.length > 0) {
  console.error(validationResults.messages.join('\n\n'))
}

// Good translations are always written above; signal failure (after saving) so the bad strings get fixed in Transifex.
if (validationResults.rejected > 0) {
  console.error(
    `\n${validationResults.rejected} translation(s) failed validation and were replaced with the previous ` +
      `translation or the source text. Fix them in Transifex.`,
  )
  process.exitCode = 1
}
