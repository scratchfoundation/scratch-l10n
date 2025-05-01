#!/usr/bin/env node
/**
 * @file
 * Script to validate the translation json
 */
import async from 'async'
import fs from 'fs'
import path from 'path'
import { validateTranslations } from '../lib/validate.mjs'
import locales from '../src/supported-locales.mjs'

/**
 * @file
 * Script to validate the translation json
 */

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

const source = JSON.parse(fs.readFileSync(`${JSON_DIR}/en.json`))

const validate = (locale, callback) => {
  fs.readFile(`${JSON_DIR}/${locale}.json`, (err, data) => {
    if (err) callback(err)
    // let this throw an error if invalid json
    data = JSON.parse(data)
    const translations = {
      locale: locale,
      translations: data,
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
