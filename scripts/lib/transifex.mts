/**
 * @file
 * Utilities for interfacing with Transifex API 3.
 */
import { transifexApi, Collection, JsonApiResource } from '@transifex/api'
import { TransifexStrings } from './transifex-formats.mts'
import { TransifexLanguageObject, TransifexResourceObject } from './transifex-objects.mts'

const ORG_NAME = 'llk'
const SOURCE_LOCALE = 'en'

if (!process.env.TX_TOKEN) {
  throw new Error('TX_TOKEN is not defined.')
}

transifexApi.setup({
  auth: process.env.TX_TOKEN,
})

/*
 * The Transifex JS API wraps the Transifex JSON API, and is built around the concept of a `Collection`.
 * A `Collection` begins as a URL builder: methods like `filter` and `sort` add query parameters to the URL.
 * The `download` method doesn't actually download anything: it returns the built URL. It seems to be intended
 * primarily for internal use, but shows up in the documentation despite not being advertised in the .d.ts file.
 * The `download` method is mainly used to skip the `fetch` method in favor of downloading the resource yourself.
 * The `fetch` method sends a request to the URL and returns a promise that resolves to the first page of results.
 * If there's only one page of results, the `data` property of the collection object will be an array of all results.
 * However, if there are multiple pages of results, the `data` property will only contain the first page of results.
 * Previous versions of this code would unsafely assume that the `data` property contained all results.
 * The `all` method returns an async iterator that yields all results, fetching additional pages as needed.
 */

/**
 * Collects all resources from all pages of a potentially-paginated JSON API collection.
 * It's not necessary, but also not harmful, to call `fetch()` on the collection before calling this function.
 * @param collection A collection of JSON API resources.
 * @returns An array of all resources in the collection.
 * @todo This seems necessary with the latest Transifex API..?
 */
const collectAll = async function <T extends JsonApiResource>(collection: Collection): Promise<T[]> {
  await collection.fetch() // fetch the first page if it hasn't already been fetched
  const collected: T[] = []
  // According to `transifexApi.d.ts`, `all()` returns an `Iterable<JsonApiResource>`.
  // However, that's not the case in practice; it actually returns an `AsyncGenerator`,
  // hence the need `for await` (pun slightly intended) and the ugly cast.
  for await (const item of collection.all() as unknown as AsyncIterable<JsonApiResource>) {
    collected.push(item as T)
  }
  return collected
}

/**
 * Creates a download event for a specific project, resource, and locale.
 * Returns the URL to download the resource.
 * @param projectSlug - project slug (for example,  "scratch-editor")
 * @param resourceSlug - resource slug (for example,  "blocks")
 * @param localeCode - language code (for example,  "ko")
 * @param mode - translation status of strings to include
 * @returns URL to download the resource
 */
const getResourceLocation = async function (
  projectSlug: string,
  resourceSlug: string,
  localeCode: string,
  mode = 'default',
): Promise<string> {
  const resource = {
    data: {
      id: `o:${ORG_NAME}:p:${projectSlug}:r:${resourceSlug}`,
      type: 'resources',
    },
  }

  // if locale is English, create a download event of the source file
  if (localeCode === SOURCE_LOCALE) {
    return (await transifexApi.ResourceStringsAsyncDownload.download({
      resource,
    })) as string
  }

  const language = {
    data: {
      id: `l:${localeCode}`,
      type: 'languages',
    },
  }

  // if locale is not English, create a download event of the translation file
  return (await transifexApi.ResourceTranslationsAsyncDownload.download({
    mode,
    resource,
    language,
  })) as string
}

/**
 * Pulls a translation JSON from transifex, for a specific project, resource, and locale.
 * @template T - resource file type, such as `TransifexStringsKeyValueJson`
 * @param project - project slug (for example, `scratch-editor`)
 * @param resource - resource slug (for example, `blocks`)
 * @param locale - language code (for example, `ko`)
 * @param mode - translation status of strings to include
 * @returns JSON object of translated resource strings (or, of the original resource strings, if the local is the
 * source language)
 */
