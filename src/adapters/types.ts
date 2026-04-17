// ---------------------------------------------------------------------------
// codepane — Filesystem Adapter Interfaces
// ---------------------------------------------------------------------------
// The adapter layer decouples the editor from any specific backend. Consumers
// provide an adapter implementation that satisfies this interface, and the
// editor delegates all filesystem operations through it.
//
// Three built-in adapters are planned:
//   - HttpAdapter   — REST API (for Automaker server and similar backends)
//   - MemoryAdapter — In-memory (testing, Storybook, demos)
//   - NativeAdapter — File System Access API (browser-native, no server)
//
// Zero external runtime dependencies.
// ---------------------------------------------------------------------------

// Import core types for use in this file's interfaces.
import type {
  Disposable,
  FileChangeEvent,
  FileEntry,
  FileStat,
  ReadDirOptions,
  SearchQuery,
  SearchResult,
} from '../core/types'

// Re-export core types so consumers can import everything adapter-related
// from a single module.
export type {
  Disposable,
  FileChangeEvent,
  FileEntry,
  FileStat,
  ReadDirOptions,
  SearchMatch,
  SearchQuery,
  SearchResult,
} from '../core/types'

// ---------------------------------------------------------------------------
// Adapter Capabilities
// ---------------------------------------------------------------------------

/**
 * Declares which optional capabilities an adapter supports.
 *
 * The editor UI uses these flags to conditionally enable features. For
 * example, if `capabilities.search` is `false`, the editor falls back
 * to client-side search via a Web Worker.
 */
export interface AdapterCapabilities {
  /** Whether the adapter supports server-side search */
  readonly search: boolean
  /** Whether the adapter supports filesystem watching */
  readonly watch: boolean
  /** Whether the adapter can write files */
  readonly write: boolean
  /** Whether the adapter can rename files or directories */
  readonly rename: boolean
  /** Whether the adapter can delete files or directories */
  readonly delete: boolean
  /** Whether the adapter can create directories */
  readonly createDir: boolean
  /** Whether the adapter can serve binary file previews (e.g. images) */
  readonly binaryPreview: boolean
}

// ---------------------------------------------------------------------------
// FileSystemAdapter Interface
// ---------------------------------------------------------------------------

/**
 * Core abstraction that decouples the editor from any specific filesystem.
 *
 * Every editor interaction that touches files flows through this interface.
 * Implementations must handle path resolution, error mapping, and any
 * transport-specific concerns (HTTP, in-memory, native FS).
 *
 * @example
 * ```ts
 * const adapter = createHttpAdapter({ baseUrl: '/api/fs' });
 * <Editor.Root adapter={adapter}>...</Editor.Root>
 * ```
 */
export interface FileSystemAdapter {
  // -- Tree operations ------------------------------------------------------

  /**
   * List the contents of a directory.
   *
   * @param path - Directory path relative to the adapter root
   * @param options - Controls recursion depth, hidden/ignored file visibility
   * @returns Array of file entries within the directory
   */
  readDirectory(path: string, options?: ReadDirOptions): Promise<FileEntry[]>

  // -- File operations ------------------------------------------------------

  /**
   * Read the text content of a file.
   *
   * @param path - File path relative to the adapter root
   * @returns The file content as a UTF-8 string
   */
  readFile(path: string): Promise<string>

  /**
   * Write text content to a file, creating it if it does not exist.
   *
   * @param path - File path relative to the adapter root
   * @param content - The text content to write
   */
  writeFile(path: string, content: string): Promise<void>

  /**
   * Delete a file or empty directory.
   *
   * @param path - Path to the file or directory to delete
   */
  deleteFile(path: string): Promise<void>

  /**
   * Rename or move a file or directory.
   *
   * @param oldPath - Current path
   * @param newPath - Desired new path
   */
  rename(oldPath: string, newPath: string): Promise<void>

  /**
   * Create a directory (and any necessary parent directories).
   *
   * @param path - Directory path to create
   */
  createDirectory(path: string): Promise<void>

  // -- Metadata -------------------------------------------------------------

  /**
   * Retrieve detailed metadata for a file or directory.
   *
   * @param path - Path to stat
   * @returns File metadata including size, timestamps, and type
   */
  stat(path: string): Promise<FileStat>

