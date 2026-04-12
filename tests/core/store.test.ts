import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEditorStore } from '../../src/core/store'
import { createMemoryAdapter } from '../../src/adapters/memory-adapter'
import type { FileSystemAdapter } from '../../src/adapters/types'

function createTestStore() {
  const adapter = createMemoryAdapter({
    files: {
      'src/index.ts': 'const x = 1',
      'src/utils/math.ts': 'export const add = (a, b) => a + b',
      'src/utils/string.ts': 'export const upper = (s) => s.toUpperCase()',
      'README.md': '# Test',
      'package.json': '{}',
    },
  })
  const store = createEditorStore('')
  store.getState().setAdapter(adapter)
  return { store, adapter }
}

describe('loadDirectory', () => {
  it('loads root directory and populates tree', async () => {
    const { store } = createTestStore()
    await store.getState().loadDirectory('')

    const { tree } = store.getState()
    expect(tree.length).toBeGreaterThan(0)
    // Root should have src (dir), README.md, package.json
    const names = tree.map((n) => n.name)
    expect(names).toContain('src')
    expect(names).toContain('README.md')
    expect(names).toContain('package.json')
  })

  it('sets treeLoading during load', async () => {
    const { store } = createTestStore()
    const promise = store.getState().loadDirectory('')

    // While loading, the path should be in treeLoading
    expect(store.getState().treeLoading.get('')).toBe(true)

    await promise

    // After loading, should be cleared
    expect(store.getState().treeLoading.has('')).toBe(false)
  })

  it('handles adapter error and sets error state', async () => {
    const store = createEditorStore('')
    const failingAdapter: FileSystemAdapter = {
      capabilities: { write: false, rename: false, delete: false, createDir: false, search: false, watch: false, binaryPreview: false },
      readDirectory: vi.fn().mockRejectedValue(new Error('read failed')),
      readFile: vi.fn().mockRejectedValue(new Error('read failed')),
      writeFile: vi.fn().mockRejectedValue(new Error('write failed')),
      deleteFile: vi.fn().mockRejectedValue(new Error('delete failed')),
      rename: vi.fn().mockRejectedValue(new Error('rename failed')),
      createDirectory: vi.fn().mockRejectedValue(new Error('create failed')),
      stat: vi.fn().mockRejectedValue(new Error('stat failed')),
      exists: vi.fn().mockResolvedValue(false),
    }
    store.getState().setAdapter(failingAdapter)

    await store.getState().loadDirectory('nonexistent')

    const { error } = store.getState()
    expect(error).not.toBeNull()
    expect(error!.code).toBe('ADAPTER_ERROR')
    expect(error!.message).toBe('read failed')
    expect(error!.path).toBe('nonexistent')
  })
})

describe('expandDir / collapseDir / toggleDir', () => {
  it('expandDir adds path to expandedPaths and loads children', async () => {
    const { store } = createTestStore()
    await store.getState().loadDirectory('')

    await store.getState().expandDir('src')

    const { expandedPaths, tree } = store.getState()
    expect(expandedPaths.has('src')).toBe(true)
    // After expanding src, we should see src/utils and src/index.ts in the tree
    const names = tree.map((n) => n.name)
    expect(names).toContain('utils')
    expect(names).toContain('index.ts')
  })

  it('expandDir with cached dir does not re-fetch', async () => {
    const { store, adapter } = createTestStore()
    await store.getState().loadDirectory('')

    const readDirSpy = vi.spyOn(adapter, 'readDirectory')

    // First expand loads children
    await store.getState().expandDir('src')
    const callsAfterFirst = readDirSpy.calls?.length ?? readDirSpy.mock.calls.length

    // Collapse then re-expand should use cache
    store.getState().collapseDir('src')
    await store.getState().expandDir('src')

    const callsAfterSecond = readDirSpy.calls?.length ?? readDirSpy.mock.calls.length
    expect(callsAfterSecond).toBe(callsAfterFirst)
  })

  it('collapseDir removes path and hides children from tree', async () => {
    const { store } = createTestStore()
    await store.getState().loadDirectory('')
    await store.getState().expandDir('src')

    // Children should be visible
    expect(store.getState().tree.some((n) => n.name === 'index.ts')).toBe(true)

    store.getState().collapseDir('src')

    const { expandedPaths, tree } = store.getState()
    expect(expandedPaths.has('src')).toBe(false)
    // Children should no longer be in the flat tree
    expect(tree.some((n) => n.name === 'index.ts')).toBe(false)
  })

  it('toggleDir toggles between expanded and collapsed', async () => {
    const { store } = createTestStore()
    await store.getState().loadDirectory('')

    await store.getState().toggleDir('src')
    expect(store.getState().expandedPaths.has('src')).toBe(true)

    await store.getState().toggleDir('src')
    expect(store.getState().expandedPaths.has('src')).toBe(false)
  })
})