export const txPull = async function <T>(
  project: string,
  resource: string,
  locale: string,
  mode = 'default',
): Promise<TransifexStrings<T>> {
  let buffer: string | null = null
  try {
    const url = await getResourceLocation(project, resource, locale, mode)
    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        console.log(`Retrying txPull download after ${i} failed attempt(s)`)
      }
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to download resource: ${response.statusText}`)
        }
        buffer = await response.text()
        break
      } catch (e) {
        console.error(e, { project, resource, locale, buffer })
      }
    }
    if (!buffer) {
      throw Error(`txPull download failed after 5 retries: ${url}`)
    }
    return JSON.parse(buffer) as TransifexStrings<T>
  } catch (e) {
    ;(e as Error).cause = {
      project,
      resource,
      locale,
      buffer,
    }
    throw e
  }
}

/**
 * Given a project, returns a list of the slugs of all resources in the project
 * @param project - project slug (for example,  "scratch-website")
 * @returns - array of strings, slugs identifying each resource in the project
 */
export const txResources = async function (project: string): Promise<string[]> {
  const resources = transifexApi.Resource.filter({
    project: `o:${ORG_NAME}:p:${project}`,
  })

  const resourcesData = await collectAll<TransifexResourceObject>(resources)

  const slugs = resourcesData.map(
    r =>
      // r.id is a longer id string, like "o:llk:p:scratch-website:r:about-l10njson"
      // We just want the slug that comes after ":r:" ("about-l10njson")
      r.id.split(':r:')[1],
  )
  return slugs
}

/**
 * @param project - project slug (for example)
 * @returns - array of resource objects
 */
export const txResourcesObjects = async function (project: string): Promise<TransifexResourceObject[]> {
  const resources = transifexApi.Resource.filter({
    project: `o:${ORG_NAME}:p:${project}`,
  })

  return collectAll<TransifexResourceObject>(resources)
}

/**
 * Gets available languages for a project
 * @param slug - project slug (for example, "scratch-editor")
 * @returns - list of language codes
 */
export const txAvailableLanguages = async function (slug: string): Promise<string[]> {
  const project = await transifexApi.Project.get({
    organization: `o:${ORG_NAME}`,
    slug: slug,
  })

  const languages = (await project.fetch('languages', false)) as Collection
  const languagesData = await collectAll<TransifexLanguageObject>(languages)
  return languagesData.map(l => l.attributes.code)
}

/**
 * Uploads English source strings to a resource in transifex
 * @param project - project slug (for example,  "scratch-editor")
 * @param resource - resource slug (for example,  "blocks")
 * @param sourceStrings - json of source strings
 */
export const txPush = async function (project: string, resource: string, sourceStrings: TransifexStrings<unknown>) {
  const resourceObj = {
    data: {
      id: `o:${ORG_NAME}:p:${project}:r:${resource}`,
      type: 'resources',
    },
  }

  await transifexApi.ResourceStringsAsyncUpload.upload({
    resource: resourceObj,
    content: JSON.stringify(sourceStrings),
  })
}

/**
 * Creates a new resource, and then uploads source strings to it if they are provided
 * @param project - project slug (for example,  "scratch-editor")
 * @param resource - object of resource information
 * @param resource.slug - resource slug (for example,  "blocks")
 * @param resource.name - human-readable name for the resource
 * @param resource.i18nType - i18n format id
 * @param resource.sourceStrings - json object of source strings
 */
export const txCreateResource = async function (
  project: string,
  {
    slug,
    name,
    i18nType,
    sourceStrings,
  }: {
    slug: string
    name: string
    i18nType: string
    sourceStrings?: TransifexStrings<unknown>
  },
) {
  const i18nFormat = {
    data: {
      id: i18nType || 'KEYVALUEJSON',
      type: 'i18n_formats',
    },
  }

  const projectObj = {
    data: {
      id: `o:${ORG_NAME}:p:${project}`,
      type: 'projects',
    },
  }

  // @ts-expect-error This omits "required" props but has been like this for ages and I'm not sure how to best fix it
  await transifexApi.Resource.create({
    attributes: { slug: slug, name: name },
    relationships: {
      i18n_format: i18nFormat,
      project: projectObj,
    },
  })

  if (sourceStrings) {
    await txPush(project, slug, sourceStrings)
  }
}

/**
 * Information about an error condition generated by Transifex's JSON API
 * @see https://github.com/transifex/transifex-api-python/blob/master/src/jsonapi/exceptions.py
 * @see https://github.com/transifex/transifex-javascript/blob/master/packages/jsonapi/src/errors.js
 */
export interface JsonApiError {
  status: number
  code: string
  title: string
  detail: string
  source?: string
}

/**
 * A JS `Error` thrown by Transifex's JSON API
 * @see https://github.com/transifex/transifex-api-python/blob/master/src/jsonapi/exceptions.py
 * @see https://github.com/transifex/transifex-javascript/blob/master/packages/jsonapi/src/errors.js
 */
export interface JsonApiException extends Error {
  statusCode: number
  errors: JsonApiError[]
  message: string
}
