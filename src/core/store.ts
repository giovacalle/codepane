// ---------------------------------------------------------------------------
// codepane — Internal Zustand Store
// ---------------------------------------------------------------------------
// Instance-based store created per Editor.Root mount. NOT exported from the
// package — consumers interact with the store through context hooks only.
//
// Uses `createStore` (not `create`) so each Editor.Root gets its own isolated
// store instance, supporting multiple editors on the same page.
// ---------------------------------------------------------------------------

import { createStore } from 'zustand/vanilla'

import type { FileSystemAdapter } from '../adapters/types'
import type { EditorError, FileEntry, FlatTreeNode, SearchResult, Tab } from './types'

// ---------------------------------------------------------------------------
// Store State
// ---------------------------------------------------------------------------

export interface EditorStoreState {
  // -- File tree (flat for virtualization) -----------------------------------
  tree: FlatTreeNode[]
  expandedPaths: Set<string>
  selectedPath: string | null
  treeLoading: Map<string, boolean>

  // -- Tree cache (nested structure from adapter) ----------------------------
  treeCache: Map<string, FileEntry[]>

  // -- Tabs ------------------------------------------------------------------
  tabs: Tab[]
  activeTabId: string | null

  // -- Editor content --------------------------------------------------------
  fileContents: Map<string, string>
  dirtyFiles: Map<string, string>

  // -- Search ----------------------------------------------------------------
  searchQuery: string
  searchScope: 'files' | 'content'
  searchResults: SearchResult[] | null
  searchLoading: boolean

  // -- Cursor ----------------------------------------------------------------
  cursorLine: number
  cursorCol: number
  cursorSelection: { from: number; to: number } | null
  cursorPositions: Map<string, { line: number; col: number; scrollTop?: number }>

  // -- UI --------------------------------------------------------------------
  focusedPanel: string | null
  error: EditorError | null

