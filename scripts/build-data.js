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

Missing locales are ignored, react-intl will use the default messages for them.
 */
import * as fs from 'fs';
import * as path from 'path';
import {sync as mkdirpSync} from 'mkdirp';
import locales from '../src/supported-locales.js';

const MSGS_DIR = './locales/';
let missingLocales = [];

// generate messages:
let components = ['gui', 'paint', 'pen'];
components.forEach((component) => {
    let messages = Object.keys(locales).reduce((collection, lang) => {
        let langMessages = {};
        try {
            let langData = JSON.parse(
                fs.readFileSync(path.resolve(component, lang + '.json'), 'utf8')
            );
            Object.keys(langData).forEach((id) => {
                langMessages[id] = langData[id].message;
            });
            collection[lang] = {
                messages: langMessages
            };
        } catch (e) {
            missingLocales.push(lang);
        }
        return collection;
    }, {});

    mkdirpSync(MSGS_DIR);
    let data =
        '// GENERATED FILE:\n' +
        'const ' + component + 'Msgs = ' +
        JSON.stringify(messages, null, 2) +
        '\nexports.messages = ' + component + 'Msgs;\n';
    fs.writeFileSync(MSGS_DIR + component + '-msgs.js', data);

    if (missingLocales.length > 0) {
        process.stdout.write('missing locales: ' + missingLocales.toString());
        process.exit(1);
    }
});
