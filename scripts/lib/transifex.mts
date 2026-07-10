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

/** Base delay for exponential backoff between transient-error retries, in milliseconds. */
const TX_RETRY_BASE_MS = 1_000
/** Maximum number of attempts for an operation that fails with a transient (retryable) error. */
const TX_MAX_TRANSIENT_RETRIES = 5
/** How often to poll an async upload for completion, in milliseconds. */
const TX_UPLOAD_POLL_INTERVAL_MS = 2_000
/**
 * Overall budget for a single async upload to reach a terminal state, in milliseconds.
 * This bounds the poll loop so a stuck upload fails fast (with a clear message) instead of
 * polling forever — the workflow's `timeout-minutes` is only a last-resort backstop.
 */
const TX_UPLOAD_TIMEOUT_MS = 5 * 60_000
/** Per-request timeout for downloading a resource from the CDN, in milliseconds. */
const TX_DOWNLOAD_TIMEOUT_MS = 60_000

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Extract a human-readable message from a caught value. `catch` values are typed `unknown` and are
 * not guaranteed to be `Error` instances, so read `.message` only when it really is one.
 * @param err - the caught value
 * @returns the error message, or a string representation of a non-Error throw
 */
const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/**
 * Decide whether an error is worth retrying: server-side 5xx, rate limiting (429), or a transient
 * network failure. Client errors (4xx other than 429) are not retried — they won't fix themselves.
 * @param err - the thrown error, from the Transifex SDK (`JsonApiException`), `fetch`, or the network stack
 * @returns true if retrying the same operation might succeed
 */
const isTransientError = (err: unknown): boolean => {
  const e = (err ?? {}) as { statusCode?: number; status?: number; code?: string; cause?: { code?: string } }
  const status = e.statusCode ?? e.status
  if (typeof status === 'number') {
    return status === 429 || (status >= 500 && status < 600)
  }
  const code = e.code ?? e.cause?.code
  return (
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'UND_ERR_SOCKET' ||
    code === 'UND_ERR_CONNECT_TIMEOUT'
  )
}

/**
 * Run an async operation, retrying with exponential backoff when it fails with a transient error.
 * Non-transient errors (for example a 404) are re-thrown immediately so callers can handle them.
 * @template T - the resolved type of the operation
 * @param label - short description of the operation, used in retry log lines
 * @param fn - the operation to run; called once per attempt
 * @returns the resolved value of `fn`
 */
const withRetry = async function <T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= TX_MAX_TRANSIENT_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isTransientError(err) || attempt === TX_MAX_TRANSIENT_RETRIES) {
        throw err
      }
      const delay = TX_RETRY_BASE_MS * 2 ** (attempt - 1)
      console.warn(
        `${label}: transient error on attempt ${attempt}/${TX_MAX_TRANSIENT_RETRIES}, ` +
          `retrying in ${delay}ms: ${messageOf(err)}`,
      )
      await sleep(delay)
    }
  }
  // Unreachable: the loop either returns or throws, but TypeScript can't prove it.
  throw lastError
}

/**
 * The subset of an async-upload resource instance that we poll. The SDK's generated types model
 * `reload` as requiring an `include` argument, but at runtime it is optional; this shape lets us
 * call `reload()` with no arguments while staying type-checked.
 */
interface AsyncUploadResource {
  get(key: string): unknown
  reload(): Promise<void>
}

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
    // Creating the download event itself polls Transifex until the file is ready; retry transient
    // failures (5xx / network blips) so one bad response doesn't sink the whole pull.
    const url = await withRetry(`txPull download event for ${resource}/${locale}`, () =>
      getResourceLocation(project, resource, locale, mode),
    )
    let lastError: unknown
    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        const delay = TX_RETRY_BASE_MS * 2 ** (i - 1)
        console.log(
          `Retrying txPull download for ${resource}/${locale} after ${i} failed attempt(s); waiting ${delay}ms`,
        )
        await sleep(delay)
      }
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(TX_DOWNLOAD_TIMEOUT_MS) })
        if (!response.ok) {
          throw new Error(`Failed to download resource: HTTP ${response.status} ${response.statusText}`)
        }
        buffer = await response.text()
        break
      } catch (e) {
        lastError = e
        console.error(`txPull download attempt ${i + 1} failed for ${resource}/${locale}: ${messageOf(e)}`)
      }
    }
    if (buffer === null) {
      throw new Error(
        `txPull download failed after 5 attempts for ${resource}/${locale} (${url}): ` +
          `${(lastError as Error | undefined)?.message ?? 'unknown error'}`,
      )
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

  // `ResourceStringsAsyncUpload.upload()` creates the upload and then polls until its status is
  // `succeeded`. That poll has no timeout and no exit for a `failed` status, so a rejected upload
  // (or one stuck in `pending`) loops forever — historically until the CI job's 6-hour limit, and
  // any transient 502 on a poll crashed the whole job with an unhelpful stack trace. We do the
  // create-then-poll ourselves so we can bound it, retry transient blips, and surface the actual
  // reason an upload failed.
  const upload = (await withRetry(`txPush create upload for "${resource}"`, () =>
    transifexApi.ResourceStringsAsyncUpload.create({
      resource: resourceObj,
      content: JSON.stringify(sourceStrings),
      content_encoding: 'text',
      // The generated type insists on id/attributes/relationships/links, but the upload resource
      // takes this flatter shape — the same one `ResourceStringsAsyncUpload.upload()` passes through.
    } as unknown as Parameters<typeof transifexApi.ResourceStringsAsyncUpload.create>[0]),
  )) as unknown as AsyncUploadResource

  const deadline = Date.now() + TX_UPLOAD_TIMEOUT_MS
  for (;;) {
    const status = upload.get('status') as string | undefined
    if (status === 'succeeded') {
      return
    }
    if (status === 'failed') {
      // On failure the upload carries `errors` (and sometimes `details`) explaining why.
      const errorInfo = upload.get('errors') ?? upload.get('details') ?? 'no error detail provided'
      throw new Error(`Transifex upload failed for resource "${resource}": ${JSON.stringify(errorInfo)}`)
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Transifex upload for resource "${resource}" did not reach a terminal state within ` +
          `${TX_UPLOAD_TIMEOUT_MS / 1000}s (last status: ${status ?? 'unknown'}).`,
      )
    }
    await sleep(TX_UPLOAD_POLL_INTERVAL_MS)
    await withRetry(`txPush poll upload for "${resource}"`, () => upload.reload())
  }
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
