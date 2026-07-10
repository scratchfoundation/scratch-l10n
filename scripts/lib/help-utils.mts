/**
 * @file
 * Helper functions for syncing Freshdesk knowledge base articles with Transifex
 */
import { promises as fsPromises } from 'fs'
import { mkdirp } from 'mkdirp'
import { messageOf } from './errors.mts'
import FreshdeskApi, {
  FreshdeskArticleCreate,
  FreshdeskArticleStatus,
  FreshdeskFolder,
  logAuthenticatedAgent,
} from './freshdesk-api.mts'
import { TransifexStringKeyValueJson, TransifexStringsKeyValueJson, TransifexStrings } from './transifex-formats.mts'
import { TransifexResourceObject } from './transifex-objects.mts'
import { txPull, txResourcesObjects, txAvailableLanguages } from './transifex.mts'
import { emitWarning } from './warnings.mts'

const FD = new FreshdeskApi('https://mitscratch.freshdesk.com', process.env.FRESHDESK_TOKEN ?? '')
const TX_PROJECT = 'scratch-help'

/**
 * Log which agent the configured Freshdesk token authenticates as, to aid in diagnosing permission
 * problems. Never throws.
 * @returns a promise that resolves once the agent has been logged
 */
export const logFreshdeskAgent = (): Promise<void> => logAuthenticatedAgent(FD)

const freshdeskLocale = (locale: string): string => {
  // map between Transifex locale and Freshdesk. Two letter codes are usually fine
  const localeMap: Record<string, string> = {
    es_419: 'es-LA',
    ja: 'ja-JP',
    'ja-Hira': 'ja-JP',
    lv: 'lv-LV',
    nb: 'nb-NO',
    nn: 'nb-NO',
    pt: 'pt-PT',
    pt_BR: 'pt-BR',
    ru: 'ru-RU',
    sv: 'sv-SE',
    zh_CN: 'zh-CN',
    zh_TW: 'zh-TW',
  }
  return localeMap[locale] || locale
}

/**
 * Parse a string into an integer.
 * If converting the integer back to a string does not result in the same string, throw.
 * @param str - The (allegedly) numeric string to parse
 * @param radix - Interpret the string as a number in this base. For example, use 10 for decimal values.
 * @returns The numeric value of the string
 */
const parseIntOrThrow = (str: string, radix: number) => {
  const num = parseInt(str, radix)
  if (str != num.toString(radix)) {
    throw new Error(`Could not parse int safely: ${str}`)
  }
  return num
}

/**
 * Pull metadata from Transifex for the scratch-help project
 * @returns Promise for a results object containing:
 * languages - array of supported languages
 * folders - array of tx resources corresponding to Freshdesk folders
 * names - array of tx resources corresponding to the Freshdesk metadata
 */
export const getInputs = async () => {
  const resourcesPromise = txResourcesObjects(TX_PROJECT)
  const languagesPromise = txAvailableLanguages(TX_PROJECT)

  // there are three types of resources differentiated by the file type
  const foldersPromise = resourcesPromise.then(resources =>
    resources.filter(resource => resource.attributes.i18n_type === 'STRUCTURED_JSON'),
  )
  const namesPromise = resourcesPromise.then(resources =>
    resources.filter(resource => resource.attributes.i18n_type === 'KEYVALUEJSON'),
  )
  // ignore the yaml type because it's not possible to update via API

  const [languages, folders, names] = await Promise.all([languagesPromise, foldersPromise, namesPromise])

  return {
    languages,
    folders,
    names,
  }
}

/**
 * Fetch the current set of valid category and folder IDs from Freshdesk.
 * Used to detect stale entries in Transifex that refer to deleted Freshdesk items.
 * @returns Promise for an object containing:
 * validCategoryIds - set of Freshdesk category IDs that currently exist
 * validFolderIds - set of Freshdesk folder IDs that currently exist
 */
