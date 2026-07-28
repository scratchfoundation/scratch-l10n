// interface to FreshDesk Solutions (knowledge base) api
import { messageOf } from './errors.mts'
import { emitWarning } from './warnings.mts'

/**
 * Extend
 */
export interface HttpError extends Error {
  /** HTTP error code (if any) */
  code: number | null | undefined

  /** Retry-After header value (if any) */
  retryAfter: string | null | undefined
}

/**
 * Properties to provide when creating a Category through the Freshdesk API. Also works for updates.
 * @see https://developers.freshdesk.com/api/#create_solution_category
 */
export interface FreshdeskCategoryCreate {
  /** Name of the solution category. Mandatory for Create. */
  name: string
  /** Description of the solution category */
  description?: string
  /** List of portal IDs where this category is visible */
  visible_in_portals?: number[]
}

/**
 * Categories broadly classify your solutions page into several sections.
 * @see https://developers.freshdesk.com/api/#solution_category_attributes
 */
export interface FreshdeskCategory extends FreshdeskCategoryCreate {
  /** Unique ID of the solution category */
  id?: number
  /** Solution Category creation timestamp */
  created_at?: string
  /** Solution Category update timestamp */
  updated_at?: string
}

/**
 * Properties to provide when creating a Folder through the Freshdesk API. Also works for updates.
 * @see https://developers.freshdesk.com/api/#create_solution_folder
 */
export interface FreshdeskFolderCreate {
  /** Description of the solution folder */
  description?: string
  /** Name of the solution folder */
  name: string
  /** ID of the parent folder */
  parent_folder_id?: number
  /** Accessibility of this folder. Please refer to Folder Properties table. */
  visibility?: FreshdeskFolderVisibility
  /** IDs of the companies to whom this solution folder is visible */
  company_ids?: number[]
  /** IDs of the contact segments to whom this solution folder is visible */
  contact_segment_ids?: number[]
  /** IDs of the company segments to whom this solution folder is visible */
  company_segment_ids?: number[]
}

/**
 * Related Solutions Articles and/or Folders are organized into Folders. Folders make it convenient for users to read
 * similar articles or navigate to other possible solutions to their problem.
 * @see https://developers.freshdesk.com/api/#solution_folder_attributes
 */
export interface FreshdeskFolder extends FreshdeskFolderCreate {
  /** Unique ID of the solution folder */
  id?: number
  /** Parent category and folders in which the folder is placed */
  hierarchy?: object[]
  /** Number of articles present inside a folder */
  articles_count?: number
  /** Number of folders present inside a folder */
  sub_folders_count?: number
  /** Solution Folder creation timestamp */
  created_at?: string
  /** Solution Folder updated timestamp */
  updated_at?: string
}

export enum FreshdeskFolderVisibility {
  AllUsers = 1,
  LoggedInUsers = 2,
  Agents = 3,
  SelectedCompanies = 4,
  Bots = 5,
  SelectedContactSegments = 6,
  SelectedCompanySegments = 7,
}

/**
 * Properties to provide when creating an Article through the Freshdesk API. Also works for updates.
 * @see https://developers.freshdesk.com/api/#create_solution_article
 */
export interface FreshdeskArticleCreate {
  /** ID of the agent who created the solution article */
  agent_id?: number
  /** Description of the solution article */
  description: string
  /** Status of the solution article */
  status: FreshdeskArticleStatus
  /** Meta data for search engine optimization. Allows meta_title, meta_description and meta_keywords */
  seo_data?: FreshdeskSEOData
  /** Tags that have been associated with the solution article */
  tags?: string[]
  /** Title of the solution article */
  title: string
}

/**
 * Solution Articles or knowledge base posts promote self-help in your support portal. These should ideally cover all
 * aspects of your product or service like "how-to" instructions and FAQs.
 * @see https://developers.freshdesk.com/api/#solution_article_attributes
 */
export interface FreshdeskArticle extends FreshdeskArticleCreate {
  /** Unique ID of the solution article */
  id?: number
  /** ID of the category to which the solution article belongs */
  category_id?: number
  /** Description of the solution article in plain text */
  description_text?: string
  /** ID of the folder to which the solution article belongs */
  folder_id?: number
  /** Parent category and folders in which the article is placed */
  hierarchy?: object[]
  /** Number of views for the solution article */
  hits?: number
  /** Number of down votes for the solution article */
  thumbs_down?: number
  /** Number of upvotes for the solution article */
  thumbs_up?: number
  /** Solution Article creation timestamp */
  created_at?: string
  /** Solution Article updated timestamp */
  updated_at?: string
}

