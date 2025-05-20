#!/usr/bin/env tsx
/**
 * @file
 * Script to validate extension block input placeholders
 */
import assert from 'assert'
import async from 'async'
import fs from 'fs'
import path from 'path'
import locales from '../src/supported-locales.mjs'
import { TransifexStringsKeyValueJson } from './lib/transifex-formats.mts'

// Globals
const JSON_DIR = path.join(process.cwd(), '/editor/extensions')

const source = JSON.parse(fs.readFileSync(`${JSON_DIR}/en.json`, 'utf8')) as TransifexStringsKeyValueJson

// Matches everything inside brackets, and the brackets themselves.
// e.g. matches '[MOTOR_ID]', '[POWER]' from 'altera a potência de [MOTOR_ID] para [POWER]'
const blockInputRegex = /\[.+?\]/g

let numTotalErrors = 0

/**
 * @param translationData - the translation data to validate
 * @param locale - validate extension inputs for this locale
 */
const validateExtensionInputs = (translationData: TransifexStringsKeyValueJson, locale: string) => {
  let numLocaleErrors = 0
  for (const block of Object.keys(translationData)) {
    const englishBlockInputs = source[block].match(blockInputRegex)

    if (!englishBlockInputs) continue

    // If null (meaning no matches), that means that English block inputs exist but translated ones don't.
    // Coerce it to an empty array so that the assertion below fails, instead of getting the less-helpful error
    // that we can't call Array.includes on null.
    const translatedBlockInputs: string[] = translationData[block].match(blockInputRegex) ?? []

    for (const input of englishBlockInputs) {
      // Currently there are enough errors here that it would be tedious to fix an error, rerun this tool
      // to find the next error, and repeat. So, catch the assertion error and add to the number of total errors.
      // This allows all errors to be displayed when the command is run, rather than just the first encountered.
      try {
        assert(
          translatedBlockInputs.includes(input),

          `Block '${block}' in locale '${locale}' does not include input ${input}:\n` + translationData[block],
        )
      } catch (err) {
        numLocaleErrors++
        console.error((err as Error).message + '\n')
      }
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