export const getValidFreshdeskIds = async () => {
  const categories = await FD.listCategories()
  const categoriesWithId = categories.filter((c): c is typeof c & { id: number } => c.id !== undefined)
  const validCategoryIds = new Set(categoriesWithId.map(c => c.id))
  const fdFolders: FreshdeskFolder[] = []
  for (const category of categoriesWithId) {
    const folders = await FD.listFolders(category)
    fdFolders.push(...folders)
  }
  const validFolderIds = new Set(fdFolders.map(f => f.id).filter((id): id is number => id !== undefined))
  return { validCategoryIds, validFolderIds }
}

/**
 * internal function to serialize saving category and folder name translations to avoid Freshdesk rate limit
 * @param strings - the string data pulled from Transifex
 * @param resource - the `attributes` property of the resource object which contains these strings
 * @param locale - the Transifex locale code corresponding to these strings
 * @param validIds - set of Freshdesk IDs that currently exist; keys not in this set are skipped
 * @param warnedKeys - tracks which stale resource+ID combinations have already been reported, to avoid repeating the warning
 */
const serializeNameSave = async (
  strings: TransifexStringsKeyValueJson,
  resource: TransifexResourceObject,
  locale: string,
  validIds: Set<number>,
  warnedKeys: Set<string>,
): Promise<void> => {
  for (const [key, value] of Object.entries(strings)) {
    // Handle each entry independently: a failure on one item (for example a translation the token
    // is not allowed to write) must not abort the remaining names for this locale.
    try {
      // key is of the form <name>_<id>
      const words = key.split('_')
      const id = parseIntOrThrow(words[words.length - 1], 10)
      if (!validIds.has(id)) {
        const warnedKey = `${resource.attributes.name}:${id}`
        if (!warnedKeys.has(warnedKey)) {
          warnedKeys.add(warnedKey)
          emitWarning(
            `Warning: key "${key}" in Transifex resource "${resource.attributes.name}" refers to Freshdesk id ${id} which no longer exists. Remove this key from the Transifex resource.`,
          )
        }
        continue
      }
      let status
      if (resource.attributes.name === 'categoryNames_json') {
        status = await FD.updateCategoryTranslation(id, freshdeskLocale(locale), { name: value })
      } else if (resource.attributes.name === 'folderNames_json') {
        status = await FD.updateFolderTranslation(id, freshdeskLocale(locale), { name: value })
      } else {
        // Guard against silently dropping an unexpected resource: this function only knows how to
        // write category and folder names. A new KEYVALUEJSON names resource would otherwise no-op
        // while still reporting success.
        throw new Error(`Unexpected names resource "${resource.attributes.name}"; don't know how to save it`)
      }
      if (status === -1) {
        process.exitCode = 1
      }
    } catch (error) {
      // The FreshdeskApi update method already logged the specific error. Record the failure so the
      // job still exits non-zero, then move on to the next entry.
      process.stdout.write(
        `Failed to save an entry in ${resource.attributes.name} for ${locale} (key "${key}"): ${messageOf(error)}\n`,
      )
      process.exitCode = 1
    }
  }
}

/**
 * We use this specific structure in the `STRUCTUREDJSON` resources associated with our Freshdesk folders.
 * This should be compatible with (and stricter than) `TransifexStringStructuredJson`.
 */
interface FreshdeskFolderInTransifex {
  title: { string: string }
  description: { string: string }
  tags: { string: string }
}

/**
 * Internal function serialize Freshdesk requests to avoid getting rate limited
 * @param  json   object with keys corresponding to article ids
 * @param  locale language code
 * @returns a numeric status code
 */
const serializeFolderSave = async (json: TransifexStrings<FreshdeskFolderInTransifex>, locale: string) => {
  for (const [idString, value] of Object.entries(json)) {
    // Handle each article independently: a failure on one must not abort the rest for this locale.
    try {
      const id = parseIntOrThrow(idString, 10)
      const body: FreshdeskArticleCreate = {
        title: value.title.string,
        description: value.description.string,
        status: FreshdeskArticleStatus.published,
      }
      if (Object.prototype.hasOwnProperty.call(value, 'tags')) {
        const tags = value.tags.string.split(',')
        const validTags = tags.filter(tag => tag.length < 33)
        if (validTags.length !== tags.length) {
          emitWarning(`Warning: tags too long in ${id} for ${locale}`)
        }
        body.tags = validTags
      }
      const status = await FD.updateArticleTranslation(id, freshdeskLocale(locale), body)
      if (status === -1) {
        process.exitCode = 1
      }
    } catch (error) {
      // The FreshdeskApi update method already logged the specific error. Record the failure so the
      // job still exits non-zero, then move on to the next article.
      process.stdout.write(`Failed to save article ${idString} for ${locale}: ${messageOf(error)}\n`)
      process.exitCode = 1
    }
  }
}

