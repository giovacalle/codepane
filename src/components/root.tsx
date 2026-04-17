// ---------------------------------------------------------------------------
// codepane — Editor.Root Component
// ---------------------------------------------------------------------------
// The top-level compound component that initializes the editor:
//   1. Creates a Zustand store instance (one per mount)
//   2. Merges the user's partial theme with defaults
//   3. Applies CSS custom properties to the root DOM element
//   4. Loads the initial directory tree
//   5. Opens any default files
//   6. Wraps children in the EditorProvider context
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useMemo, type ReactNode } from 'react'

import type { FileSystemAdapter } from '../adapters/types'
import type { DeepPartial, EditorError, EditorTheme } from '../core/types'
import type { EditorRootConfig } from '../core/config-types'
import { createEditorStore } from '../core/store'
import { EditorProvider } from '../core/context'
import {
  defaultDarkTheme,
  mergeTheme,
  applyThemeToElement,
  removeThemeFromElement,
} from '../core/theme'
import { createLocalStorageAdapter } from '../core/config-storage'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorRootProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onError'> {
  /** Filesystem adapter that the editor uses for all file operations. */
  adapter: FileSystemAdapter

  /** Partial theme overrides merged with the default dark theme. */
  theme?: DeepPartial<EditorTheme>

  /**
   * Root directory path to load on mount.
   * @default "."
   */
  rootPath?: string

  /** File paths to open as tabs on initial mount. */
  defaultOpenFiles?: string[]

  /**
   * Configuration persistence options.
   *
   * @default localStorage adapter with "editor" prefix and 300ms debounce.
   * Set `{ disabled: true }` to disable persistence entirely.
   *
   * @example
   * ```tsx
   * // Custom REST API storage
   * <Editor.Root adapter={fs} config={{ storage: myApiAdapter }}>
   *
   * // Disable persistence
   * <Editor.Root adapter={fs} config={{ disabled: true }}>
   * ```
   */
  config?: EditorRootConfig

  /** Child Editor.* components (Sidebar, Tabs, Content, etc.). */
  children: ReactNode

  /** CSS class applied to the outermost container. */
  className?: string

  /** Inline styles merged with the root element's default styles. */
  style?: React.CSSProperties

  // -- Callbacks -------------------------------------------------------------

  /** Called when a file is opened (new tab created or activated). */
  onFileOpen?: (path: string) => void

  /** Called after a file has been saved successfully. */
  onFileSave?: (path: string) => void

  /** Called when file content is modified (dirty state changes). */
  onFileChange?: (path: string, content: string) => void

  /** Called when an error occurs within the editor. */
  onError?: (error: EditorError) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Root component for the composable editor.
 *
 * Creates an isolated Zustand store instance, so multiple `<Editor.Root>`
 * components can coexist on the same page without shared state.
 *
 * @example
 * ```tsx
 * <Editor.Root adapter={httpAdapter} rootPath="." theme={{ colors: { accent: '#ff0' } }}>
 *   <Editor.Sidebar />
 *   <Editor.Tabs />
 *   <Editor.Content />
 * </Editor.Root>
 * ```
 */
// Default config debounce delay (ms)
const DEFAULT_DEBOUNCE_MS = 300
const DEFAULT_PREFIX = 'editor'

