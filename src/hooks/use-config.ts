// ---------------------------------------------------------------------------
// codepane — useConfig Hook
// ---------------------------------------------------------------------------
// Public hook for reading/writing per-namespace config with auto-debounce
// persistence. Each component gets its own config slice. Custom panels can
// use any namespace string to persist their own state.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Disposable } from '../core/types'
import type { ConfigStorageAdapter } from '../core/config-types'
import { useEditorContext } from '../core/context'

// ---------------------------------------------------------------------------
// In-process event bus for same-tab config sync between useConfig instances
// ---------------------------------------------------------------------------

type ConfigListener = (data: unknown) => void
const configBus = new Map<string, Set<ConfigListener>>()

function emitConfigChange(namespace: string, data: unknown): void {
  const listeners = configBus.get(namespace)
  if (!listeners) return
  for (const listener of listeners) {
    try {
      listener(data)
    } catch {
      /* swallow */
    }
  }
}

function onConfigChange(namespace: string, listener: ConfigListener): () => void {
  if (!configBus.has(namespace)) configBus.set(namespace, new Set())
  configBus.get(namespace)!.add(listener)
  return () => {
    const set = configBus.get(namespace)
    if (set) {
      set.delete(listener)
      if (set.size === 0) configBus.delete(namespace)
    }
  }
}

/** Options for the useConfig hook. */
export interface UseConfigOptions<T> {
  /** Default config values. Loaded config is merged on top of this. */
  defaults: T
  /** Override debounce delay for this namespace (ms). */
  debounceMs?: number
}

/** Return type of the useConfig hook. */
export interface UseConfigReturn<T> {
  /** Current config state (merged: defaults + persisted + runtime changes). */
  config: T
  /** Update one or more config fields. Auto-persists after debounce. */
  setConfig: (patch: Partial<T>) => void
  /** Replace the entire config. Auto-persists after debounce. */
  replaceConfig: (next: T) => void
  /** Reset config to defaults and clear persisted data. */
  resetConfig: () => void
  /** Whether the initial load from storage is still in progress. */
  isLoading: boolean
}

/**
 * Read and write per-namespace config with automatic debounced persistence.
 *
 * Each call creates an isolated config slice identified by `namespace`.
 * Changes are debounced (default 300ms) before being written to the
 * storage adapter. On mount, persisted config is loaded and merged with
 * the provided defaults.
 *
 * @param namespace - Unique config key (e.g. "fileTree", "content", or a custom string)
 * @param options - Default values and optional overrides
 *
 * @example
 * ```tsx
 * function MyPanel() {
 *   const { config, setConfig } = useConfig('myPanel', {
 *     defaults: { collapsed: false, zoom: 1.0 },
 *   });
 *
 *   return (
 *     <div style={{ zoom: config.zoom }}>
 *       <button onClick={() => setConfig({ collapsed: !config.collapsed })}>
 *         Toggle
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useConfig<T extends Record<string, unknown>>(
  namespace: string,
  options: UseConfigOptions<T>,
): UseConfigReturn<T> {
  const { configStorage, configPrefix, configDebounceMs, configDisabled } = useEditorContext()

  const fullNamespace = `${configPrefix}:${namespace}`
  const debounceMs = options.debounceMs ?? configDebounceMs

  // Stabilize defaults reference to avoid effect re-runs when callers
  // pass inline object literals. The ref is initialized once on mount.
  const defaultsRef = useRef(options.defaults)

  const [config, setConfigState] = useState<T>(options.defaults)
  const [isLoading, setIsLoading] = useState(!configDisabled)

  // Refs to avoid stale closures in debounced save
  const configRef = useRef(config)
  configRef.current = config

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const storageRef = useRef<ConfigStorageAdapter | null>(configStorage)
  storageRef.current = configStorage

  // Track this instance to avoid reacting to own emissions
  const instanceId = useRef(Math.random().toString(36).slice(2))

  // Persist config with debounce + notify other same-tab instances
  const persistConfig = useCallback(
    (data: T) => {
      // Notify other useConfig instances in the same tab immediately
      emitConfigChange(fullNamespace, { data, source: instanceId.current })

      if (configDisabled || !storageRef.current) return

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }

      debounceTimer.current = setTimeout(() => {
        storageRef.current?.save(fullNamespace, data).catch(() => {
          // Persistence failure is non-critical
        })
        debounceTimer.current = null
      }, debounceMs)
    },
    [fullNamespace, debounceMs, configDisabled],
  )

  // Load persisted config on mount
  useEffect(() => {
    if (configDisabled || !configStorage) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    configStorage
      .load(fullNamespace)
      .then((stored) => {
        if (cancelled) return
        if (stored !== null && typeof stored === 'object') {
          setConfigState((prev) => ({ ...prev, ...(stored as Partial<T>) }))
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fullNamespace, configStorage, configDisabled])

  // Subscribe to same-tab changes from other useConfig instances
  useEffect(() => {
    return onConfigChange(fullNamespace, (msg: unknown) => {
      const { data, source } = msg as { data: unknown; source: string }
      if (source === instanceId.current) return // ignore own emissions
      if (data !== null && typeof data === 'object') {
        setConfigState((prev) => ({ ...prev, ...(data as Partial<T>) }))
      }
    })
  }, [fullNamespace])

  // Subscribe to external changes (cross-tab sync)
  useEffect(() => {
    if (configDisabled || !configStorage?.subscribe) return

    const sub: Disposable = configStorage.subscribe(fullNamespace, (data) => {
      if (data !== null && typeof data === 'object') {
        setConfigState((prev) => ({
          ...prev,
          ...(data as Partial<T>),
        }))
      }
    })

    return () => sub.dispose()
  }, [fullNamespace, configStorage, configDisabled])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        // Flush pending save immediately on unmount
        clearTimeout(debounceTimer.current)
        if (!configDisabled && storageRef.current) {
          storageRef.current.save(fullNamespace, configRef.current).catch(() => {})
        }
      }
    }
  }, [fullNamespace, configDisabled])

  const setConfig = useCallback(
    (patch: Partial<T>) => {
      setConfigState((prev) => {
        const next = { ...prev, ...patch }
        persistConfig(next)
        return next
      })
    },
    [persistConfig],
  )

  const replaceConfig = useCallback(
    (next: T) => {
      setConfigState(next)
      persistConfig(next)
    },
    [persistConfig],
  )

  const resetConfig = useCallback(() => {
    setConfigState(defaultsRef.current)

    if (!configDisabled && storageRef.current) {
      storageRef.current.save(fullNamespace, defaultsRef.current).catch(() => {})
    }
  }, [fullNamespace, configDisabled])

  return { config, setConfig, replaceConfig, resetConfig, isLoading }
}