  // -- Actions ---------------------------------------------------------------
  setAdapter: (adapter: FileSystemAdapter) => void
  loadDirectory: (path: string) => Promise<void>
  expandDir: (path: string) => Promise<void>
  collapseDir: (path: string) => void
  toggleDir: (path: string) => Promise<void>
  selectFile: (path: string) => void
  openFile: (path: string, options?: { preview?: boolean }) => Promise<void>
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateFileContent: (path: string, content: string) => void
  saveFile: (path: string) => Promise<void>
  search: (query: string, scope?: 'files' | 'content') => Promise<void>
  clearSearch: () => void
  replaceOne: (
    path: string,
    match: { line: number; column: number; length: number },
    replaceText: string,
  ) => Promise<void>
  replaceAll: (replaceText: string) => Promise<void>
  setCursorPosition: (
    line: number,
    col: number,
    selection?: { from: number; to: number } | null,
  ) => void
  saveCursorPosition: (
    path: string,
    position: { line: number; col: number; scrollTop?: number },
  ) => void
  getCursorPosition: (path: string) => { line: number; col: number; scrollTop?: number } | null
  setError: (error: EditorError | null) => void
  refreshTree: (path?: string) => Promise<void>
  updateFileContentFromExternal: (path: string, content: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sort entries: directories first (alphabetical), then files (alphabetical).
 * Comparison is case-insensitive.
 */
function sortEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

/**
 * Build a flat array of `FlatTreeNode` from the hierarchical tree cache.
 *
 * Walks the cache starting from `rootPath`, only descending into directories
 * whose path is in `expandedPaths`. This produces the exact array needed
 * for virtualized rendering.
 */
function buildFlatTree(
  treeCache: Map<string, FileEntry[]>,
  expandedPaths: Set<string>,
  rootPath: string,
): FlatTreeNode[] {
  const nodes: FlatTreeNode[] = []

  function walk(dirPath: string, depth: number): void {
    const children = treeCache.get(dirPath)
    if (!children) return

    const sorted = sortEntries(children)

    for (const entry of sorted) {
      const isExpanded = entry.isDirectory && expandedPaths.has(entry.path)

      nodes.push({
        path: entry.path,
        name: entry.name,
        isDirectory: entry.isDirectory,
        depth,
        isExpanded,
        parentPath: dirPath === rootPath ? null : dirPath,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
        isHidden: entry.isHidden,
        isIgnored: entry.isIgnored,
      })

      if (isExpanded) {
        walk(entry.path, depth + 1)
      }
    }
  }

  walk(rootPath, 0)
  return nodes
}

/** Generate a stable tab ID from a file path. */
function tabIdFromPath(path: string): string {
  return `tab:${path}`
}

/** Extract a display label from a file path. */
function labelFromPath(path: string): string {
  const segments = path.split('/')
  return segments[segments.length - 1] || path
}

/**
 * Replace a substring within a specific line of a multi-line string.
 * Returns the full content with the replacement applied.
 */
function applyLineReplacement(
  content: string,
  match: { line: number; column: number; length: number },
  replaceText: string,
): string | null {
  const lines = content.split('\n')
  const lineIndex = match.line - 1
  if (lineIndex < 0 || lineIndex >= lines.length) return null
  const line = lines[lineIndex]
  lines[lineIndex] =
    line.substring(0, match.column) + replaceText + line.substring(match.column + match.length)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Store Factory
// ---------------------------------------------------------------------------

/**
 * Create a new editor store instance.
 *
 * @param rootPath - The root directory path to load on initialization
 */
export function createEditorStore(rootPath: string) {
  // Each store instance gets its own adapter reference via closure.
  let adapter: FileSystemAdapter | null = null

  const store = createStore<EditorStoreState>((set, get) => {
    /** Shared helper: update fileContents, clear dirty state, mark tab clean. */
    function commitWrite(path: string, content: string) {
      const nextContents = new Map(get().fileContents)
      nextContents.set(path, content)
      const nextDirty = new Map(get().dirtyFiles)
      nextDirty.delete(path)
      const tabId = tabIdFromPath(path)
      const nextTabs = get().tabs.map((t) => (t.id === tabId ? { ...t, isDirty: false } : t))
      set({ fileContents: nextContents, dirtyFiles: nextDirty, tabs: nextTabs })
    }

    return {
      // -- Initial state -------------------------------------------------------
      tree: [],
      expandedPaths: new Set<string>(),
      selectedPath: null,
      treeLoading: new Map<string, boolean>(),
      treeCache: new Map<string, FileEntry[]>(),
      tabs: [],
      activeTabId: null,
      fileContents: new Map<string, string>(),
      dirtyFiles: new Map<string, string>(),
      searchQuery: '',
      searchScope: 'files' as const,
      searchResults: null,
      searchLoading: false,
      cursorLine: 1,
      cursorCol: 1,
      cursorSelection: null,
      cursorPositions: new Map(),
      focusedPanel: null,
      error: null,

      // -- Actions -------------------------------------------------------------

      setAdapter(newAdapter: FileSystemAdapter) {
        adapter = newAdapter
      },

      async loadDirectory(path: string) {
        if (!adapter) return

        const { treeCache, treeLoading } = get()
        const nextLoading = new Map(treeLoading)
        nextLoading.set(path, true)
        set({ treeLoading: nextLoading })

        try {
          const entries = await adapter.readDirectory(path)

          // Read treeCache AFTER the await to include any concurrent updates
          const freshCache = new Map(get().treeCache)
          freshCache.set(path, entries)

          const { expandedPaths } = get()
          const tree = buildFlatTree(freshCache, expandedPaths, rootPath)

          const doneLoading = new Map(get().treeLoading)
          doneLoading.delete(path)

          set({ treeCache: freshCache, tree, treeLoading: doneLoading })
        } catch (err) {
          const doneLoading = new Map(get().treeLoading)
          doneLoading.delete(path)

          set({
            treeLoading: doneLoading,
            error: {
              code: 'ADAPTER_ERROR',
              message: err instanceof Error ? err.message : String(err),
              path,
            },
          })
        }
      },

      async expandDir(path: string) {
        const { expandedPaths, treeCache } = get()
        if (expandedPaths.has(path)) return

        const nextExpanded = new Set(expandedPaths)
        nextExpanded.add(path)
        set({ expandedPaths: nextExpanded })

        // Load children if not already cached.
        if (!treeCache.has(path)) {
          await get().loadDirectory(path)
        } else {
          // Already cached — just rebuild the flat tree.
          const tree = buildFlatTree(get().treeCache, nextExpanded, rootPath)
          set({ tree })
        }
      },

      collapseDir(path: string) {
        const { expandedPaths, treeCache } = get()
        if (!expandedPaths.has(path)) return

        const nextExpanded = new Set(expandedPaths)
        nextExpanded.delete(path)

        const tree = buildFlatTree(treeCache, nextExpanded, rootPath)
        set({ expandedPaths: nextExpanded, tree })
      },

      async toggleDir(path: string) {
        const { expandedPaths } = get()
        if (expandedPaths.has(path)) {
          get().collapseDir(path)
        } else {
          await get().expandDir(path)
        }
      },

      selectFile(path: string) {
        set({ selectedPath: path })
      },

      async openFile(path: string, options?: { preview?: boolean }) {
        if (!adapter) return

        const isPreview = options?.preview ?? false
        const { tabs, fileContents } = get()
        const tabId = tabIdFromPath(path)

        // If a tab for this file already exists, activate it.
        const existing = tabs.find((t) => t.id === tabId)
        if (existing) {
          // If the existing tab is a preview and we're opening non-preview,
          // promote it to a permanent tab.
          if (existing.isPreview && !isPreview) {
            const updatedTabs = tabs.map((t) => (t.id === tabId ? { ...t, isPreview: false } : t))
            set({ tabs: updatedTabs, activeTabId: tabId, selectedPath: path })
          } else {
            set({ activeTabId: tabId, selectedPath: path })
          }
          return
        }

        // Read file content if not cached.
        if (!fileContents.has(path)) {
          try {
            const content = await adapter.readFile(path)
            const nextContents = new Map(get().fileContents)
            nextContents.set(path, content)
            set({ fileContents: nextContents })
          } catch (err) {
            set({
              error: {
                code: 'ADAPTER_ERROR',
                message: err instanceof Error ? err.message : String(err),
                path,
              },
            })
            return
          }
        }

        // If opening a preview, replace any existing preview tab.
        let nextTabs: Tab[]
        if (isPreview) {
          nextTabs = tabs.filter((t) => !t.isPreview)
        } else {
          nextTabs = [...tabs]
        }

        const newTab: Tab = {
          id: tabId,
          path,
          label: labelFromPath(path),
          isDirty: false,
          isPinned: false,
          isPreview,
        }

        nextTabs.push(newTab)
        set({ tabs: nextTabs, activeTabId: tabId, selectedPath: path })
      },

      closeTab(tabId: string) {
        const { tabs, activeTabId, dirtyFiles, fileContents } = get()
        const tabIndex = tabs.findIndex((t) => t.id === tabId)
        if (tabIndex === -1) return

        const closingTab = tabs[tabIndex]
        const nextTabs = tabs.filter((t) => t.id !== tabId)

        // Clean up cached content for non-dirty files.
        const nextContents = new Map(fileContents)
        const nextDirty = new Map(dirtyFiles)
        if (!nextDirty.has(closingTab.path)) {
          nextContents.delete(closingTab.path)
        }
        nextDirty.delete(closingTab.path)

        // Clean up cursor position for the closed tab.
        const nextCursorPositions = new Map(get().cursorPositions)
        nextCursorPositions.delete(closingTab.path)

        // Determine next active tab.
        let nextActiveId: string | null = activeTabId
        if (activeTabId === tabId) {
          if (nextTabs.length === 0) {
            nextActiveId = null
          } else if (tabIndex < nextTabs.length) {
            nextActiveId = nextTabs[tabIndex].id
          } else {
            nextActiveId = nextTabs[nextTabs.length - 1].id
          }
        }

        set({
          tabs: nextTabs,
          activeTabId: nextActiveId,
          fileContents: nextContents,
          dirtyFiles: nextDirty,
          cursorPositions: nextCursorPositions,
        })
      },

      closeOtherTabs(tabId: string) {
        const { tabs, fileContents, dirtyFiles } = get()
        const keepTab = tabs.find((t) => t.id === tabId)
        if (!keepTab) return

        const closingTabs = tabs.filter((t) => t.id !== tabId && !t.isPinned)
        const nextTabs = tabs.filter((t) => t.id === tabId || t.isPinned)

        const nextContents = new Map(fileContents)
        const nextDirty = new Map(dirtyFiles)
        const nextCursorPositions = new Map(get().cursorPositions)
        for (const tab of closingTabs) {
          if (!nextDirty.has(tab.path)) {
            nextContents.delete(tab.path)
          }
          nextDirty.delete(tab.path)
          nextCursorPositions.delete(tab.path)
        }

        set({
          tabs: nextTabs,
          activeTabId: tabId,
          fileContents: nextContents,
          dirtyFiles: nextDirty,
          cursorPositions: nextCursorPositions,
        })
      },

      setActiveTab(tabId: string) {
        const { tabs, activeTabId, cursorLine, cursorCol } = get()
        const tab = tabs.find((t) => t.id === tabId)
        if (!tab) return

        if (activeTabId) {
          const currentTab = tabs.find((t) => t.id === activeTabId)
          if (currentTab) {
            get().saveCursorPosition(currentTab.path, { line: cursorLine, col: cursorCol })
          }
        }

        const savedPos = get().cursorPositions.get(tab.path)
        if (savedPos) {
          set({
            activeTabId: tabId,
            selectedPath: tab.path,
            cursorLine: savedPos.line,
            cursorCol: savedPos.col,
          })
        } else {
          set({ activeTabId: tabId, selectedPath: tab.path })
        }
      },

      updateFileContent(path: string, content: string) {
        const { fileContents, dirtyFiles, tabs } = get()
        const originalContent = fileContents.get(path)
        const nextDirty = new Map(dirtyFiles)
        const isDirty = originalContent !== content

        if (isDirty) {
          nextDirty.set(path, content)
        } else {
          nextDirty.delete(path)
        }

        // Update tab dirty state.
        const tabId = tabIdFromPath(path)
        const nextTabs = tabs.map((t) => (t.id === tabId ? { ...t, isDirty } : t))

        set({ dirtyFiles: nextDirty, tabs: nextTabs })
      },

      async saveFile(path: string) {
        if (!adapter) return

        const dirtyContent = get().dirtyFiles.get(path)
        if (dirtyContent === undefined) return

        try {
          await adapter.writeFile(path, dirtyContent)
          commitWrite(path, dirtyContent)
        } catch (err) {
          set({
            error: {
              code: 'ADAPTER_ERROR',
              message: err instanceof Error ? err.message : String(err),
              path,
            },
          })
        }
      },

      async search(query: string, scope: 'files' | 'content' = 'content') {
        if (!adapter) return

        set({
          searchQuery: query,
          searchScope: scope,
          searchLoading: true,
          searchResults: null,
        })

        if (!query.trim()) {
          set({ searchLoading: false, searchResults: null })
          return
        }

        try {
          if (scope === 'content' && adapter.search) {
            const results = await adapter.search({ pattern: query })
            set({ searchResults: results, searchLoading: false })
          } else if (scope === 'files') {
            // Client-side file name filtering against the cached tree.
            const { tree } = get()
            const lowerQuery = query.toLowerCase()
            const matchingPaths = tree.filter(
              (node) => !node.isDirectory && node.name.toLowerCase().includes(lowerQuery),
            )
            const results: SearchResult[] = matchingPaths.map((node) => ({
              path: node.path,
              matches: [],
            }))
            set({ searchResults: results, searchLoading: false })
          } else {
            // No server-side search available and scope is content — report empty.
            set({ searchResults: [], searchLoading: false })
          }
        } catch (err) {
          set({
            searchLoading: false,
            error: {
              code: 'ADAPTER_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          })
        }
      },

      clearSearch() {
        set({
          searchQuery: '',
          searchResults: null,
          searchLoading: false,
        })
      },

      async replaceOne(
        path: string,
        match: { line: number; column: number; length: number },
        replaceText: string,
      ) {
        if (!adapter) return

        const { searchQuery, searchScope } = get()
        const content = get().dirtyFiles.get(path) ?? get().fileContents.get(path)
        if (content === undefined) return

        const newContent = applyLineReplacement(content, match, replaceText)
        if (newContent === null) return

        try {
          await adapter.writeFile(path, newContent)
          commitWrite(path, newContent)

          if (searchQuery.trim()) {
            await get().search(searchQuery, searchScope)
          }
        } catch (err) {
          set({
            error: {
              code: 'ADAPTER_ERROR',
              message: err instanceof Error ? err.message : String(err),
              path,
            },
          })
        }
      },

      async replaceAll(replaceText: string) {
        if (!adapter) return

        const { searchResults, searchQuery, searchScope } = get()
        if (!searchResults || !searchQuery.trim()) return

        try {
          for (const result of searchResults) {
            if (!result.matches || result.matches.length === 0) continue

            // Read fresh state each iteration to avoid stale reads
            const content = get().dirtyFiles.get(result.path) ?? get().fileContents.get(result.path)
            if (content === undefined) continue

            // Process matches in reverse order to preserve offsets
            const sortedMatches = [...result.matches].sort((a, b) => {
              if (a.line !== b.line) return b.line - a.line
              return b.column - a.column
            })

            let newContent = content
            for (const match of sortedMatches) {
              const replaced = applyLineReplacement(newContent, match, replaceText)
              if (replaced !== null) newContent = replaced
            }

            await adapter.writeFile(result.path, newContent)
            commitWrite(result.path, newContent)
          }

          await get().search(searchQuery, searchScope)
        } catch (err) {
          set({
            error: {
              code: 'ADAPTER_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          })
        }
      },

      setCursorPosition(
        line: number,
        col: number,
        selection: { from: number; to: number } | null = null,
      ) {
        const state = get()
        if (
          state.cursorLine === line &&
          state.cursorCol === col &&
          state.cursorSelection?.from === selection?.from &&
          state.cursorSelection?.to === selection?.to
        ) {
          return
        }
        set({ cursorLine: line, cursorCol: col, cursorSelection: selection })
      },

      saveCursorPosition(
        path: string,
        position: { line: number; col: number; scrollTop?: number },
      ) {
        const next = new Map(get().cursorPositions)
        next.set(path, position)
        set({ cursorPositions: next })
      },

      getCursorPosition(path: string) {
        return get().cursorPositions.get(path) ?? null
      },

      setError(error: EditorError | null) {
        set({ error })
      },

      async refreshTree(path?: string) {
        const targetPath = path ?? rootPath
        await get().loadDirectory(targetPath)
      },

      updateFileContentFromExternal(path: string, content: string) {
        const { fileContents, tabs } = get()
        const nextContents = new Map(fileContents)
        nextContents.set(path, content)

        // Update the tab label if needed (path may have changed display name).
        const tabId = tabIdFromPath(path)
        const nextTabs = tabs.map((t) =>
          t.id === tabId ? { ...t, label: labelFromPath(path) } : t,
        )

        set({ fileContents: nextContents, tabs: nextTabs })
      },
    }
  })

  return store
}

// ---------------------------------------------------------------------------
// Store type export (for context)
// ---------------------------------------------------------------------------

export type EditorStore = ReturnType<typeof createEditorStore>