describe('openFile', () => {
  it('opens file and creates tab', async () => {
    const { store } = createTestStore()

    await store.getState().openFile('src/index.ts')

    const { tabs, activeTabId, fileContents } = store.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].path).toBe('src/index.ts')
    expect(tabs[0].label).toBe('index.ts')
    expect(tabs[0].isDirty).toBe(false)
    expect(tabs[0].isPreview).toBe(false)
    expect(activeTabId).toBe('tab:src/index.ts')
    expect(fileContents.get('src/index.ts')).toBe('const x = 1')
  })

  it('activates existing tab if already open', async () => {
    const { store } = createTestStore()

    await store.getState().openFile('src/index.ts')
    await store.getState().openFile('README.md')
    await store.getState().openFile('src/index.ts')

    const { tabs, activeTabId } = store.getState()
    expect(tabs).toHaveLength(2)
    expect(activeTabId).toBe('tab:src/index.ts')
  })

  it('preview tab gets replaced by next preview', async () => {
    const { store } = createTestStore()

    await store.getState().openFile('src/index.ts', { preview: true })
    expect(store.getState().tabs).toHaveLength(1)
    expect(store.getState().tabs[0].isPreview).toBe(true)

    await store.getState().openFile('README.md', { preview: true })
    const { tabs } = store.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].path).toBe('README.md')
    expect(tabs[0].isPreview).toBe(true)
  })

  it('preview tab promoted to permanent on non-preview open', async () => {
    const { store } = createTestStore()

    await store.getState().openFile('src/index.ts', { preview: true })
    expect(store.getState().tabs[0].isPreview).toBe(true)

    await store.getState().openFile('src/index.ts')
    const { tabs } = store.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].isPreview).toBe(false)
  })

  it('caches file content in fileContents', async () => {
    const { store } = createTestStore()

    await store.getState().openFile('src/utils/math.ts')

    expect(store.getState().fileContents.get('src/utils/math.ts')).toBe(
      'export const add = (a, b) => a + b'
    )
  })
})

describe('closeTab', () => {
  async function setupTabs() {
    const { store, adapter } = createTestStore()
    await store.getState().openFile('src/index.ts')
    await store.getState().openFile('README.md')
    await store.getState().openFile('package.json')
    return { store, adapter }
  }

  it('removes tab from list', async () => {
    const { store } = await setupTabs()

    store.getState().closeTab('tab:README.md')

    const paths = store.getState().tabs.map((t) => t.path)
    expect(paths).not.toContain('README.md')
    expect(paths).toHaveLength(2)
  })

  it('selects next tab (right neighbor)', async () => {
    const { store } = await setupTabs()
    // Active is package.json (last opened). Set active to README.md (middle)
    store.getState().setActiveTab('tab:README.md')

    store.getState().closeTab('tab:README.md')

    // Should select the tab at the same index (package.json)
    expect(store.getState().activeTabId).toBe('tab:package.json')
  })

  it('selects previous tab when closing last', async () => {
    const { store } = await setupTabs()
    // Active is package.json (the last tab)
    store.getState().setActiveTab('tab:package.json')

    store.getState().closeTab('tab:package.json')

    expect(store.getState().activeTabId).toBe('tab:README.md')
  })

  it('sets activeTabId null when closing only tab', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')

    store.getState().closeTab('tab:src/index.ts')

    expect(store.getState().activeTabId).toBeNull()
    expect(store.getState().tabs).toHaveLength(0)
  })

  it('cleans up fileContents for non-dirty files', async () => {
    const { store } = await setupTabs()

    store.getState().closeTab('tab:README.md')

    expect(store.getState().fileContents.has('README.md')).toBe(false)
  })

  it('cleans up cursorPositions', async () => {
    const { store } = await setupTabs()
    store.getState().saveCursorPosition('README.md', { line: 5, col: 10 })

    store.getState().closeTab('tab:README.md')

    expect(store.getState().cursorPositions.has('README.md')).toBe(false)
  })
})