export enum FreshdeskArticleStatus {
  draft = 1,
  published = 2,
}

export interface FreshdeskSEOData {
  meta_title?: string
  meta_description?: string
  meta_keywords?: string[]
}

/**
 * A Freshdesk agent, as returned by the `agents/me` endpoint.
 * @see https://developers.freshdesk.com/api/#me
 */
export interface FreshdeskAgent {
  /** Unique ID of the agent */
  id: number
  /** Scope of tickets the agent can access */
  ticket_scope?: number
  /** The agent's contact details */
  contact: {
    name: string
    email: string
    active?: boolean
  }
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/** Interval used before the server has told us its limit, in ms (conservative, avoids an opening burst). */
const FD_START_INTERVAL_MS = 300
/** Never pace faster than this, even if the advertised limit would allow it, in milliseconds. */
const FD_MIN_REQUEST_INTERVAL_MS = 100
/** Ceiling on the interval the backoff will grow to, in milliseconds. */
const FD_MAX_REQUEST_INTERVAL_MS = 10_000
/** Fraction of the advertised per-minute budget we aim to use, leaving headroom for bursts and other clients. */
const FD_RATE_SAFETY_FACTOR = 0.75
/** When the advertised remaining budget drops to this fraction of the total, pause to let it refill. */
const FD_LOW_REMAINING_FRACTION = 0.1
/** How long to hold the schedule when the remaining budget runs low, in milliseconds. */
const FD_LOW_REMAINING_PAUSE_MS = 3_000
/** Extra multiplier applied to the interval on a 429, a safety net for when the headers under-report. */
const FD_RATE_LIMIT_BACKOFF_FACTOR = 1.5
/** Maximum attempts (the initial request plus retries) for a single request that keeps getting 429ed. */
const FD_MAX_RATE_LIMIT_ATTEMPTS = 5
/** Fallback wait when a 429 arrives without a usable `Retry-After` header, in milliseconds. */
const FD_DEFAULT_RETRY_AFTER_MS = 30_000
/**
 * Cap on how long we will actually wait for a single `Retry-After`, in milliseconds. Freshdesk can
 * return a punitive multi-minute delay once it decides a client is abusing the API; honoring that
 * verbatim would hang the job past its timeout. We cap the wait so the run fails fast and reports
 * instead. Correct pacing should keep us from ever earning such a penalty in the first place.
 */
const FD_MAX_RETRY_AFTER_MS = 120_000

/**
 * Parse a `Retry-After` header into milliseconds. Freshdesk sends a delta in seconds, but the HTTP
 * spec also allows an HTTP-date, so both forms are handled.
 * @param value - the raw header value, or null if absent
 * @returns the delay in milliseconds, or null if the header was missing or unparseable
 */
const parseRetryAfterMs = (value: string | null): number | null => {
  if (!value) {
    return null
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds)) {
    // A negative delay is malformed; fall back to the default (null) rather than retrying immediately.
    return seconds < 0 ? null : seconds * 1000
  }
  const dateMs = Date.parse(value)
  return Number.isNaN(dateMs) ? null : Math.max(0, dateMs - Date.now())
}

/**
 * Parse a non-negative integer rate-limit header (for example `X-RateLimit-Total`).
 * @param value - the raw header value, or null if absent
 * @returns the parsed value, or null if the header was missing or not a finite number
 */
const parseIntHeader = (value: string | null): number | null => {
  if (!value) {
    return null
  }
  const n = Number(value)
  // Reject anything that isn't a whole, non-negative count: this value drives request pacing, so a
  // stray decimal or negative from a malformed header should fall back to the defaults, not skew it.
  return Number.isInteger(n) && n >= 0 ? n : null
}

/**
 * Wrapper for Freshdesk's REST API
 */
