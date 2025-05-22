#!/usr/bin/env tsx
/**
 * @file
 * Script to validate the www translation json
 */
import async from 'async'
import fs from 'fs'
import glob from 'glob'
import path from 'path'
import locales from '../src/supported-locales.mjs'
import { TransifexStringsKeyValueJson, TransifexStrings } from './lib/transifex-formats.mts'
import { validateTranslations } from './lib/validate.mts'

const args = process.argv.slice(2)
const usage = `
 Validate translation json. Usage:
   node validate_www.mjs path
     path: root folder for all the www resource folders
 `
if (args.length < 1) {
  process.stdout.write(usage)
  process.exit(1)
}

// Globals
const WWW_DIR = path.resolve(args[0])
const RESOURCES = glob.sync(`${path.resolve(WWW_DIR)}/*`)

interface LocaleData {
  locale: string
  localeFileName: string
  sourceData: TransifexStrings<string>
}

const validate = (localeData: LocaleData, callback: async.ErrorCallback) => {
  fs.readFile(localeData.localeFileName, 'utf8', (err, data) => {
    if (err) callback(err)
    // let this throw an error if invalid json
    const strings = JSON.parse(data) as TransifexStringsKeyValueJson
    const translations = {
      locale: localeData.locale,
      translations: strings,
    }
    validateTranslations(translations, localeData.sourceData)
  })
}

const validateResource = (resource: string, callback: async.ErrorCallback) => {
  const source = JSON.parse(fs.readFileSync(`${resource}/en.json`, 'utf8')) as TransifexStringsKeyValueJson
  const allLocales = Object.keys(locales).map(loc => ({
    locale: loc,
    localeFileName: `${resource}/${loc}.json`,
    sourceData: source,
  }))
  async.each(allLocales, validate, err => {
    if (err) {
      callback(err)
    }
  })
}

async.each(RESOURCES, validateResource, err => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
})
