### Resolves

- Resolves #

### Proposed Changes

_Describe what this Pull Request does_

## Checklist for updating translations

There are two situations in which we create manual PRs to update translations:

1. We don't want to wait for Travis's automatic weekly update; or,
2. We need to add a language that has become ready

### 1. Updating translations manually

* [ ] Pull editor translations from Transifex with `> npm run pull:editor`
* [ ] Pull www translations from Transifex with `> npm run pull:www`
* [ ] Test the result with `> npm run test`
* [ ] Confirm that you see changes to files like `editor/<resource>/<lang code>.json`

### Adding a language

* [ ] Edit `src/supported-locales.js`:
  * [ ] Add entry for the language in the `locales` const
  * [ ] Check if language is right-to-left. If so:
    * Add entry in `rtlLocales`

* [ ] Check if the new language uses a country code
  * Check [https://www.transifex.com/explore/languages](https://www.transifex.com/explore/languages). If the language has a country code:
  * [ ] Edit `src/supported-locales.js`:
    * Add new entry to `localeMap`. Format is `'<W3C HTML browser locale string>': '<Transifex ICU locale string>'`
  * [ ] Edit `.tx/config`:
    * Add to the `lang_map` list. Format is `<Transifex ICU locale string>:<W3C HTML browser locale string>`
    * NOTE: we are moving away from using the `tx` cli; `.tx/config` will eventually be deprecated

* [ ] Edit `src/index.js`:
  * [ ] Add 'import' line
  * [ ] Add entry in `localeData` array

* [ ] Check if locale is in `react-intl`
  * Look in [https://unpkg.com/react-intl/locale-data/](https://unpkg.com/react-intl/locale-data/)
  * If not in `react-intl`:
    * [ ] Edit `src/supported-locales.js`:
      * In `customLocales`, add entry with parent set to a `react-intl` locale
    * [ ] Edit `src/index.js`:
      * In `localeData`, add entry for parent locale

* [ ] Update translations per the "Updating translations" section above
* [ ] Confirm that we see changes to:
    * [ ] `src/supported-locales.js`
    * [ ] `src/index.js`
    * [ ] `.tx/config` (if language needed a new locale)
    * [ ] Multiple files like `editor/<resource>/<lang code>.json`

* [ ] Bump minor version number in `package.json`

* [ ] **Add language po files to scratchr2_translations**
    * manually update `scratchr2_translations/legacy` with `tx pull -l <locale>` and check in changes

* [ ] **Add language to scratchr2 settings**
    * manually update `settings/base.py` with the new language

#### After scratch-l10n update is published:
* [ ] **Update scratch-blocks dependency**
    * [ ] in `package.json`, update the version of the scratch-l10n dependency to the version number you used above
    * [ ] pull translations so that a new `Blockly.ScratchMsgs.locales["<LOCALE CODE>"]` is added to `msg/scratch_msgs.js`
