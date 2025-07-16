// interface to FreshDesk Solutions (knowledge base) api

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
 * Properties to provide when creating a Category throught the Freshdesk API. Also works for updates.
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
 * Properties to provide when creating a Folder throught the Freshdesk API. Also works for updates.
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
 * Properties to provide when creating an Article throught the Freshdesk API. Also works for updates.
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
 * Wrapper for Freshdesk's REST API
 */
export class FreshdeskApi {
  baseUrl: string
  private _auth: string
  defaultHeaders: { 'Content-Type': string; Authorization: string }
  rateLimited: boolean

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl
    this._auth = 'Basic ' + Buffer.from(`${apiKey}:X`).toString('base64')
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Authorization: this._auth,
    }
    this.rateLimited = false
  }

  /**
   * Checks the status of a response. If status is not ok, or the body is not JSON, raise exception
   * @param res - The response object
   * @returns the response if it is ok
   */
  checkStatus(res: Response) {
    if (res.ok) {
      if (res.headers.get('content-type')?.includes('application/json')) {
        return res
      }
      throw new Error(`response not json: ${res.headers.get('content-type')}`)
    }
    const err = new Error(`response ${res.statusText}`) as HttpError
    err.code = res.status
    if (res.status === 429) {
      err.retryAfter = res.headers.get('Retry-After')
    }
    throw err
  }

  async listCategories(): Promise<FreshdeskCategory[]> {
    const res = await fetch(`${this.baseUrl}/api/v2/solutions/categories`, { headers: this.defaultHeaders })
    this.checkStatus(res)
    return (await res.json()) as FreshdeskCategory[]
  }

  async listFolders(category: FreshdeskCategory): Promise<FreshdeskFolder[]> {
    const res = await fetch(`${this.baseUrl}/api/v2/solutions/categories/${category.id}/folders`, {
      headers: this.defaultHeaders,
    })
    this.checkStatus(res)
    return (await res.json()) as FreshdeskFolder[]
  }

  async listArticles(folder: FreshdeskFolder) {
    const res = await fetch(`${this.baseUrl}/api/v2/solutions/folders/${folder.id}/articles`, {
      headers: this.defaultHeaders,
    })
    this.checkStatus(res)
    return (await res.json()) as FreshdeskArticle[]
  }

  async updateCategoryTranslation(
    id: FreshdeskCategory['id'],
    locale: string,
    body: FreshdeskCategoryCreate,
  ): Promise<FreshdeskCategory | -1> {
    if (this.rateLimited) {
      process.stdout.write(`Rate limited, skipping id: ${id} for ${locale}\n`)
      return -1
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/v2/solutions/categories/${id}/${locale}`, {
        method: 'put',
        body: JSON.stringify(body),
        headers: this.defaultHeaders,
      })
      this.checkStatus(res)
      return (await res.json()) as FreshdeskCategory
    } catch (err) {
      const httpError = err as HttpError
      if (httpError.code === 404) {
        // not found, try create instead
        const res2 = await fetch(`${this.baseUrl}/api/v2/solutions/categories/${id}/${locale}`, {
          method: 'post',
          body: JSON.stringify(body),
          headers: this.defaultHeaders,
        })
        this.checkStatus(res2)
        return (await res2.json()) as FreshdeskCategory
      }
      if (httpError.code === 429) {
        this.rateLimited = true
      }
      process.stdout.write(`Error processing id ${id} for locale ${locale}: ${httpError.message}\n`)
      throw err
    }
  }

  async updateFolderTranslation(
    id: FreshdeskFolder['id'],
    locale: string,
    body: FreshdeskFolderCreate,
  ): Promise<FreshdeskFolder | -1> {
    if (this.rateLimited) {
      process.stdout.write(`Rate limited, skipping id: ${id} for ${locale}\n`)
      return -1
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/v2/solutions/folders/${id}/${locale}`, {
        method: 'put',
        body: JSON.stringify(body),
        headers: this.defaultHeaders,
      })
      this.checkStatus(res)
      return (await res.json()) as FreshdeskFolder
    } catch (err) {
      const httpError = err as HttpError
      if (httpError.code === 404) {
        // not found, try create instead
        const res2 = await fetch(`${this.baseUrl}/api/v2/solutions/folders/${id}/${locale}`, {
          method: 'post',
          body: JSON.stringify(body),
          headers: this.defaultHeaders,
        })
        this.checkStatus(res2)
        return (await res2.json()) as FreshdeskFolder
      }
      if (httpError.code === 429) {
        this.rateLimited = true
      }
      process.stdout.write(`Error processing id ${id} for locale ${locale}: ${httpError.message}\n`)
      throw err
    }
  }

  async updateArticleTranslation(
    id: FreshdeskArticle['id'],
    locale: string,
    body: FreshdeskArticleCreate,
  ): Promise<FreshdeskArticle | -1> {
    if (this.rateLimited) {
      process.stdout.write(`Rate limited, skipping id: ${id} for ${locale}\n`)
      return -1
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/v2/solutions/articles/${id}/${locale}`, {
        method: 'put',
        body: JSON.stringify(body),
        headers: this.defaultHeaders,
      })
      this.checkStatus(res)
      return (await res.json()) as FreshdeskArticle
    } catch (err) {
      const httpError = err as HttpError
      if (httpError.code === 404) {
        // not found, try create instead
        const res2 = await fetch(`${this.baseUrl}/api/v2/solutions/articles/${id}/${locale}`, {
          method: 'post',
          body: JSON.stringify(body),
          headers: this.defaultHeaders,
        })
        this.checkStatus(res2)
        return (await res2.json()) as FreshdeskArticle
      }
      if (httpError.code === 429) {
        this.rateLimited = true
      }
      process.stdout.write(`Error processing id ${id} for locale ${locale}: ${httpError.message}\n`)
      throw err
    }
  }
}

export default FreshdeskApi