describe('closeOtherTabs', () => {
  it('keeps target tab and pinned tabs', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')
    await store.getState().openFile('README.md')
    await store.getState().openFile('package.json')

    // Pin one tab manually
    store.setState({
      tabs: store.getState().tabs.map((t) =>
        t.id === 'tab:src/index.ts' ? { ...t, isPinned: true } : t
      ),
    })

    store.getState().closeOtherTabs('tab:package.json')

    const paths = store.getState().tabs.map((t) => t.path)
    expect(paths).toContain('package.json')
    expect(paths).toContain('src/index.ts') // pinned
    expect(paths).not.toContain('README.md')
  })

  it('cleans up content and cursor positions for closed tabs', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')
    await store.getState().openFile('README.md')
    await store.getState().openFile('package.json')

    store.getState().saveCursorPosition('README.md', { line: 3, col: 1 })

    store.getState().closeOtherTabs('tab:package.json')

    // README.md content and cursor should be cleaned
    expect(store.getState().fileContents.has('README.md')).toBe(false)
    expect(store.getState().cursorPositions.has('README.md')).toBe(false)
    // Kept tab content should remain
    expect(store.getState().fileContents.has('package.json')).toBe(true)
  })
})

describe('setActiveTab', () => {
  it('sets activeTabId and selectedPath', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')
    await store.getState().openFile('README.md')

    store.getState().setActiveTab('tab:src/index.ts')

    expect(store.getState().activeTabId).toBe('tab:src/index.ts')
    expect(store.getState().selectedPath).toBe('src/index.ts')
  })

  it('saves cursor position for previous tab', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')
    await store.getState().openFile('README.md')

    // Set cursor while on README.md
    store.getState().setCursorPosition(10, 5)

    // Switch to index.ts — should save README.md cursor
    store.getState().setActiveTab('tab:src/index.ts')

    const saved = store.getState().cursorPositions.get('README.md')
    expect(saved).toEqual({ line: 10, col: 5 })
  })

  it('restores cursor position for new tab', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')
    await store.getState().openFile('README.md')

    // Save a cursor for index.ts
    store.getState().saveCursorPosition('src/index.ts', { line: 7, col: 3 })

    // Switch to index.ts
    store.getState().setActiveTab('tab:src/index.ts')

    expect(store.getState().cursorLine).toBe(7)
    expect(store.getState().cursorCol).toBe(3)
  })
})

describe('updateFileContent', () => {
  it('marks file as dirty when content differs', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')

    store.getState().updateFileContent('src/index.ts', 'const x = 2')

    expect(store.getState().dirtyFiles.has('src/index.ts')).toBe(true)
    expect(store.getState().dirtyFiles.get('src/index.ts')).toBe('const x = 2')
    const tab = store.getState().tabs.find((t) => t.path === 'src/index.ts')
    expect(tab!.isDirty).toBe(true)
  })

  it('marks file as clean when content matches original', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')

    store.getState().updateFileContent('src/index.ts', 'const x = 2')
    expect(store.getState().dirtyFiles.has('src/index.ts')).toBe(true)

    // Restore to original content
    store.getState().updateFileContent('src/index.ts', 'const x = 1')
    expect(store.getState().dirtyFiles.has('src/index.ts')).toBe(false)
    const tab = store.getState().tabs.find((t) => t.path === 'src/index.ts')
    expect(tab!.isDirty).toBe(false)
  })

  it('updates tab isDirty flag', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')

    store.getState().updateFileContent('src/index.ts', 'changed')
    expect(store.getState().tabs[0].isDirty).toBe(true)

    store.getState().updateFileContent('src/index.ts', 'const x = 1')
    expect(store.getState().tabs[0].isDirty).toBe(false)
  })
})

describe('saveFile', () => {
  it('writes content via adapter', async () => {
    const { store, adapter } = createTestStore()
    const writeSpy = vi.spyOn(adapter, 'writeFile')

    await store.getState().openFile('src/index.ts')
    store.getState().updateFileContent('src/index.ts', 'const x = 99')

    await store.getState().saveFile('src/index.ts')

    expect(writeSpy).toHaveBeenCalledWith('src/index.ts', 'const x = 99')
  })

  it('clears dirty state', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')
    store.getState().updateFileContent('src/index.ts', 'const x = 99')

    await store.getState().saveFile('src/index.ts')

    expect(store.getState().dirtyFiles.has('src/index.ts')).toBe(false)
    expect(store.getState().tabs[0].isDirty).toBe(false)
  })

  it('updates fileContents with saved content', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')
    store.getState().updateFileContent('src/index.ts', 'const x = 99')

    await store.getState().saveFile('src/index.ts')

    expect(store.getState().fileContents.get('src/index.ts')).toBe('const x = 99')
  })

  it('handles adapter error', async () => {
    const store = createEditorStore('')
    const failingAdapter: FileSystemAdapter = {
      capabilities: { write: true, rename: false, delete: false, createDir: false, search: false, watch: false, binaryPreview: false },
      readDirectory: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue('original'),
      writeFile: vi.fn().mockRejectedValue(new Error('disk full')),
      deleteFile: vi.fn(),
      rename: vi.fn(),
      createDirectory: vi.fn(),
      stat: vi.fn(),
      exists: vi.fn().mockResolvedValue(true),
    }
    store.getState().setAdapter(failingAdapter)

    await store.getState().openFile('test.ts')
    store.getState().updateFileContent('test.ts', 'changed')

    await store.getState().saveFile('test.ts')

    const { error } = store.getState()
    expect(error).not.toBeNull()
    expect(error!.code).toBe('ADAPTER_ERROR')
    expect(error!.message).toBe('disk full')
  })
})

