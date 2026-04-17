// ---------------------------------------------------------------------------
// codepane — Language Extension Mapping
// ---------------------------------------------------------------------------
// Maps file extensions to CodeMirror language support packages.
// Languages are lazy-loaded via dynamic import() and cached to avoid
// redundant network/bundle overhead on subsequent opens.
// ---------------------------------------------------------------------------

import type { Extension } from '@codemirror/state'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LanguageLoader = () => Promise<Extension>

// ---------------------------------------------------------------------------
// Language cache
// ---------------------------------------------------------------------------

// Cache stores promises (not resolved values) to prevent duplicate loads
// when multiple components request the same extension concurrently.
const languageCache = new Map<string, Promise<Extension>>()

// ---------------------------------------------------------------------------
// Custom language registry
// ---------------------------------------------------------------------------

const customLoaders = new Map<string, LanguageLoader>()

/**
 * Register a custom language loader for one or more file extensions.
 *
 * Custom loaders take precedence over built-in ones. This allows consumers
 * to add support for languages not shipped with codepane, or to override
 * built-in loaders without installing the optional `@codemirror/lang-*` peer
 * dependency.
 *
 * @example
 * ```ts
 * import { registerLanguage } from 'codepane'
 *
 * registerLanguage(['rs', 'rust'], async () => {
 *   const { rust } = await import('@codemirror/lang-rust')
 *   return rust()
 * })
 * ```
 */
export function registerLanguage(extensions: string | string[], loader: LanguageLoader): void {
  const exts = Array.isArray(extensions) ? extensions : [extensions]
  for (const ext of exts) {
    customLoaders.set(ext.toLowerCase(), loader)
    languageCache.delete(ext.toLowerCase())
  }
}

// ---------------------------------------------------------------------------
// Extension to loader mapping
// ---------------------------------------------------------------------------

/**
 * Maps a file extension (without the leading dot) to a lazy loader that
 * returns the appropriate CodeMirror language `Extension`.
 *
 * Each loader uses a dynamic `import()` so the language grammar is only
 * fetched when a file of that type is first opened.
 */
const extensionLoaders: Record<string, LanguageLoader> = {
  // JavaScript / TypeScript
  js: async () => {
    const { javascript } = await import('@codemirror/lang-javascript')
    return javascript()
  },
  jsx: async () => {
    const { javascript } = await import('@codemirror/lang-javascript')
    return javascript({ jsx: true })
  },
  ts: async () => {
    const { javascript } = await import('@codemirror/lang-javascript')
    return javascript({ typescript: true })
  },
  tsx: async () => {
    const { javascript } = await import('@codemirror/lang-javascript')
    return javascript({ typescript: true, jsx: true })
  },
  mjs: async () => {
    const { javascript } = await import('@codemirror/lang-javascript')
    return javascript()
  },
  mts: async () => {
    const { javascript } = await import('@codemirror/lang-javascript')
    return javascript({ typescript: true })
  },
  cjs: async () => {
    const { javascript } = await import('@codemirror/lang-javascript')
    return javascript()
  },
  cts: async () => {
    const { javascript } = await import('@codemirror/lang-javascript')
    return javascript({ typescript: true })
  },

  // Python
  py: async () => {
    const { python } = await import('@codemirror/lang-python')
    return python()
  },
  pyw: async () => {
    const { python } = await import('@codemirror/lang-python')
    return python()
  },

  // HTML
  html: async () => {
    const { html } = await import('@codemirror/lang-html')
    return html()
  },
  htm: async () => {
    const { html } = await import('@codemirror/lang-html')
    return html()
  },

  // CSS
  css: async () => {
    const { css } = await import('@codemirror/lang-css')
    return css()
  },
  scss: async () => {
    const { css } = await import('@codemirror/lang-css')
    return css()
  },

  // JSON
  json: async () => {
    const { json } = await import('@codemirror/lang-json')
    return json()
  },
  jsonc: async () => {
    const { json } = await import('@codemirror/lang-json')
    return json()
  },

  // Markdown
  md: async () => {
    const { markdown } = await import('@codemirror/lang-markdown')
    return markdown()
  },
  mdx: async () => {
    const { markdown } = await import('@codemirror/lang-markdown')
    return markdown()
  },

  // XML / SVG
  xml: async () => {
    const { xml } = await import('@codemirror/lang-xml')
    return xml()
  },
  svg: async () => {
    const { xml } = await import('@codemirror/lang-xml')
    return xml()
  },

  // YAML
  yml: async () => {
    const { yaml } = await import('@codemirror/lang-yaml')
    return yaml()
  },
  yaml: async () => {
    const { yaml } = await import('@codemirror/lang-yaml')
    return yaml()
  },

  // Rust
  rs: async () => {
    const { rust } = await import('@codemirror/lang-rust')
    return rust()
  },

  // SQL
  sql: async () => {
    const { sql } = await import('@codemirror/lang-sql')
    return sql()
  },

  // Java
  java: async () => {
    const { java } = await import('@codemirror/lang-java')
    return java()
  },

  // C / C++
  c: async () => {
    const { cpp } = await import('@codemirror/lang-cpp')
    return cpp()
  },
  cpp: async () => {
    const { cpp } = await import('@codemirror/lang-cpp')
    return cpp()
  },
  h: async () => {
    const { cpp } = await import('@codemirror/lang-cpp')
    return cpp()
  },
  hpp: async () => {
    const { cpp } = await import('@codemirror/lang-cpp')
    return cpp()
  },
  cc: async () => {
    const { cpp } = await import('@codemirror/lang-cpp')
    return cpp()
  },
  hh: async () => {
    const { cpp } = await import('@codemirror/lang-cpp')
    return cpp()
  },

  // PHP
  php: async () => {
    const { php } = await import('@codemirror/lang-php')
    return php()
  },

  // Go
  go: async () => {
    const { go } = await import('@codemirror/lang-go')
    return go()
  },
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the file extension from a filename or path.
 *
 * Returns the lowercased extension without the leading dot, or an empty
 * string if no extension is present.
 */
function getExtension(filename: string): string {
  const base = filename.includes('/') ? filename.split('/').pop()! : filename
  const dotIndex = base.lastIndexOf('.')
  if (dotIndex <= 0) return ''
  return base.slice(dotIndex + 1).toLowerCase()
}

/**
 * Get a CodeMirror language `Extension` for the given filename.
 *
 * The language grammar is lazy-loaded on first use and then cached for all
 * subsequent calls. Returns `null` for unrecognized file extensions --
 * CodeMirror will still render the file, just without syntax highlighting.
 *
 * @param filename - File name or full path (e.g. "index.tsx", "src/lib/utils.py")
 * @returns The CodeMirror language extension, or `null` if no mapping exists
 */
export async function getLanguageExtension(filename: string): Promise<Extension | null> {
  const ext = getExtension(filename)
  if (!ext) return null

  // Return cached promise if a load is already in-flight or resolved
  const cached = languageCache.get(ext)
  if (cached) return cached

  // Find the loader: custom registry takes precedence over built-in
  const loader = customLoaders.get(ext) ?? extensionLoaders[ext]
  if (!loader) return null

  // Store the promise immediately to prevent concurrent duplicate loads
  const promise = loader().catch((err) => {
    // Remove from cache so the next call retries
    languageCache.delete(ext)
    throw err
  })
  languageCache.set(ext, promise)
  return promise
}
