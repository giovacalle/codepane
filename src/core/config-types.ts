// ---------------------------------------------------------------------------
// codepane — Configuration Persistence Types
// ---------------------------------------------------------------------------
// Pluggable storage for editor UI state. Each component persists its own
// config slice under a namespace, enabling lazy loading and independent
// persistence. The default adapter uses localStorage; consumers can swap
// in any backend (IndexedDB, REST API, custom DB).
// ---------------------------------------------------------------------------

import type { Disposable, DeepPartial, EditorTheme } from './types';

// ---------------------------------------------------------------------------
// Storage Adapter Interface
// ---------------------------------------------------------------------------

/**
 * Pluggable persistence backend for editor configuration.
 *
 * Consumers implement this interface to store config wherever they want.
 * The editor handles debouncing, merging, and namespace management.
 *
 * @example
 * ```ts
 * // Custom REST API adapter
 * const apiAdapter: ConfigStorageAdapter = {
 *   load: (ns) => fetch(`/api/config/${ns}`).then(r => r.json()),
 *   save: (ns, data) => fetch(`/api/config/${ns}`, {
 *     method: 'PUT',
 *     body: JSON.stringify(data),
 *   }).then(() => {}),
 * };
 *
 * <Editor.Root adapter={fsAdapter} config={{ storage: apiAdapter }}>
 * ```
 */
export interface ConfigStorageAdapter {
  /**
   * Load configuration for a namespace.
   *
   * @param namespace - Config namespace (e.g. "editor:theme", "editor:layout")
   * @returns The stored config data, or `null` if nothing is saved
   */
  load(namespace: string): Promise<unknown | null>;

  /**
   * Save configuration for a namespace.
   *
   * @param namespace - Config namespace
   * @param data - The config data to persist (JSON-serializable)
   */
  save(namespace: string, data: unknown): Promise<void>;

  /**
   * Subscribe to external config changes (e.g. from another browser tab).
   *
   * Optional. When provided, enables cross-tab/cross-window config sync.
   *
   * @param namespace - Config namespace to watch
   * @param callback - Called when config changes externally
   * @returns Disposable to stop listening
   */
  subscribe?(namespace: string, callback: (data: unknown) => void): Disposable;
}

// ---------------------------------------------------------------------------
// Config Namespace Types
// ---------------------------------------------------------------------------

/** Configuration for the overall editor instance. */
export interface EditorRootConfig {
  /** Pluggable storage backend. Defaults to localStorage. */
  storage?: ConfigStorageAdapter;
  /** Prefix for all config namespaces. Defaults to "editor". */
  prefix?: string;
  /** Debounce delay in ms before persisting changes. Defaults to 300. */
  debounceMs?: number;
  /** Disable persistence entirely (useful for embedded/demo mode). */
  disabled?: boolean;
}

/** Persisted theme overrides. */
export interface ThemeConfig {
  overrides?: DeepPartial<EditorTheme>;
}

/** Persisted layout state (panel sizes, collapsed panels). */
export interface LayoutConfig {
  /** Panel sizes by panel id (percentage 0-100). */
  panelSizes?: Record<string, number>;
  /** Set of collapsed panel ids. */
  collapsedPanels?: string[];
  /** Panel group direction overrides. */
  directions?: Record<string, 'horizontal' | 'vertical'>;
}

/** Persisted file tree state. */
export interface FileTreeConfig {
  showHidden?: boolean;
  showIgnored?: boolean;
  sortOrder?: 'name' | 'type' | 'modified';
  /** Expanded directory paths (restored on mount). */
  expandedPaths?: string[];
}

/** Persisted content editor state. */
export interface ContentConfig {
  fontSize?: number;
  fontFamily?: string;
  tabSize?: number;
  wordWrap?: boolean;
  lineNumbers?: boolean;
  minimap?: boolean;
}

/** Persisted tab state. */
export interface TabsConfig {
  /** File paths of open tabs (order preserved). */
  openPaths?: string[];
  /** Path of the active tab. */
  activePath?: string;
  /** File paths of pinned tabs. */
  pinnedPaths?: string[];
}

/** Persisted search preferences. */
export interface SearchConfig {
  caseSensitive?: boolean;
  isRegex?: boolean;
  scope?: 'files' | 'content';
  /** Last N search queries for history. */
  recentQueries?: string[];
}

// ---------------------------------------------------------------------------
// Well-Known Namespace Keys
// ---------------------------------------------------------------------------

/**
 * Well-known config namespace suffixes.
 *
 * The full namespace is `{prefix}:{key}`, e.g. `editor:theme`.
 * Consumers can use any string as a namespace for custom config.
 */
export const CONFIG_NAMESPACES = {
  THEME: 'theme',
  LAYOUT: 'layout',
  FILE_TREE: 'fileTree',
  CONTENT: 'content',
  TABS: 'tabs',
  SEARCH: 'search',
} as const;

export type ConfigNamespace = (typeof CONFIG_NAMESPACES)[keyof typeof CONFIG_NAMESPACES];
