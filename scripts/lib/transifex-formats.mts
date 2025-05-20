/**
 * A set of strings from a Transifex resource.
 */
export type TransifexStrings<T> = Record<string, T>

/**
 * A single string from a resource that uses the "CHROME" file type.
 * Scratch: used for most (but not all) Scratch Editor resources.
 */
export interface TransifexStringChrome {
  /** The source or translation text */
  message: string
  /** Description or context information for translators */
  description?: string
}

/**
 * A set of strings from a resource that uses the "CHROME" file type.
 * Scratch: used for most (but not all) Scratch Editor resources.
 */
export type TransifexStringsChrome = TransifexStrings<TransifexStringChrome>

/**
 * A single string from a resource that uses the "KEYVALUEJSON" file type.
 * Scratch: used for the Scratch Website project, the Scratch Editor blocks resource, and some Scratch Help resources.
 */
export type TransifexStringKeyValueJson = string

/**
 * A set of strings from a resource that uses the "KEYVALUEJSON" file type.
 * Scratch: used for the Scratch Website project, the Scratch Editor blocks resource, and some Scratch Help resources.
 */
export type TransifexStringsKeyValueJson = TransifexStrings<TransifexStringKeyValueJson>

/**
 * A single string from a resource that uses the "STRUCTUREDJSON" file type.
 * Scratch: used for most (but not all) Scratch Help resources.
 */
export interface TransifexStringStructuredJson {
  string?: string
  context?: string
  developer_comment?: string
  character_limit?: number
  plurals?: object

  [key: string]: TransifexStringStructuredJson | string | number | object | undefined
}

/**
 * A set of strings from a resource that uses the "STRUCTUREDJSON" file type.
 * Scratch: used for most (but not all) Scratch Help resources.
 */
export type TransifexStringsStructuredJson = TransifexStrings<TransifexStringStructuredJson>
