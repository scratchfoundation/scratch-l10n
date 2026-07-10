#!/usr/bin/env tsx
/**
 * @file
 * Script get Knowledge base articles from Freshdesk and push them to transifex.
 */
import FreshdeskApi, {
  FreshdeskArticleStatus,
  FreshdeskCategory,
  FreshdeskFolder,
  logAuthenticatedAgent,
} from './lib/freshdesk-api.mts'
import { TransifexStringsKeyValueJson, TransifexStringsStructuredJson } from './lib/transifex-formats.mts'
import { txPush, txCreateResource, JsonApiException } from './lib/transifex.mts'
import { emitWarning } from './lib/warnings.mts'

const args = process.argv.slice(2)

const usage = `
 Pull knowledge base articles from Freshdesk and push to scratch-help project on transifex. Usage:
   node tx-push-help.js
   NOTE:
   FRESHDESK_TOKEN environment variable needs to be set to a FreshDesk API key with
   access to the Knowledge Base.
   TX_TOKEN environment variable needs to be set with a Transifex API token. See
   the Localization page on the GUI wiki for information about setting up Transifex.
 `
// Fail immediately if the API tokens are not defined, or there any argument
if (!process.env.TX_TOKEN || !process.env.FRESHDESK_TOKEN || args.length > 0) {
  process.stdout.write(usage)
  process.exit(1)
}

const FD = new FreshdeskApi('https://mitscratch.freshdesk.com', process.env.FRESHDESK_TOKEN)
const TX_PROJECT = 'scratch-help'

const categoryNames: TransifexStringsKeyValueJson = {}
const folderNames: TransifexStringsKeyValueJson = {}

// Collect per-resource failures instead of aborting on the first one, so a single failing folder or
// category (for example one the token cannot access) still lets every other resource sync. The
// script fails at the end if anything meaningful failed, so a persistent problem is surfaced for
// investigation rather than silently dropped.
const failures: { context: string; message: string }[] = []
const recordFailure = (context: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Error: ${context}: ${message}`)
  failures.push({ context, message })
}

/**
 * Generate a transifex resource slug from the name and ID of a Freshdesk object.
 * Strips characters not allowed in Transifex slugs (only `[a-zA-Z0-9_-]` are permitted).
 * Transifex slugs have a max length of 50; use at most 30 characters of the name to leave
 * room for the Freshdesk ID and a suffix like '_json'.
 * @param item - data from Freshdesk that includes the name and ID of a category or folder
 * @param item.name - the name of the category or folder
 * @param item.id - the Freshdesk ID; always present on API responses despite the optional type
 * @returns generated transifex slug
 */
const makeTxSlug = (item: { name: string; id?: number }) => {
  if (item.id == null) throw new Error(`makeTxSlug: item has no id: ${item.name}`)
  return `${item.name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30)}_${item.id}`
}

const txPushResource = async (
  name: string,
  articles: TransifexStringsStructuredJson | TransifexStringsKeyValueJson,
  type: string,
) => {
  // Transifex rejects an upload with no extractable strings (`parse_error: No strings could be
  // extracted`). That used to leave the upload stuck in a non-`succeeded` state forever, hanging
  // the whole sync. An empty resource almost always means a Freshdesk folder with no published
  // articles, which is a content situation rather than a sync failure: warn and skip it.
  if (Object.keys(articles).length === 0) {
    emitWarning(`Skipping Transifex resource "${name}": no strings to push (empty content).`)
    return
  }

  const resourceData = {
    slug: name,
    name: name,
    i18nType: type,
    // `txCreateResource` reads `sourceStrings` (not `content`); passing the wrong key left a newly
    // created resource empty until a later run populated it.
    sourceStrings: articles,
  }

  try {
    await txPush(TX_PROJECT, name, articles)
  } catch (errUnknown) {
    const err = errUnknown as JsonApiException
    if (err.statusCode !== 404) {
      throw err
    }

    // file not found - create it, but also give message
    process.stdout.write(`Transifex Resource not found, creating: ${name}\n`)
    await txCreateResource(TX_PROJECT, resourceData)
  }
}

/**
 * get a flattened list of folders associated with the specified categories
 * @param categories - array of categories the folders belong to
 * @returns flattened list of folders from all requested categories
 */
const getFolders = async (categories: FreshdeskCategory[]): Promise<FreshdeskFolder[]> => {
  const categoryFolders = await Promise.all(
    categories.map(async (category): Promise<FreshdeskFolder[]> => {
      try {
        return await FD.listFolders(category)
      } catch (error) {
        recordFailure(`list folders for category "${category.name}" (id ${category.id})`, error)
        return []
      }
    }),
  )
  return categoryFolders.flat()
}

/**
 * Save articles in a particular folder
 * @param folder - The folder object
 */
const saveArticles = async (folder: FreshdeskFolder) => {
  try {
    const json = await FD.listArticles(folder)
    const txArticles = json.reduce((strings: TransifexStringsStructuredJson, current) => {
      if (current.status === FreshdeskArticleStatus.published) {
        strings[String(current.id)] = {
          title: {
            string: current.title,
          },
          description: {
            string: current.description,
          },
        }
        if (current.tags?.length) {
          strings[String(current.id)].tags = { string: current.tags.toString() }
        }
      }
      return strings
    }, {})
    process.stdout.write(`Push ${folder.name} articles to Transifex\n`)
    await txPushResource(`${makeTxSlug(folder)}_json`, txArticles, 'STRUCTURED_JSON')
  } catch (error) {
    recordFailure(`folder "${folder.name}" (id ${folder.id})`, error)
  }
}

/**
 * @param folders - Array of folders containing articles to be saved
 */
const saveArticleFolders = async (folders: FreshdeskFolder[]) => {
  await Promise.all(folders.map(folder => saveArticles(folder)))
}

const syncSources = async () => {
  await FD.listCategories()
    .then(json => {
      console.dir(json)
      // save category names for translation
      for (const cat of json.values()) {
        categoryNames[makeTxSlug(cat)] = cat.name
      }
      return json
    })
    .then(getFolders)
    .then(async data => {
      data.forEach(item => {
        folderNames[makeTxSlug(item)] = item.name
      })
      process.stdout.write('Push category and folder names to Transifex\n')
      await Promise.all([
        txPushResource('categoryNames_json', categoryNames, 'KEYVALUEJSON').catch(error =>
          recordFailure('categoryNames_json', error),
        ),
        txPushResource('folderNames_json', folderNames, 'KEYVALUEJSON').catch(error =>
          recordFailure('folderNames_json', error),
        ),
      ])
      return data
    })
    .then(saveArticleFolders)
}

await logAuthenticatedAgent(FD)
await syncSources()

if (failures.length > 0) {
  console.error(`\n${failures.length} resource(s) failed to push to Transifex:`)
  for (const failure of failures) {
    console.error(`  - ${failure.context}: ${failure.message}`)
  }
  process.exitCode = 1
}