describe('search', () => {
  it('content search delegates to adapter.search', async () => {
    const { store } = createTestStore()

    await store.getState().search('const', 'content')

    const { searchResults, searchLoading } = store.getState()
    expect(searchLoading).toBe(false)
    expect(searchResults).not.toBeNull()
    expect(searchResults!.length).toBeGreaterThan(0)
    // Should find "const" in src/index.ts and src/utils/math.ts and src/utils/string.ts
    const paths = searchResults!.map((r) => r.path)
    expect(paths).toContain('src/index.ts')
    expect(paths).toContain('src/utils/math.ts')
  })

  it('file search filters tree by name', async () => {
    const { store } = createTestStore()
    // Need to load tree first for file search
    await store.getState().loadDirectory('')
    await store.getState().expandDir('src')
    await store.getState().expandDir('src/utils')

    await store.getState().search('math', 'files')

    const { searchResults } = store.getState()
    expect(searchResults).not.toBeNull()
    expect(searchResults!.length).toBe(1)
    expect(searchResults![0].path).toBe('src/utils/math.ts')
  })

  it('empty query clears results', async () => {
    const { store } = createTestStore()

    await store.getState().search('const', 'content')
    expect(store.getState().searchResults).not.toBeNull()

    await store.getState().search('', 'content')
    expect(store.getState().searchResults).toBeNull()
    expect(store.getState().searchLoading).toBe(false)
  })

  it('handles adapter error', async () => {
    const store = createEditorStore('')
    const failingAdapter: FileSystemAdapter = {
      capabilities: { write: false, rename: false, delete: false, createDir: false, search: true, watch: false, binaryPreview: false },
      readDirectory: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn(),
      deleteFile: vi.fn(),
      rename: vi.fn(),
      createDirectory: vi.fn(),
      stat: vi.fn(),
      exists: vi.fn().mockResolvedValue(false),
      search: vi.fn().mockRejectedValue(new Error('search failed')),
    }
    store.getState().setAdapter(failingAdapter)

    await store.getState().search('test', 'content')

    const { error, searchLoading } = store.getState()
    expect(searchLoading).toBe(false)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('ADAPTER_ERROR')
    expect(error!.message).toBe('search failed')
  })
})

describe('replaceOne', () => {
  it('replaces text at correct line and column', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')

    // "const x = 1" — replace "x" (column 6, length 1)
    await store.getState().replaceOne(
      'src/index.ts',
      { line: 1, column: 6, length: 1 },
      'y'
    )

    expect(store.getState().fileContents.get('src/index.ts')).toBe('const y = 1')
  })

  it('writes via adapter and clears dirty state', async () => {
    const { store, adapter } = createTestStore()
    const writeSpy = vi.spyOn(adapter, 'writeFile')
    await store.getState().openFile('src/index.ts')

    await store.getState().replaceOne(
      'src/index.ts',
      { line: 1, column: 6, length: 1 },
      'y'
    )

    expect(writeSpy).toHaveBeenCalledWith('src/index.ts', 'const y = 1')
    expect(store.getState().dirtyFiles.has('src/index.ts')).toBe(false)
  })

  it('re-runs search after replace', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')

    // Run a search first
    await store.getState().search('const', 'content')
    const resultsBefore = store.getState().searchResults!.length

    // Replace "const" with "let" in one file
    await store.getState().replaceOne(
      'src/index.ts',
      { line: 1, column: 0, length: 5 },
      'let'
    )

    // Search should have re-run and updated results
    const { searchResults } = store.getState()
    expect(searchResults).not.toBeNull()
    // The replaced file should no longer match "const"
    const indexResult = searchResults!.find((r) => r.path === 'src/index.ts')
    expect(indexResult).toBeUndefined()
  })
})

