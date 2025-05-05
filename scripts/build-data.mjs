#!/usr/bin/env node
/*
Generates locales/<component>-msgs.js for each component (gui, etc) from  the
current translation files for each language for that component

Translation files are expected to be in Chrome i18n json format:
'''
{
    "message.id": {
        "message": "The translated text",
        "description": "Tips for translators"
    },
    ...
}
'''
They are named by locale, for example: 'fr.json' or 'zh-cn.json'

Converts the collection of translation files to a single set of messages.
Example output:
'''
{
  "en": {
    "action.addBackdrop": "Add Backdrop",
    "action.addCostume": "Add Costume",
    "action.recordSound": "Record Sound",
    "action.addSound": "Add Sound"
  },
  "fr": {
    "action.addSound": "Ajouter Son",
    "action.addCostume": "Ajouter Costume",
    "action.addBackdrop": "Ajouter Arrière-plan",
    "action.recordSound": "Enregistrement du Son"
  }
}
'''
NOTE: blocks messages are plain key-value JSON files

Missing locales are ignored, react-intl will use the default messages for them.
 */
import * as fs from 'fs'
import defaultsDeep from 'lodash.defaultsdeep'
import mkdirp from 'mkdirp'
import * as path from 'path'
import locales from '../src/supported-locales.mjs'

const MSGS_DIR = './locales/'
mkdirp.sync(MSGS_DIR)
const missingLocales = []

const combineJson = component =>
  Object.keys(locales).reduce((collection, lang) => {
    try {
      const langData = JSON.parse(fs.readFileSync(path.resolve('editor', component, lang + '.json'), 'utf8'))
      collection[lang] = langData
    } catch {
      missingLocales.push(component + ':' + lang + '\n')
    }
    return collection
  }, {})

// generate the blocks messages: files are plain key-value JSON
const blocksMessages = combineJson('blocks')
const blockData = '// GENERATED FILE:\n' + 'export default ' + JSON.stringify(blocksMessages, null, 2) + ';\n'

fs.writeFileSync(MSGS_DIR + 'blocks-msgs.js', blockData)

// generate messages for gui components - all files are plain key-value JSON
const components = ['interface', 'extensions', 'paint-editor']
const editorMsgs = {}
components.forEach(component => {
  const messages = combineJson(component)
  const data = '// GENERATED FILE:\n' + 'export default ' + JSON.stringify(messages, null, 2) + ';\n'
  fs.writeFileSync(MSGS_DIR + component + '-msgs.js', data)
  defaultsDeep(editorMsgs, messages)
})

// generate combined editor-msgs file
const editorData = '// GENERATED FILE:\n' + 'export default ' + JSON.stringify(editorMsgs, null, 2) + ';\n'
fs.writeFileSync(MSGS_DIR + 'editor-msgs.js', editorData)

if (missingLocales.length > 0) {
  process.stdout.write('missing locales:\n' + missingLocales.toString())
  process.exit(1)
}
