// ---------------------------------------------------------------------------
// codepane — Built-in Config Storage Adapters
// ---------------------------------------------------------------------------

import type { Disposable } from './types'
import type { ConfigStorageAdapter } from './config-types'

// ---------------------------------------------------------------------------
// localStorage Adapter
// ---------------------------------------------------------------------------

export interface LocalStorageAdapterConfig {
  /**
   * Key prefix in localStorage. Defaults to "editor".
   * Full key format: `{prefix}:{namespace}`
   */
  prefix?: string
}

/**
 * Creates a config storage adapter backed by `localStorage`.
 *
 * Supports cross-tab sync via the `storage` event — when config changes
 * in another tab, subscribers are notified automatically.
 *
 * @example
 * ```ts
 * const storage = createLocalStorageAdapter({ prefix: 'my-editor' });
 *
 * <Editor.Root adapter={fsAdapter} config={{ storage }}>
 * ```
 */
export function createLocalStorageAdapter(
  config?: LocalStorageAdapterConfig,
): ConfigStorageAdapter {
  const prefix = config?.prefix ?? 'editor'

  function makeKey(namespace: string): string {
    return `${prefix}:${namespace}`
  }

  return {
    async load(namespace: string): Promise<unknown | null> {
      try {
        const raw = localStorage.getItem(makeKey(namespace))
        if (raw === null) return null
        return JSON.parse(raw)
      } catch {
        // Corrupted data — treat as missing
        return null
      }
    },

    async save(namespace: string, data: unknown): Promise<void> {
      try {
        localStorage.setItem(makeKey(namespace), JSON.stringify(data))
      } catch {
        // localStorage full or unavailable — silently fail
        // Config is non-critical; the editor works fine without persistence
      }
    },

    subscribe(namespace: string, callback: (data: unknown) => void): Disposable {
      const key = makeKey(namespace)

      const handler = (event: StorageEvent) => {
        if (event.key !== key || event.storageArea !== localStorage) return

        try {
          const data = event.newValue ? JSON.parse(event.newValue) : null
          callback(data)
        } catch {
          // Corrupted data — ignore
        }
      }

      window.addEventListener('storage', handler)

      return {
        dispose() {
          window.removeEventListener('storage', handler)
        },
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Memory Adapter (for testing & demos)
// ---------------------------------------------------------------------------

/**
 * Creates an in-memory config storage adapter.
 *
 * Config is lost on page refresh. Useful for testing, Storybook, and
 * embedded demos where persistence is not desired.
 *
 * @example
 * ```ts
 * const storage = createMemoryConfigAdapter();
 *
 * <Editor.Root adapter={fsAdapter} config={{ storage, disabled: false }}>
 * ```
 */
export function createMemoryConfigAdapter(): ConfigStorageAdapter {
  const store = new Map<string, unknown>()
  const subscribers = new Map<string, Set<(data: unknown) => void>>()

  return {
    async load(namespace: string): Promise<unknown | null> {
      return store.get(namespace) ?? null
    },

    async save(namespace: string, data: unknown): Promise<void> {
      store.set(namespace, data)

      // Notify subscribers (simulates cross-tab sync for testing)
      const callbacks = subscribers.get(namespace)
      if (callbacks) {
        for (const cb of callbacks) {
          try {
            cb(data)
          } catch {
            // Swallow subscriber errors
          }
        }
      }
    },

    subscribe(namespace: string, callback: (data: unknown) => void): Disposable {
      if (!subscribers.has(namespace)) {
        subscribers.set(namespace, new Set())
      }
      subscribers.get(namespace)!.add(callback)

      return {
        dispose() {
          const callbacks = subscribers.get(namespace)
          if (callbacks) {
            callbacks.delete(callback)
            if (callbacks.size === 0) {
              subscribers.delete(namespace)
            }
          }
        },
      }
    },
  }
}
