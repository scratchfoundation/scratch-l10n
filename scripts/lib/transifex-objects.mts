import { JsonApiResource } from '@transifex/api'

// Writing these types is very manual, so I've only written the ones used by our scripts. The types are adapted from
// the documentation of the Transifex API, usually from the description of the `data` field in a 200 response to some
// "list" or "get details" kind of call.

/**
 * Properties common to all Transifex API objects. I chose the generic term "Object" for what JSON API calls a
 * "Resource" since "Resource" has a specific meaning in a Transifex context.
 */
export interface TransifexObject extends JsonApiResource {
  /** The type of object. Use this to determine the specific type to use for this object. */
  type: string
  /** Unique identifier for this object. */
  id: string
  /** The attributes of this object. */
  attributes: Record<string, unknown>
  /** The relationships of this object. */
  relationships: Record<string, unknown>
  /** The URL links of the object. */
  links: Record<string, string>
}

/**
 * Transifex object representing a Language.
 * @see https://developers.transifex.com/reference/get_languages-language-id
 */
export interface TransifexLanguageObject extends TransifexObject {
  /** The type of the resource.*/
  type: 'languages'
  /** Language identifier. Example: `l:en_US` */
  id: `l:${string}`
  attributes: {
    /** The language code as defined in CLDR. Example: `en`. */
    code: string
    /** The name of the language as defined in CLDR. Example: `English`. */
    name: string
    /** Whether the language is right-to-left. */
    rtl: boolean
    /** The language plural rule equation as defined in CLDR. Example: `(n != 1)`. */
    plural_equation: string
    /** Object of plural rules for Language as defined in CLDR. */
    plural_rules: object
  }
}

/**
 * Transifex object representing a Project.
 * @see https://developers.transifex.com/reference/get_projects-project-id
 */
export interface TransifexProjectObject extends TransifexObject {
  /** The type of the resource.*/
  type: 'projects'
  /** Project identifier. Example: `o:org_slug:p:project_slug` */
  id: `o:${string}:p:${string}`
  attributes: {
    /**
     * If the project is archived or not.
     * If a project is archived the pricing will be lower but no action will be available.
     */
    archived: boolean
    /** The date and time the project was created. */
    datetime_created: string
    /** The date and time the project was last modified. */
    datetime_modified: string
    /** A description of the project. */
    description: string
    /** The homepage of the project. */
    homepage_url: string
    /**
     * A web page containing documentation or instructions for translators, or localization tips for your
     * community.
     */
    instructions_url: string
    /** The license of the project. */
    license: string
    /** The URL of the project's logo. */
    logo_url: string
    /** A long description of the project. */
    long_description: string
    /** If the resources of the project will be filled up from a machine translation. */
    machine_translation_fillup: boolean
    /** The name of the project. */
    name: string
    /** Whether the project is private. A private project is visible only by you and your team. */
    private: boolean
    /** The URL of the public source code repository. */
    repository_url: string
    /** The slug of the project. Example: `project_slug`. */
    slug: string
    /** List of tags for the project. */
    tags: string[]
    /** If the resources of the project will be filled up from common translation memory. */
    translation_memory_fillup: boolean
    /** The type of the project. */
    type: 'live' | 'file'
  }
}

/**
 * Transifex object representing a Resource.
 * @see https://developers.transifex.com/reference/get_resources-resource-id
 */
export interface TransifexResourceObject extends TransifexObject {
  /** The type of the resource.*/
  type: 'resources'
  /** Resource identifier. Example: `o:org_slug:p:project_slug:r:resource_slug` */
  id: `o:${string}:p:${string}:r:${string}`
  attributes: {
    /** The slug of the resource. Example: `resource_slug`. */
    slug: string
    /** The name of the resource. */
    name: string
    /** The priority of the resource. */
    priority: 'normal' | 'high' | 'urgent'
    /** The format of the resource. Example: `STRUCTURED_JSON`. */
    i18n_type: string
    /** File format type version. */
    i18n_version: number
    /** Whether the resource should accept translations or not. */
    accept_translations: boolean
    /** The number of strings in the resource content. */
    string_count: number
    /** The number of words in the resource content. */
    word_count: string
    /** The date and time the resource was created. */
    datetime_created: string
    /** The date and time the resource was last modified. */
    datetime_modified: string
    /** List of categories to associate similar resources. */
    categories: string[]
    /** Options that determine how the resource will be parsed and compiled. */
    i18n_options: Record<string, unknown>
    /** A (public) URL to provide an MP4 video file for subtitle translation. */
    mp4_url: string
    /** A (public) URL to provide an OGG video file for subtitle translation. */
    ogg_url: string
    /** A (public) URL to provide a YouTube video file for subtitle translation. */
    youtube_url: string
    /** A (public) URL to provide a WEBM video file for subtitle translation. */
    webm_url: string
  }
}
