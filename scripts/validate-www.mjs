#!/usr/bin/env node
/**
 * @file
 * Script to validate the www translation json
 */
import async from 'async'
import fs from 'fs'
import glob from 'glob'
import path from 'path'
import { validateTranslations } from '../lib/validate.mjs'
import locales from '../src/supported-locales.mjs'

/**
 * @file
 * Script to validate the www translation json
 */

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

const validate = (localeData, callback) => {
  fs.readFile(localeData.localeFileName, (err, data) => {
    if (err) callback(err)
    // let this throw an error if invalid json
    data = JSON.parse(data)
    const translations = {
      locale: localeData.locale,
      translations: data,
    }
    validateTranslations(translations, localeData.sourceData)
  })
}

const validateResource = (resource, callback) => {
  const source = JSON.parse(fs.readFileSync(`${resource}/en.json`))
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