  /**
   * Check whether a file or directory exists.
   *
   * @param path - Path to check
   * @returns `true` if the path exists
   */
  exists(path: string): Promise<boolean>

  // -- Optional capabilities ------------------------------------------------

  /**
   * Perform a server-side content search.
   *
   * Only available when `capabilities.search` is `true`. When absent, the
   * editor falls back to client-side search via a Web Worker.
   */
  search?(query: SearchQuery): Promise<SearchResult[]>

  /**
   * Watch a path for filesystem changes.
   *
   * Only available when `capabilities.watch` is `true`. Returns a
   * `Disposable` handle to stop watching.
   */
  watch?(path: string, callback: (event: FileChangeEvent) => void): Disposable

  // -- Capability declaration -----------------------------------------------

  /** Declares which optional features this adapter supports. */
  readonly capabilities: AdapterCapabilities
}

// ---------------------------------------------------------------------------
// Adapter Configuration Types
// ---------------------------------------------------------------------------

/**
 * Configuration for the HTTP/REST filesystem adapter.
 *
 * Maps editor operations to REST endpoints. Sensible defaults are provided
 * for all optional fields.
 *
 * @example
 * ```ts
 * const adapter = createHttpAdapter({
 *   baseUrl: '/api/fs',
 *   headers: { Authorization: 'Bearer token' },
 * });
 * ```
 */
export interface HttpAdapterConfig {
  /** Base URL for the filesystem REST API (e.g. "/api/fs" or "https://api.example.com/fs") */
  baseUrl: string

  /**
   * Additional HTTP headers sent with every request.
   * Accepts a static record or a function that returns one (useful for
   * rotating auth tokens).
   */
  headers?: Record<string, string> | (() => Record<string, string>)

  /**
   * Custom endpoint path overrides.
   *
   * Each key maps to a path appended to `baseUrl`. Use `:path` as a
   * placeholder for the file/directory path parameter.
   *
   * @example
   * ```ts
   * endpoints: {
   *   readDir: '/tree/:path',
   *   readFile: '/content/:path',
   * }
   * ```
   */
  endpoints?: Partial<HttpAdapterEndpoints>

  /**
   * HTTP method overrides for each operation.
   *
   * Defaults follow REST conventions (GET for reads, PUT for writes, etc.).
   */
  methods?: Partial<HttpAdapterMethods>

  /**
   * Retry configuration for network errors.
   * Only retries on network failures (fetch throws), NOT on HTTP error responses (4xx, 5xx).
   */
  retry?: {
    /** Maximum number of retry attempts. @default 3 */
    maxAttempts?: number
    /** Initial delay between retries in milliseconds. @default 1000 */
    delayMs?: number
    /** Multiplier applied to delay after each retry. @default 2 */
    backoffMultiplier?: number
  }
}

/** Endpoint path templates for the HTTP adapter. */
export interface HttpAdapterEndpoints {
  tree: string
  read: string
  write: string
  delete: string
  rename: string
  mkdir: string
  stat: string
  exists: string
  search: string
}

/** HTTP method overrides for each adapter operation. */
export interface HttpAdapterMethods {
  tree: HttpMethod
  read: HttpMethod
  write: HttpMethod
  delete: HttpMethod
  rename: HttpMethod
  mkdir: HttpMethod
  stat: HttpMethod
  exists: HttpMethod
  search: HttpMethod
}

/** Valid HTTP methods for adapter endpoints. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * Configuration for the in-memory filesystem adapter.
 *
 * Useful for testing, Storybook stories, and interactive demos where no
 * real filesystem is available.
 *
 * @example
 * ```ts
 * const adapter = createMemoryAdapter({
 *   files: {
 *     'src/index.ts': 'export const hello = "world";',
 *     'src/utils.ts': 'export function add(a: number, b: number) { return a + b; }',
 *     'README.md': '# My Project',
 *   },
 * });
 * ```
 */
export interface MemoryAdapterConfig {
  /**
   * Initial filesystem contents as a flat map of path to file content.
   *
   * Directories are inferred from the paths. For example, including
   * `"src/index.ts"` implicitly creates the `"src"` directory.
   */
  files: Record<string, string>
}
