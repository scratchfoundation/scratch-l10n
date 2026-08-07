/**
 * @file
 * Utilities for interfacing with Transifex API 3.
 */
import { transifexApi, Collection, JsonApiResource } from '@transifex/api'
import { messageOf } from './errors.mts'
import { TransifexStrings } from './transifex-formats.mts'
import {
  TransifexLanguageObject,
  TransifexResourceLanguageStatsObject,
  TransifexResourceObject,
} from './transifex-objects.mts'

const ORG_NAME = 'llk'
export const SOURCE_LOCALE = 'en'

/**
 * Build a deep link to the Transifex online editor for a resource in one language, matching the URL
 * the web app uses: `app.transifex.com/<org>/<project>/translate/#<lang>/<resource>[/<stringId>]`.
 * @param params - link target
 * @param params.project - project slug (for example, `scratch-help`)
 * @param params.resource - resource slug (for example, `Accessibility_4000040849_json`)
 * @param params.lang - language code: the source ({@link SOURCE_LOCALE}) for a source-side fix, or the
 *   translation locale for a bad translation
 * @param params.stringId - optional Transifex numeric string id to focus a single string; omitted, the
 *   link lands on the resource (with its first string shown)
 * @returns the editor URL
 */
export const transifexEditorLink = (params: {
  project: string
  resource: string
  lang: string
  stringId?: string | number
}): string => {
  const { project, resource, lang, stringId } = params
  const base = `https://app.transifex.com/${ORG_NAME}/${project}/translate/#${lang}/${resource}`
  return stringId == null ? base : `${base}/${stringId}`
}

/**
 * Shape attached to a {@link txPull} error's `cause`, carrying the context needed to locate and link
 * the failing (resource, locale) in Transifex (and, for a parse failure, the raw file that failed).
 */
export interface TxPullErrorCause {
  project: string
  resource: string
  locale: string
  buffer: string | null
}

/**
 * Read the {@link TxPullErrorCause} that {@link txPull} attaches to its errors, if present, so a
 * failure handler can build a Transifex link (and read the raw buffer for a parse failure) without the
 * call site threading that context through.
 * @param error - the caught value
 * @returns the cause, or undefined if the error did not come from txPull
 */
export const txPullErrorCause = (error: unknown): TxPullErrorCause | undefined => {
  const cause = (error as { cause?: unknown } | null)?.cause
  if (
    cause &&
    typeof cause === 'object' &&
    typeof (cause as TxPullErrorCause).project === 'string' &&
    typeof (cause as TxPullErrorCause).resource === 'string' &&
    typeof (cause as TxPullErrorCause).locale === 'string' &&
    (typeof (cause as TxPullErrorCause).buffer === 'string' || (cause as TxPullErrorCause).buffer === null)
  ) {
    return cause as TxPullErrorCause
  }
  return undefined
}

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
/**
 * Maximum number of Transifex download events to create concurrently. Each `txPull` creates a
 * download event (a rate-limited API call); fanning every (resource, locale) pair out at once
 * overruns the API's throttle. Bounding the create step keeps a bulk pull under the limit while
 * still overlapping enough requests to make progress.
 */
const TX_MAX_CONCURRENT_DOWNLOADS = 4
/** Upper bound on how long to honor a throttle's "expected available" hint before giving up on it. */
const TX_MAX_THROTTLE_WAIT_MS = 120_000

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Builds a concurrency limiter: the returned function runs at most `max` of the tasks handed to it at
 * once and queues the rest, preserving submission order. Used to bound how many Transifex download
 * events are created in parallel so a bulk pull stays under the API rate limit.
 * @param max - the greatest number of tasks allowed to run at the same time
 * @returns a function that schedules a task and resolves (or rejects) with its result
 */
const limitConcurrency = (max: number): (<T>(task: () => Promise<T>) => Promise<T>) => {
  let active = 0
  const queue: (() => void)[] = []
  const startNext = (): void => {
    active--
    queue.shift()?.()
  }
  return <T,>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = (): void => {
        active++
        // Invoke task() inside a then so a synchronous throw becomes a rejection: otherwise it would
        // escape run(), skip finally(startNext), and leak `active` -- eventually deadlocking the queue.
        void Promise.resolve().then(task).then(resolve, reject).finally(startNext)
      }
      if (active < max) {
        run()
      } else {
        queue.push(run)
      }
    })
}

/** Bounds creation of download events so a bulk pull stays under the Transifex rate limit. */
const downloadLimit = limitConcurrency(TX_MAX_CONCURRENT_DOWNLOADS)

/**
 * How long Transifex asked us to wait, if a 429 said. Transifex reports throttling as
 * "Request was throttled. Expected available in N seconds." (and some errors carry a numeric
 * `retry_after`); honoring that recovers sooner and more reliably than a blind exponential backoff.
 * @param err - the thrown error
 * @returns the requested wait in milliseconds (with a small cushion, capped), or null if this is not
 * a throttle carrying a hint we can read
 */
