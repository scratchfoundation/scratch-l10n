#!/usr/bin/env tsx
/**
 * @file
 * Script to validate the translation json
 */
import async from 'async'
import fs from 'fs'
import path from 'path'
import locales from '../src/supported-locales.mjs'
import { TransifexEditorStrings, validateTranslations } from './lib/validate.mts'

const args = process.argv.slice(2)
const usage = `
 Validate translation json. Usage:
   node validate_translations.mjs path
     path: where to find the downloaded json files
 `
// Fail immediately if the TX_TOKEN is not defined
if (args.length < 1) {
  process.stdout.write(usage)
  process.exit(1)
}

// Globals
const JSON_DIR = path.resolve(args[0])

const source = JSON.parse(fs.readFileSync(`${JSON_DIR}/en.json`, 'utf8')) as TransifexEditorStrings

const validate = (locale: string, callback: async.ErrorCallback) => {
  fs.readFile(`${JSON_DIR}/${locale}.json`, 'utf8', (err, data) => {
    if (err) callback(err)
    // let this throw an error if invalid json
    const strings = JSON.parse(data) as TransifexEditorStrings
    const translations = {
      locale: locale,
      translations: strings,
    }
    validateTranslations(translations, source)
  })
}

async.each(Object.keys(locales), validate, err => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
