#!/usr/bin/env tsx
/**
 * @file
 * Script get Knowledge base articles from Freshdesk and push them to transifex.
 */
import FreshdeskApi, { FreshdeskArticleStatus, FreshdeskCategory, FreshdeskFolder } from './lib/freshdesk-api.mts'
import { TransifexStringsKeyValueJson, TransifexStringsStructuredJson } from './lib/transifex-formats.mts'
import { txPush, txCreateResource, JsonApiException } from './lib/transifex.mts'

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

/**
 * Generate a transifex id from the name and id field of an objects. Remove spaces and '/'
 * from the name and append '.<id>' Transifex ids (slugs) have a max length of 50. Use at most
 * 30 characters of the name to allow for Freshdesk id, and a suffix like '_json'
 * @param item - data from Freshdesk that includes the name and id of a category or folder
 * @returns generated transifex id
 */
const makeTxId = (item: FreshdeskFolder) => `${item.name.replace(/[ /]/g, '').slice(0, 30)}_${item.id}`

const txPushResource = async (
  name: string,
  articles: TransifexStringsStructuredJson | TransifexStringsKeyValueJson,
  type: string,
) => {
  const resourceData = {
    slug: name,
    name: name,
    i18nType: type,
    priority: 0, // default to normal priority
    content: articles,
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
const getFolders = async (categories: FreshdeskCategory[]) => {
  const categoryFolders = await Promise.all(categories.map(category => FD.listFolders(category)))
  return ([] as FreshdeskCategory[]).concat(...categoryFolders)
}

/**
 * Save articles in a particular folder
 * @param folder - The folder object
 */
const saveArticles = async (folder: FreshdeskFolder) => {
  await FD.listArticles(folder).then(async json => {
    const txArticles = json.reduce((strings: TransifexStringsStructuredJson, current) => {
      if (current.status === FreshdeskArticleStatus.published) {
        strings[`${current.id}`] = {
          title: {
            string: current.title,
          },
          description: {
            string: current.description,
          },
        }
        if (current.tags?.length) {
          strings[`${current.id}`].tags = { string: current.tags.toString() }
        }
      }
      return strings
    }, {})
    process.stdout.write(`Push ${folder.name} articles to Transifex\n`)
    await txPushResource(`${makeTxId(folder)}_json`, txArticles, 'STRUCTURED_JSON')
  })
}

/**
 * @param folders - Array of folders containing articles to be saved
 */
const saveArticleFolders = async (folders: FreshdeskCategory[]) => {
  await Promise.all(folders.map(folder => saveArticles(folder)))
}

const syncSources = async () => {
  await FD.listCategories()
    .then(json => {
      console.dir(json)
      // save category names for translation
      for (const cat of json.values()) {
        categoryNames[`${makeTxId(cat)}`] = cat.name
      }
      return json
    })
    .then(getFolders)
    .then(async data => {
      data.forEach(item => {
        folderNames[`${makeTxId(item)}`] = item.name
      })
      process.stdout.write('Push category and folder names to Transifex\n')
      await Promise.all([
        txPushResource('categoryNames_json', categoryNames, 'KEYVALUEJSON'),
        txPushResource('folderNames_json', folderNames, 'KEYVALUEJSON'),
      ])
      return data
    })
    .then(saveArticleFolders)
}

await syncSources()