const throttleWaitMs = (err: unknown): number | null => {
  const e = (err ?? {}) as {
    statusCode?: number
    status?: number
    retry_after?: number
    errors?: { detail?: string }[]
    message?: string
  }
  const status = e.statusCode ?? e.status
  if (status !== 429) {
    return null
  }
  if (typeof e.retry_after === 'number' && e.retry_after > 0) {
    return Math.min((e.retry_after + 1) * 1_000, TX_MAX_THROTTLE_WAIT_MS)
  }
  const detail = e.errors?.[0]?.detail ?? e.message ?? ''
  const match = /available in (\d+)\s*second/i.exec(detail)
  if (match) {
    return Math.min((parseInt(match[1], 10) + 1) * 1_000, TX_MAX_THROTTLE_WAIT_MS)
  }
  return null
}

/**
 * Decide whether an error is worth retrying: server-side 5xx, rate limiting (429), or a transient
 * network failure. Client errors (4xx other than 429) are not retried — they won't fix themselves.
 * @param err - the thrown error, from the Transifex SDK (`JsonApiException`), `fetch`, or the network stack
 * @returns true if retrying the same operation might succeed
 */
const isTransientError = (err: unknown): boolean => {
  const e = (err ?? {}) as {
    statusCode?: number
    status?: number
    code?: string
    name?: string
    cause?: { code?: string }
  }
  // A `fetch` aborted by `AbortSignal.timeout` rejects with a `TimeoutError` that carries no status
  // or code; the only abort in this module is that timeout, so treat it (and a bare abort) as worth
  // retrying.
  if (e.name === 'TimeoutError' || e.name === 'AbortError') {
    return true
  }
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
      // If Transifex threw a throttle telling us when it will be available, wait exactly that long
      // (plus a cushion); otherwise fall back to exponential backoff.
      const delay = throttleWaitMs(err) ?? TX_RETRY_BASE_MS * 2 ** (attempt - 1)
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
    // failures (5xx / network blips) so one bad response doesn't sink the whole pull. Gate it through
    // the shared limiter so a bulk pull creates only a few download events at a time and stays under
    // the API rate limit (the slot is held across retries, so throttling naturally slows the fan-out).
    const url = await downloadLimit(() =>
      withRetry(`txPull download event for ${resource}/${locale}`, () =>
        getResourceLocation(project, resource, locale, mode),
      ),
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
          const err = new Error(
            `Failed to download resource: HTTP ${response.status} ${response.statusText}`,
          ) as Error & { status: number }
          err.status = response.status
          throw err
        }
        buffer = await response.text()
        break
      } catch (e) {
        lastError = e
        console.error(`txPull download attempt ${i + 1} failed for ${resource}/${locale}: ${messageOf(e)}`)
        // Only 5xx / 429 / network / timeout failures are worth retrying. A non-transient failure
        // (for example a 403 or 404) won't fix itself, so fail fast and surface the real cause
        // instead of burning the remaining attempts.
        if (!isTransientError(e)) {
          throw e
        }
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
 * Fetches per-(resource, locale) translation statistics for a project in a single paginated query.
 * Used to detect which pairs changed since a previous sync without downloading any translation files:
 * comparing the returned timestamp against a stored baseline tells us whether a pair needs re-pushing.
 * @param project - project slug (for example, `scratch-help`)
 * @returns a map keyed `<resourceSlug>:<localeCode>` whose value is the ISO datetime that pair's
 * translations were last updated (falling back to the pair's last update of any kind), or null if the
 * pair has never been translated
 */
export const txResourceLanguageStats = async function (project: string): Promise<Map<string, string | null>> {
  const stats = transifexApi.ResourceLanguageStats.filter({
    project: `o:${ORG_NAME}:p:${project}`,
  })
  const statsData = await collectAll<TransifexResourceLanguageStatsObject>(stats)

  const lastUpdatedByPair = new Map<string, string | null>()
  for (const stat of statsData) {
    // id form: o:llk:p:<project>:r:<resource>:l:<locale> — resource slugs and locale codes never
    // contain a colon, so splitting on the delimiters recovers both halves.
    const afterResource = stat.id.split(':r:')[1]
    if (!afterResource) {
      continue
    }
    const [resource, locale] = afterResource.split(':l:')
    if (!resource || !locale) {
      continue
    }
    // A pair with no translated strings has never been translated: map it to null so the gate skips
    // it. Falling back to last_update (which is set even for untranslated pairs) would instead make
    // the gate treat it as changed and sync empty/untranslated content.
    const attrs = stat.attributes
    lastUpdatedByPair.set(
      `${resource}:${locale}`,
      attrs.translated_strings > 0 ? (attrs.last_translation_update ?? attrs.last_update) : null,
    )
  }
  return lastUpdatedByPair
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
