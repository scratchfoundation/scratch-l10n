# scratch-l10n

Translation of all Scratch projects is managed on the Transifex service: https://www.transifex.com/llk/public

This repository collects translations submitted to the Scratch projects on Transifex. **Please do not submit PRs. If
you would like to contribute translations, please sign up to translate on Transifex.**

## Using scratch-l10n in development

### Basic Use

```js
import locales, {localeData, isRtl} from 'scratch-l10n';
import editorMessages from 'scratch-l10n/locales/editor-messages';
```

* `locales`: currently supported locales for the Scratch project
* `isRtl`: function that returns true if the locale is one that is written right-to-left
* `localeData`: locale data for the supported locales, in the format accepted by `addLocaleData` required by `react-intl`
* `editorMessages`: the actual message strings for all supported locales for a particular resource. `editorMessages`
  collects all the strings for the interface, extensions and paint-editor.

### Useful Scripts

scratch-l10n provides:

* `build-i18n-src`: script that uses babel and plugins to extract all `FormattedMessage` strings for translation.
  Combines the message from all the source files into one `en.json`
* `tx-push-src`: script to push the `en.json` file to Transifex. Requires that the environment variable `TX_TOKEN` is
  set with a value that has developer access to the Scratch projects on Transifex (i.e. Scratch Team only)

### Versioning

`scratch-l10n` uses semantic versioning - breaking changes will increment the major version number, and new features
(e.g. a new language) will increment the minor version number. Pulling new translations from Transifex is automated
and will increase the patch version.

### Deprecations

We are moving away from using the `tx` cli, so the `.tx/config` file will eventually be deprecated.

## Committing

This project uses [semantic release](https://github.com/semantic-release/semantic-release) to ensure version bumps
follow semver so that projects depending on it don't break unexpectedly.

In order to automatically determine version updates, semantic release expects commit messages to follow the
[conventional-changelog](https://github.com/bcoe/conventional-changelog-standard/blob/master/convention.md)
specification.

Here's a quick introduction:

* Prefix your commit subject with `fix:` if it fixes a bug but doesn't add any new functionality and doesn't change
  the API.
* Prefix your commit subject with `feat:` if it adds new functionality but maintains backwards compatibility.
* Include `BREAKING CHANGE:` as a footer in your commit body, or add `!` to the commit subject, if the change breaks
  compatibility with existing code.
* Other prefixes, such as `chore:`, `docs:`, etc., are allowed but will not change the version or cause a new release.
  These should only be used for changes that do not affect functionality.

### Example commit messages

For more examples, see the [conventional commits documentation](https://www.conventionalcommits.org/en/v1.0.0/#examples).

#### Fix

This will increase the `z` in `Version x.y.z`.

```text
fix: fix typo in the sandwich-making instructions
```

#### Feature

This will increase the `y` in `Version x.y.z` and reset `z` to 0.

```text
feat: add support for halloumi cheese
```

#### Breaking Change

Either of these will increase the `x` in `Version x.y.z` and reset `y` and `z` to 0.

```text
fix: refine our definition of a sandwich

BREAKING CHANGE: support for hot dogs has been removed as we no longer consider them sandwiches
```

```text
fix!: remove support for hot dogs as we no longer consider them sandwiches
```

### Commitizen

You can use the [commitizen CLI](https://github.com/commitizen/cz-cli) to make commits formatted in this way:

```bash
npm install -g commitizen@latest cz-conventional-changelog@latest
```

Now you're ready to make commits using `git cz`.
