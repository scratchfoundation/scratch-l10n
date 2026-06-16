#!/usr/bin/env tsx
/**
 * @file
 * Script to validate extension block input placeholders
 */
import async from 'async'
import fs from 'fs'
import path from 'path'
import locales from '../src/supported-locales.mjs'
import { TransifexStringsKeyValueJson } from './lib/transifex-formats.mts'
import { missingBracketPlaceholders } from './lib/validate.mts'

// Globals
const JSON_DIR = path.join(process.cwd(), '/editor/extensions')

const source = JSON.parse(fs.readFileSync(`${JSON_DIR}/en.json`, 'utf8')) as TransifexStringsKeyValueJson

let numTotalErrors = 0

/**
 * @param translationData - the translation data to validate
 * @param locale - validate extension inputs for this locale
 */
const validateExtensionInputs = (translationData: TransifexStringsKeyValueJson, locale: string) => {
  let numLocaleErrors = 0
  for (const block of Object.keys(translationData)) {
    // Report every missing input at once rather than failing on the first, so a single run surfaces all the work.
    for (const input of missingBracketPlaceholders(translationData[block], source[block])) {
      numLocaleErrors++
      console.error(
        `Block '${block}' in locale '${locale}' does not include input ${input}:\n${translationData[block]}\n`,
      )
    }
  }

  if (numLocaleErrors > 0) {
    numTotalErrors += numLocaleErrors
    throw new Error(`${numLocaleErrors} total error(s) for locale '${locale}'`)
  }
}

/**
 * @param locale - the Transifex ID of the locale
 * @param callback - completion callback
 */
const validate = (locale: string, callback: async.ErrorCallback<Error>) => {
  fs.readFile(`${JSON_DIR}/${locale}.json`, 'utf8', (err, data) => {
    if (err) callback(err)
    // let this throw an error if invalid json
    const parsedData = JSON.parse(data) as TransifexStringsKeyValueJson

    try {
      validateExtensionInputs(parsedData, locale)
    } catch (error) {
      console.error((error as Error).message + '\n')
    }

    callback()
  })
}

async.each(Object.keys(locales), validate, err => {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  if (numTotalErrors > 0) {
    console.error(`${numTotalErrors} total extension input error(s)`)
    process.exit(1)
  }
})
