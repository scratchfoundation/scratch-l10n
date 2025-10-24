import locales, { localeMap } from '../../src/supported-locales.mjs'
import { poolMap } from './concurrent.mts'
import { ProgressLogger } from './progress-logger.mts'
import { TransifexStringsKeyValueJson } from './transifex-formats.mts'
import { txPull, txResources } from './transifex.mts'
import { filterInvalidTranslations, TransifexEditorString } from './validate.mts'

const CONCURRENCY_LIMIT = 36
const SOURCE_LOCALE = 'en' // TODO: don't hardcode this

/**
 * @param resources - A list of Transifex resource names
 * @param selectedLocales - A list of Scratch locale codes
 * @returns The list of all resource/locale combinations to pull. The source locale is always excluded.
 */
const expandResourceFiles = (resources: string[], selectedLocales: string[]) => {
  const files = []
  for (const resource of resources) {
    for (const locale of selectedLocales) {
      if (locale === SOURCE_LOCALE) {
        continue
      }
      files.push({ resource: resource, locale: locale })
    }
  }
  return files
}

/**
 * Pull and validate a single Transifex "file" (resource + locale).
 * @param o - The options for pulling and validating a single file.
 * @param o.allStrings - All pulled strings so far, used to get source strings for validation
 * @param o.project - The Transifex project to pull from
 * @param o.resource - The Transifex resource to pull from
 * @param o.locale - The locale to pull
 * @param o.mode - The mode to use when pulling (e.g., "reviewed")
 * @returns A list of messages about errors encountered during validation, if any.
 */
async function pullAndValidateFile({
  allStrings,
  project,
  resource,
  locale,
  mode,
}: {
  allStrings: Record<string, Record<string, TransifexStringsKeyValueJson>>
  project: string
  resource: string
  locale: string
  mode?: string
}) {
  const messages: string[] = []
  const txLocale = localeMap[locale] || locale
  const fileContent = await txPull<TransifexEditorString>(project, resource, txLocale, mode)

  // if fileContent has message & description, we only want the message
  const translations: TransifexStringsKeyValueJson = {}
  for (const key of Object.keys(fileContent)) {
    const tx = fileContent[key]
    if (typeof tx === 'string') {
      translations[key] = tx
    } else {
      translations[key] = tx.message
    }
  }

  if (!(resource in allStrings)) {
    allStrings[resource] = {}
  }
  allStrings[resource][locale] = translations

  // may or may not be the same as `translations`
  const sourceStrings = allStrings[resource][SOURCE_LOCALE]

  // some of the validation checks may still be relevant even if locale === SOURCE_LOCALE
  // console.log({ resource, locale, translations, sourceStrings })
  messages.push(...filterInvalidTranslations(locale, translations, sourceStrings))

  return messages
}

/**
 * Pull one or more resource(s) from a transifex project and validate the strings.
 * Return any error messages from the validation process along with all valid strings.
 * @param o - The options for pulling, validating, and saving translations.
 * @param o.project - The Transifex project to pull translations from.
 * @param o.mode - The mode to use when pulling translations (e.g., "reviewed").
 * @param o.resources - The resources within the project to pull translations for.
 * @param o.selectedLocales - The locales to pull translations for. Defaults to all supported locales.
 * @returns Translation strings and a list of messages about errors encountered during validation, if any.
 */
export async function pullAndValidateProject({
  project,
  resources,
  mode,
  selectedLocales,
}: {
  project: string
  mode?: string
  resources?: string[]
  selectedLocales?: string | string[]
}) {
  const selectedResources = resources ?? (await txResources(project))
  selectedLocales =
    typeof selectedLocales === 'string' ? [selectedLocales] : (selectedLocales ?? Object.keys(locales))

  const files = expandResourceFiles(selectedResources, selectedLocales)

  const allStrings: Record<string, Record<string, TransifexStringsKeyValueJson>> = {}
  const messages: string[] = []

  const progress = new ProgressLogger(selectedResources.length + files.length)

  const handleFile = async (resource: string, locale: string) => {
    try {
      const fileMessages = await pullAndValidateFile({
        allStrings,
        project,
        resource,
        locale,
        mode,
      })
      for (const message of fileMessages) {
        // `fileMessage` already contains locale and/or string info if appropriate
        messages.push(`resource ${resource} / ${message}`)
      }
    } finally {
      progress.increment()
    }
  }

  // Ensure source locale is available for validation
  await poolMap(selectedResources, CONCURRENCY_LIMIT, async resource => handleFile(resource, SOURCE_LOCALE))

  // Non-source locales
  await poolMap(files, CONCURRENCY_LIMIT, async ({ resource, locale }) => handleFile(resource, locale))

  return {
    allStrings,
    messages,
  }
}