describe('replaceAll', () => {
  it('replaces all matches across files', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')
    await store.getState().openFile('src/utils/math.ts')
    await store.getState().openFile('src/utils/string.ts')

    await store.getState().search('const', 'content')
    const matchCount = store.getState().searchResults!.reduce(
      (sum, r) => sum + r.matches.length,
      0
    )
    expect(matchCount).toBeGreaterThan(1)

    await store.getState().replaceAll('let')

    // All "const" should now be "let"
    expect(store.getState().fileContents.get('src/index.ts')).toBe('let x = 1')
    expect(store.getState().fileContents.get('src/utils/math.ts')).toBe(
      'export let add = (a, b) => a + b'
    )
    expect(store.getState().fileContents.get('src/utils/string.ts')).toBe(
      'export let upper = (s) => s.toUpperCase()'
    )
  })

  it('processes matches in reverse order (preserves offsets)', async () => {
    const { store, adapter } = createTestStore()

    // Create a file with multiple matches on the same line
    await adapter.writeFile('multi.ts', 'aaa bbb aaa')
    // Manually set file content
    const contents = new Map(store.getState().fileContents)
    contents.set('multi.ts', 'aaa bbb aaa')
    store.setState({ fileContents: contents })

    // Set up search results with two matches on the same line
    store.setState({
      searchQuery: 'aaa',
      searchScope: 'content',
      searchResults: [
        {
          path: 'multi.ts',
          matches: [
            { line: 1, column: 0, length: 3, lineContent: 'aaa bbb aaa' },
            { line: 1, column: 8, length: 3, lineContent: 'aaa bbb aaa' },
          ],
        },
      ],
    })

    await store.getState().replaceAll('cc')

    expect(store.getState().fileContents.get('multi.ts')).toBe('cc bbb cc')
  })

  it('re-runs search after replace', async () => {
    const { store } = createTestStore()
    // Open all files that contain "const" so replaceAll can process them
    await store.getState().openFile('src/index.ts')
    await store.getState().openFile('src/utils/math.ts')
    await store.getState().openFile('src/utils/string.ts')

    await store.getState().search('const', 'content')
    const resultsBefore = store.getState().searchResults!.length
    expect(resultsBefore).toBeGreaterThan(0)

    await store.getState().replaceAll('let')

    // After replacing all "const" with "let", search for "const" should yield no results
    const { searchResults } = store.getState()
    expect(searchResults).not.toBeNull()
    expect(searchResults!.length).toBe(0)
  })
})

describe('setCursorPosition', () => {
  it('updates cursor line and col', () => {
    const { store } = createTestStore()

    store.getState().setCursorPosition(10, 5)

    expect(store.getState().cursorLine).toBe(10)
    expect(store.getState().cursorCol).toBe(5)
  })

  it('no-op when position unchanged (optimization)', () => {
    const { store } = createTestStore()

    store.getState().setCursorPosition(10, 5)

    // Subscribe to detect state changes
    let stateChanged = false
    const unsub = store.subscribe(() => {
      stateChanged = true
    })

    store.getState().setCursorPosition(10, 5)
    expect(stateChanged).toBe(false)

    unsub()
  })
})

describe('saveCursorPosition / getCursorPosition', () => {
  it('saves and retrieves position for path', () => {
    const { store } = createTestStore()

    store.getState().saveCursorPosition('src/index.ts', { line: 42, col: 7, scrollTop: 200 })

    const pos = store.getState().getCursorPosition('src/index.ts')
    expect(pos).toEqual({ line: 42, col: 7, scrollTop: 200 })
  })

  it('returns null for unknown path', () => {
    const { store } = createTestStore()

    const pos = store.getState().getCursorPosition('nonexistent.ts')
    expect(pos).toBeNull()
  })
})

describe('refreshTree', () => {
  it('reloads root directory', async () => {
    const { store, adapter } = createTestStore()
    await store.getState().loadDirectory('')

    const treeBefore = store.getState().tree.length

    // Add a new file via adapter
    await adapter.writeFile('new-file.ts', 'hello')

    await store.getState().refreshTree()

    const treeAfter = store.getState().tree
    expect(treeAfter.length).toBeGreaterThan(treeBefore)
    expect(treeAfter.some((n) => n.name === 'new-file.ts')).toBe(true)
  })
})

describe('updateFileContentFromExternal', () => {
  it('updates fileContents without marking dirty', async () => {
    const { store } = createTestStore()
    await store.getState().openFile('src/index.ts')

    store.getState().updateFileContentFromExternal('src/index.ts', 'externally updated')

    expect(store.getState().fileContents.get('src/index.ts')).toBe('externally updated')
    expect(store.getState().dirtyFiles.has('src/index.ts')).toBe(false)
    expect(store.getState().tabs[0].isDirty).toBe(false)
  })
})