export class FreshdeskApi {
  baseUrl: string
  private _auth: string
  defaultHeaders: { 'Content-Type': string; Authorization: string }
  /**
   * Current minimum spacing between request starts, in milliseconds, shared across every concurrent
   * caller. Starts conservative and is set from the server's advertised rate-limit headers once they
   * are seen (see {@link applyRateHeaders}); a 429 nudges it up as a safety net. This is what keeps
   * the fan-out over folders and locales under the limit.
   */
  private requestIntervalMs = FD_START_INTERVAL_MS
  /** Serializes request starts: each `gate()` call chains onto this so only one is timed at a time. */
  private queue: Promise<void> = Promise.resolve()
  /** Timestamp (ms) when the previous request actually started, used to space the next one. */
  private lastRequestStart = 0
  /** Timestamp (ms) before which no request may start; set by a 429 or a low remaining-budget signal. */
  private pauseUntil = 0
  /** Whether the server's advertised limit has been logged yet (logged once, to aid diagnosis). */
  private limitLogged = false
  /** Count of 429 responses seen this run; a nonzero value means the limiter had to back off. */
  rateLimitHits = 0
  /** Whether the one-time "rate limiting activated" warning has been emitted this run. */
  private rateLimitReported = false

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl
    this._auth = 'Basic ' + Buffer.from(`${apiKey}:X`).toString('base64')
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Authorization: this._auth,
    }
  }

  /**
   * Wait for this request's turn. Requests are serialized on a single queue and each starts at least
   * `requestIntervalMs` after the previous one (and never before {@link pauseUntil}). The wait is
   * computed when the request reaches the front of the queue — not reserved up front — so an interval
   * change from a fresh rate-limit header takes effect immediately. That is what keeps the fan-out
   * over folders and locales under the limit without a burst locking in a too-fast schedule.
   * @returns a promise that resolves when it is this request's turn to start
   */
  private async gate(): Promise<void> {
    const run = this.queue.then(async () => {
      const target = Math.max(this.lastRequestStart + this.requestIntervalMs, this.pauseUntil)
      const wait = target - Date.now()
      if (wait > 0) {
        await sleep(wait)
      }
      this.lastRequestStart = Date.now()
    })
    // Keep the chain alive whether or not the timing step rejects (it shouldn't, but be safe).
    this.queue = run.catch(() => undefined)
    return run
  }

  /**
   * Steer pacing from Freshdesk's advertised rate-limit headers so we throttle *before* hitting the
   * wall rather than only reacting to 429s. Freshdesk returns `X-RateLimit-Total` (the per-minute
   * budget) and `X-RateLimit-Remaining` on every response: we pace to a safe fraction of the budget
   * and pause as the remaining budget runs low. When the headers are absent the interval is left
   * alone and we fall back to the 429 backoff.
   * @param headers - the response headers to read the advertised limits from
   */
  private applyRateHeaders(headers: Headers): void {
    const total = parseIntHeader(headers.get('X-RateLimit-Total'))
    if (total === null || total <= 0) {
      return
    }
    // Aim for a fraction of the budget: interval = one minute / (budget * safety).
    const target = 60_000 / (total * FD_RATE_SAFETY_FACTOR)
    this.requestIntervalMs = Math.min(Math.max(target, FD_MIN_REQUEST_INTERVAL_MS), FD_MAX_REQUEST_INTERVAL_MS)
    if (!this.limitLogged) {
      this.limitLogged = true
      console.log(
        `Freshdesk advertised rate limit: ${total}/min; pacing requests ` +
          `~${Math.round(this.requestIntervalMs)}ms apart.`,
      )
    }
    const remaining = parseIntHeader(headers.get('X-RateLimit-Remaining'))
    if (remaining !== null && remaining <= total * FD_LOW_REMAINING_FRACTION) {
      // Budget nearly exhausted: hold the shared schedule briefly so the window can refill before we
      // spend the last of it and trip a 429.
      this.pauseUntil = Math.max(this.pauseUntil, Date.now() + FD_LOW_REMAINING_PAUSE_MS)
    }
  }

  /**
   * Perform a fetch through the rate limiter: paced against the shared schedule, and transparently
   * retried on 429 while honoring `Retry-After`. Any non-429 response (success or a real error) is
   * returned as-is for the caller's {@link checkStatus} to interpret; a 429 that survives every
   * retry is likewise returned so it surfaces as a genuine, reported failure rather than a silent
   * skip. Only rate limiting is handled here — other transient failures keep their existing behavior.
   * @param url - absolute endpoint to call
   * @param init - method, body, and headers for the fetch
   * @returns the final response
   */
  private async request(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      await this.gate()
      const res = await fetch(url, init)
      // Learn the server's limit from every response (success or 429) and pace to it.
      this.applyRateHeaders(res.headers)
      if (res.status !== 429) {
        return res
      }
      this.rateLimitHits++
      // Surface the first back-off through the shared warnings channel (job summary + Slack), once
      // per run, so a job that recovers and stays green still flags that it is brushing the limit.
      if (!this.rateLimitReported) {
        this.rateLimitReported = true
        emitWarning(
          'Freshdesk rate limiting was encountered during the help sync. Requests are being paced ' +
            'and retried (honoring Retry-After), so the run should still complete; if this recurs, ' +
            'consider reducing request volume or raising the Freshdesk rate limit.',
        )
      }
      const requested = parseRetryAfterMs(res.headers.get('Retry-After')) ?? FD_DEFAULT_RETRY_AFTER_MS
      // Cap the honored wait so a punitive multi-minute Retry-After can't hang the job; give up
      // rather than sleep past the timeout. Return the 429 with its body still intact so
      // checkStatus can read and surface Freshdesk's actual reason for the failure.
      if (requested > FD_MAX_RETRY_AFTER_MS || attempt >= FD_MAX_RATE_LIMIT_ATTEMPTS) {
        return res
      }
      // We are going to retry and abandon this response, so drain its body now to free the socket
      // before we wait. (The give-up paths above deliberately leave it unread for checkStatus.)
      await res.text().catch(() => undefined)
      // Safety net on top of the header-driven pacing: widen the interval and hold the shared
      // schedule until the retry window passes, so every request backs off together rather than only
      // the one that was rejected.
      this.requestIntervalMs = Math.min(
        this.requestIntervalMs * FD_RATE_LIMIT_BACKOFF_FACTOR,
        FD_MAX_REQUEST_INTERVAL_MS,
      )
      this.pauseUntil = Math.max(this.pauseUntil, Date.now() + requested)
      console.warn(
        `Freshdesk rate limited (429); waiting ~${Math.round(requested)}ms then retrying ` +
          `(attempt ${attempt}/${FD_MAX_RATE_LIMIT_ATTEMPTS}, pace now ${Math.round(this.requestIntervalMs)}ms).`,
      )
    }
  }

  /**
   * Checks the status of a response. If status is not ok, or the body is not JSON, raise exception.
   * On error, the response body is included in the message: Freshdesk reports the actual reason for
   * a failure there (for example `{"code":"access_denied","message":"..."}`), so surfacing it turns
   * an opaque "HTTP 403" into something diagnosable.
   * @param res - The response object
   * @returns the response if it is ok
   */
  async checkStatus(res: Response) {
    if (res.ok) {
      if (res.headers.get('content-type')?.includes('application/json')) {
        return res
      }
      throw new Error(`response not json: ${res.headers.get('content-type')}`)
    }
    let message = `HTTP ${res.status} ${res.statusText} for ${res.url}`
    if (res.status === 403) {
      message += ` -- this item may have been deleted in Freshdesk, or the API key lacks permission.`
    }
    // Read the body for the underlying reason. It is safe to consume here because we only reach this
    // point on error and are about to throw; the caller never reads the body of a failed response.
    const body = (await res.text().catch(() => '')).trim()
    if (body) {
      message += ` -- response: ${body.length > 500 ? `${body.slice(0, 500)}...` : body}`
    }
    const err = new Error(message) as HttpError
    err.code = res.status
    if (res.status === 429) {
      err.retryAfter = res.headers.get('Retry-After')
    }
    throw err
  }

  async listCategories(): Promise<FreshdeskCategory[]> {
    const res = await this.request(`${this.baseUrl}/api/v2/solutions/categories`, { headers: this.defaultHeaders })
    await this.checkStatus(res)
    return (await res.json()) as FreshdeskCategory[]
  }

  async listFolders(category: FreshdeskCategory): Promise<FreshdeskFolder[]> {
    const res = await this.request(`${this.baseUrl}/api/v2/solutions/categories/${category.id}/folders`, {
      headers: this.defaultHeaders,
    })
    await this.checkStatus(res)
    return (await res.json()) as FreshdeskFolder[]
  }

  async listArticles(folder: FreshdeskFolder) {
    const res = await this.request(`${this.baseUrl}/api/v2/solutions/folders/${folder.id}/articles`, {
      headers: this.defaultHeaders,
    })
    await this.checkStatus(res)
    return (await res.json()) as FreshdeskArticle[]
  }

  /**
   * Fetch the agent that the configured API key authenticates as. The account behind the token
   * determines what the sync may read and write, so surfacing it makes a permission problem (such
   * as a `403 access_denied` on a specific item) much easier to route to the right person.
   * @returns the agent's id and contact details
   */
  async getAuthenticatedAgent(): Promise<FreshdeskAgent> {
    const res = await this.request(`${this.baseUrl}/api/v2/agents/me`, { headers: this.defaultHeaders })
    await this.checkStatus(res)
    return (await res.json()) as FreshdeskAgent
  }

  async updateCategoryTranslation(
    id: FreshdeskCategory['id'],
    locale: string,
    body: FreshdeskCategoryCreate,
  ): Promise<FreshdeskCategory> {
    try {
      const res = await this.request(`${this.baseUrl}/api/v2/solutions/categories/${id}/${locale}`, {
        method: 'put',
        body: JSON.stringify(body),
        headers: this.defaultHeaders,
      })
      await this.checkStatus(res)
      return (await res.json()) as FreshdeskCategory
    } catch (err) {
      const httpError = err as HttpError
      if (httpError.code === 404) {
        // not found, try create instead
        const res2 = await this.request(`${this.baseUrl}/api/v2/solutions/categories/${id}/${locale}`, {
          method: 'post',
          body: JSON.stringify(body),
          headers: this.defaultHeaders,
        })
        await this.checkStatus(res2)
        return (await res2.json()) as FreshdeskCategory
      }
      process.stdout.write(`Error processing id ${id} for locale ${locale}: ${httpError.message}\n`)
      throw err
    }
  }

  async updateFolderTranslation(
    id: FreshdeskFolder['id'],
    locale: string,
    body: FreshdeskFolderCreate,
  ): Promise<FreshdeskFolder> {
    try {
      const res = await this.request(`${this.baseUrl}/api/v2/solutions/folders/${id}/${locale}`, {
        method: 'put',
        body: JSON.stringify(body),
        headers: this.defaultHeaders,
      })
      await this.checkStatus(res)
      return (await res.json()) as FreshdeskFolder
    } catch (err) {
      const httpError = err as HttpError
      if (httpError.code === 404) {
        // not found, try create instead
        const res2 = await this.request(`${this.baseUrl}/api/v2/solutions/folders/${id}/${locale}`, {
          method: 'post',
          body: JSON.stringify(body),
          headers: this.defaultHeaders,
        })
        await this.checkStatus(res2)
        return (await res2.json()) as FreshdeskFolder
      }
      process.stdout.write(`Error processing id ${id} for locale ${locale}: ${httpError.message}\n`)
      throw err
    }
  }

  async updateArticleTranslation(
    id: FreshdeskArticle['id'],
    locale: string,
    body: FreshdeskArticleCreate,
  ): Promise<FreshdeskArticle> {
    try {
      const res = await this.request(`${this.baseUrl}/api/v2/solutions/articles/${id}/${locale}`, {
        method: 'put',
        body: JSON.stringify(body),
        headers: this.defaultHeaders,
      })
      await this.checkStatus(res)
      return (await res.json()) as FreshdeskArticle
    } catch (err) {
      const httpError = err as HttpError
      if (httpError.code === 404) {
        // not found, try create instead
        const res2 = await this.request(`${this.baseUrl}/api/v2/solutions/articles/${id}/${locale}`, {
          method: 'post',
          body: JSON.stringify(body),
          headers: this.defaultHeaders,
        })
        await this.checkStatus(res2)
        return (await res2.json()) as FreshdeskArticle
      }
      process.stdout.write(`Error processing id ${id} for locale ${locale}: ${httpError.message}\n`)
      throw err
    }
  }
}

/**
 * Log which agent the given Freshdesk client authenticates as. Never throws: identifying the agent
 * is a diagnostic aid, so a failure here (for example an invalid token) is reported and swallowed
 * rather than aborting the caller, which will hit the same problem with a clearer error of its own.
 * The agent's email is intentionally omitted to keep it out of public CI logs; the name and id are
 * enough to find the account in Freshdesk.
 * @param fd - a configured Freshdesk client
 */
export const logAuthenticatedAgent = async (fd: FreshdeskApi): Promise<void> => {
  try {
    const agent = await fd.getAuthenticatedAgent()
    console.log(`Freshdesk token authenticated as "${agent.contact.name}" (agent id ${agent.id}).`)
  } catch (error) {
    console.warn(`Could not identify the Freshdesk agent for the configured token: ${messageOf(error)}`)
  }
}

export default FreshdeskApi
