### Resolves

- Resolves #

### Proposed Changes

_Describe what this Pull Request does_

## Checklist for updating translations

There are two situations in which we create manual PRs to update translations:

1. We don't want to wait for Travis's automatic weekly update; or,
2. We need to add a language that has become ready

### 1. Updating translations manually

* [ ] Pull translations from Transifex with `> npm run pull:editor`
* [ ] Test the result with `> npm run test`
* [ ] Confirm that you see changes to files like `editor/<resource>/<lang code>.json`

### Adding a language

* [ ] Edit `src/supported-locales.js`:
  * [ ] Add entry for the language in the `locales` const
  * [ ] Check if language is right-to-left. If so:
    * Add entry in `rtlLocales`

* [ ] Check if language needs a new locale (such as Brasilian Portuguese). If so:
  * [ ] Edit `src/supported-locales.js`:
    * Add new entry to `localeMap`. Format is `'<browser locale string>': '<Transifex locale string/ISO standard>'`
  * [ ] Edit `.tx/config`:
    * Add to the `lang_map` list. Format is `<Transifex locale string/ISO standard>:<browser locale string>`
    * NOTE: we are moving away from using the `tx` cli; `.tx/config` will eventually be deprecated

* [ ] Edit `src/index.js`:
  * [ ] Add 'import' line and export line
  * [ ] Add entry in `localeData` array

* [ ] check if locale is in `react-intl`
  * Look in [https://unpkg.com/react-intl/locale-data/](https://unpkg.com/react-intl/locale-data/)
  * If not in `react-intl`:
    * [ ] Edit `src/supported-locales.js`:
      * In `customLocales`, add entry with parent set to a `react-intl` locale
    * [ ] Edit `src/index.js`:
      * In `localeData`, add entry for parent locale

* [ ] update translations per the "Updating translations" section above
* [ ] Confirm that we see changes to:
    * [ ] `src/supported-locales.js`
    * [ ] `src/index.js`
    * [ ] `.tx/config` (if language needed a new locale)
    * [ ] Multiple files like `editor/<resource>/<lang code>.json`