/**
 * Process Transifex resource corresponding to a Knowledge base folder on Freshdesk
 * @param  folderAttributes Transifex resource json corresponding to a KB folder
 * @param  locale locale to pull and submit to Freshdesk
 */
export const localizeFolder = async (folderAttributes: TransifexResourceObject, locale: string) => {
  try {
    const data = await txPull<FreshdeskFolderInTransifex>(
      TX_PROJECT,
      folderAttributes.attributes.slug,
      locale,
      'default',
    )
    await serializeFolderSave(data, locale)
  } catch (e) {
    process.stdout.write(`Error processing ${folderAttributes.attributes.slug}, ${locale}: ${(e as Error).message}\n`)
    process.exitCode = 1 // not ok
  }
}

/**
 * Save Transifex resource corresponding to a Knowledge base folder locally for debugging
 * @param  folderAttributes Transifex resource json corresponding to a KB folder
 * @param  locale locale to pull and save
 */
export const debugFolder = async (folderAttributes: TransifexResourceObject, locale: string) => {
  await mkdirp('tmpDebug')
  await txPull(TX_PROJECT, folderAttributes.attributes.slug, locale, 'default')
    .then(data =>
      fsPromises.writeFile(
        `tmpDebug/${folderAttributes.attributes.slug}_${locale}.json`,
        JSON.stringify(data, null, 2),
      ),
    )
    .catch(e => {
      process.stdout.write(
        `Error processing ${folderAttributes.attributes.slug}, ${locale}: ${(e as Error).message}\n`,
      )
      process.exitCode = 1 // not ok
    })
}

/**
 * Process KEYVALUEJSON resources from scratch-help on transifex
 * Category and Folder names are stored as plain json
 * @param resource Transifex resource json for either CategoryNames or FolderNames
 * @param locale   locale to pull and submit to Freshdesk
 * @param validCategoryIds - set of Freshdesk category IDs that currently exist
 * @param validFolderIds - set of Freshdesk folder IDs that currently exist
 * @param warnedKeys - tracks which stale resource+ID combinations have already been reported, to avoid repeating the warning
 */
export const localizeNames = async (
  resource: TransifexResourceObject,
  locale: string,
  validCategoryIds: Set<number>,
  validFolderIds: Set<number>,
  warnedKeys: Set<string>,
): Promise<void> => {
  const validIds = resource.attributes.name === 'categoryNames_json' ? validCategoryIds : validFolderIds
  await txPull<TransifexStringKeyValueJson>(TX_PROJECT, resource.attributes.slug, locale, 'default')
    .then(data => serializeNameSave(data, resource, locale, validIds, warnedKeys))
    .catch(e => {
      process.stdout.write(`Error saving ${resource.attributes.slug}, ${locale}: ${(e as Error).message}\n`)
      process.exitCode = 1 // not ok
    })
}

const BATCH_SIZE = 2

type SaveFn = (item: TransifexResourceObject, language: string) => Promise<void>

/**
 * save resource items in batches to reduce rate limiting errors
 * @param item      Transifex resource json, used for 'slug'
 * @param languages  Array of languages to save
 * @param saveFn  Async function to use to save the item
 */
export const saveItem = async (item: TransifexResourceObject, languages: string[], saveFn: SaveFn) => {
  const saveLanguages = languages.filter(l => l !== 'en') // exclude English from update
  for (let i = 0; i < saveLanguages.length; i += BATCH_SIZE) {
    await Promise.all(saveLanguages.slice(i, i + BATCH_SIZE).map(l => saveFn(item, l))).catch(err => {
      process.stdout.write(`Error saving item:${(err as Error).message}\n${JSON.stringify(item, null, 2)}\n`)
      process.exitCode = 1 // not ok
    })
  }
}