export function EditorRoot({
  adapter,
  theme: themeOverrides,
  rootPath = '.',
  defaultOpenFiles,
  config: configOptions,
  children,
  className,
  style,
  onFileOpen,
  onFileSave,
  onFileChange,
  onError,
  ...rest
}: EditorRootProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // -- Store (stable across re-renders, recreated only if rootPath changes) --
  const storeRef = useRef<ReturnType<typeof createEditorStore> | null>(null)
  if (!storeRef.current) {
    storeRef.current = createEditorStore(rootPath)
  }
  const store = storeRef.current

  // -- Config storage (stable across re-renders) ------------------------------
  const configDisabled = configOptions?.disabled ?? false
  const configPrefix = configOptions?.prefix ?? DEFAULT_PREFIX
  const configDebounceMs = configOptions?.debounceMs ?? DEFAULT_DEBOUNCE_MS

  const configStorageRef = useRef(
    configDisabled
      ? null
      : (configOptions?.storage ?? createLocalStorageAdapter({ prefix: configPrefix })),
  )

  // -- Theme (recomputed when overrides change) ------------------------------
  const resolvedTheme = useMemo(
    () => (themeOverrides ? mergeTheme(defaultDarkTheme, themeOverrides) : defaultDarkTheme),
    [themeOverrides],
  )

  // -- Inject adapter into store ---------------------------------------------
  useEffect(() => {
    store.getState().setAdapter(adapter)
  }, [store, adapter])

  // -- Apply CSS custom properties -------------------------------------------
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    applyThemeToElement(el, resolvedTheme)

    return () => {
      removeThemeFromElement(el)
    }
  }, [resolvedTheme])

  // -- Load root directory on mount ------------------------------------------
  useEffect(() => {
    store.getState().loadDirectory(rootPath)
  }, [store, rootPath])

  // -- Watch for filesystem changes (live reload) ----------------------------
  useEffect(() => {
    if (!adapter.capabilities.watch || !adapter.watch) return

    const disposable = adapter.watch(rootPath, (event) => {
      const state = store.getState()

      switch (event.type) {
        case 'created':
        case 'deleted':
        case 'renamed':
          state.refreshTree()
          break

        case 'modified': {
          // Only reload content for open, non-dirty files.
          const isOpen = state.tabs.some((t) => t.path === event.path)
          if (isOpen && !state.dirtyFiles.has(event.path)) {
            adapter.readFile(event.path).then(
              (content) => store.getState().updateFileContentFromExternal(event.path, content),
              () => {
                /* File may have been deleted between event and read — ignore */
              },
            )
          }
          break
        }
      }
    })

    return () => {
      disposable.dispose()
    }
  }, [store, adapter, rootPath])

  // -- Open default files on mount -------------------------------------------
  useEffect(() => {
    if (!defaultOpenFiles || defaultOpenFiles.length === 0) return

    // Open files sequentially to maintain tab order.
    let cancelled = false

    ;(async () => {
      for (const filePath of defaultOpenFiles) {
        if (cancelled) break
        await store.getState().openFile(filePath)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [store, defaultOpenFiles])

  // -- Subscribe to store for callbacks --------------------------------------
  useEffect(() => {
    if (!onError) return

    const unsubscribe = store.subscribe((state, prevState) => {
      if (state.error && state.error !== prevState.error) {
        onError(state.error)
      }
    })

    return unsubscribe
  }, [store, onError])

  useEffect(() => {
    if (!onFileOpen) return

    const unsubscribe = store.subscribe((state, prevState) => {
      if (state.activeTabId && state.activeTabId !== prevState.activeTabId) {
        const tab = state.tabs.find((t) => t.id === state.activeTabId)
        if (tab) {
          onFileOpen(tab.path)
        }
      }
    })

    return unsubscribe
  }, [store, onFileOpen])

  useEffect(() => {
    if (!onFileSave) return

    const unsubscribe = store.subscribe((state, prevState) => {
      // Detect when a file leaves the dirty map (was saved).
      for (const [path] of prevState.dirtyFiles) {
        if (!state.dirtyFiles.has(path)) {
          onFileSave(path)
        }
      }
    })

    return unsubscribe
  }, [store, onFileSave])

  useEffect(() => {
    if (!onFileChange) return

    const unsubscribe = store.subscribe((state, prevState) => {
      // Detect new or changed entries in dirtyFiles.
      for (const [path, content] of state.dirtyFiles) {
        if (prevState.dirtyFiles.get(path) !== content) {
          onFileChange(path, content)
        }
      }
    })

    return unsubscribe
  }, [store, onFileChange])

  // -- Built-in keyboard shortcuts -------------------------------------------
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isMod = event.metaKey || event.ctrlKey

      // Cmd/Ctrl+S — Save active file
      if (isMod && event.key === 's' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        const state = store.getState()
        if (state.activeTabId) {
          const tab = state.tabs.find((t) => t.id === state.activeTabId)
          if (tab && state.dirtyFiles.has(tab.path)) {
            state.saveFile(tab.path)
          }
        }
        return
      }

      // Cmd/Ctrl+W — Close active tab
      if (isMod && event.key === 'w' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        const state = store.getState()
        if (state.activeTabId) {
          state.closeTab(state.activeTabId)
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [store])

  // -- Context value (stable reference when inputs are stable) ---------------
  const contextValue = useMemo(
    () => ({
      store,
      adapter,
      theme: resolvedTheme,
      rootPath,
      configStorage: configStorageRef.current,
      configPrefix,
      configDebounceMs,
      configDisabled,
    }),
    [store, adapter, resolvedTheme, rootPath, configPrefix, configDebounceMs, configDisabled],
  )

  return (
    <div
      ref={containerRef}
      data-editor-root=""
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        fontFamily: resolvedTheme.fonts.ui,
        fontSize: `${resolvedTheme.fonts.uiSize}px`,
        color: resolvedTheme.colors.foreground,
        backgroundColor: resolvedTheme.colors.background,
        borderRadius: `${resolvedTheme.borderRadius}px`,
        ...style,
      }}
      {...rest}
    >
      <EditorProvider value={contextValue}>{children}</EditorProvider>
    </div>
  )
}
