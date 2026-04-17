import type { FileEntry, FlatTreeNode } from '../../src/core/types'
import { getParentPath, getFileName, flattenVisibleTree } from '../../src/utils/virtual-tree'

// ---------------------------------------------------------------------------
// getParentPath
// ---------------------------------------------------------------------------

describe('getParentPath', () => {
  it('returns parent directory for a nested path', () => {
    expect(getParentPath('src/components/Button.tsx')).toBe('src/components')
  })

  it('returns empty string for a root-level file', () => {
    expect(getParentPath('README.md')).toBe('')
  })

  it('returns empty string for an empty string', () => {
    expect(getParentPath('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// getFileName
// ---------------------------------------------------------------------------

describe('getFileName', () => {
  it('returns the file name from a nested path', () => {
    expect(getFileName('src/components/Button.tsx')).toBe('Button.tsx')
  })

  it('returns the file itself for a root-level file', () => {
    expect(getFileName('README.md')).toBe('README.md')
  })

  it('returns empty string for an empty string', () => {
    expect(getFileName('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// flattenVisibleTree
// ---------------------------------------------------------------------------

function makeEntry(
  name: string,
  path: string,
  isDirectory: boolean,
  extra?: Partial<FileEntry>,
): FileEntry {
  return { name, path, isDirectory, ...extra }
}

describe('flattenVisibleTree', () => {
  it('returns an empty array when the treeCache is empty', () => {
    const cache = new Map<string, FileEntry[]>()
    const expanded = new Set<string>()
    expect(flattenVisibleTree(cache, expanded, '')).toEqual([])
  })

  it('returns files sorted with directories first, then alphabetical case-insensitive', () => {
    const cache = new Map<string, FileEntry[]>([
      [
        '',
        [
          makeEntry('zebra.txt', 'zebra.txt', false),
          makeEntry('src', 'src', true),
          makeEntry('apple.js', 'apple.js', false),
          makeEntry('lib', 'lib', true),
        ],
      ],
    ])
    const expanded = new Set<string>()
    const result = flattenVisibleTree(cache, expanded, '')

    expect(result.map((n) => n.name)).toEqual(['lib', 'src', 'apple.js', 'zebra.txt'])
  })

  it('shows children of expanded directories only', () => {
    const cache = new Map<string, FileEntry[]>([
      ['', [makeEntry('src', 'src', true), makeEntry('docs', 'docs', true)]],
      ['src', [makeEntry('index.ts', 'src/index.ts', false)]],
      ['docs', [makeEntry('readme.md', 'docs/readme.md', false)]],
    ])

    const expanded = new Set<string>(['src'])
    const result = flattenVisibleTree(cache, expanded, '')

    const names = result.map((n) => n.name)
    expect(names).toContain('index.ts')
    expect(names).not.toContain('readme.md')
  })

  it('hides children of collapsed directories', () => {
    const cache = new Map<string, FileEntry[]>([
      ['', [makeEntry('src', 'src', true)]],
      ['src', [makeEntry('index.ts', 'src/index.ts', false)]],
    ])

    const expanded = new Set<string>()
    const result = flattenVisibleTree(cache, expanded, '')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('src')
  })

  it('assigns correct depth values', () => {
    const cache = new Map<string, FileEntry[]>([
      ['', [makeEntry('src', 'src', true)]],
      ['src', [makeEntry('components', 'src/components', true)]],
      ['src/components', [makeEntry('Button.tsx', 'src/components/Button.tsx', false)]],
    ])

    const expanded = new Set<string>(['src', 'src/components'])
    const result = flattenVisibleTree(cache, expanded, '')

    expect(result[0].depth).toBe(0) // src
    expect(result[1].depth).toBe(1) // components
    expect(result[2].depth).toBe(2) // Button.tsx
  })

  it('sets isExpanded to true only for expanded directories', () => {
    const cache = new Map<string, FileEntry[]>([
      [
        '',
        [
          makeEntry('src', 'src', true),
          makeEntry('lib', 'lib', true),
          makeEntry('file.ts', 'file.ts', false),
        ],
      ],
    ])

    const expanded = new Set<string>(['src'])
    const result = flattenVisibleTree(cache, expanded, '')

    const src = result.find((n) => n.name === 'src')!
    const lib = result.find((n) => n.name === 'lib')!
    const file = result.find((n) => n.name === 'file.ts')!

    expect(src.isExpanded).toBe(true)
    expect(lib.isExpanded).toBe(false)
    expect(file.isExpanded).toBe(false)
  })

  it('sets parentPath to null for depth 0 and to the directory path otherwise', () => {
    const cache = new Map<string, FileEntry[]>([
      ['', [makeEntry('src', 'src', true)]],
      ['src', [makeEntry('index.ts', 'src/index.ts', false)]],
    ])

    const expanded = new Set<string>(['src'])
    const result = flattenVisibleTree(cache, expanded, '')

    expect(result[0].parentPath).toBeNull() // src at depth 0
    expect(result[1].parentPath).toBe('src') // index.ts at depth 1
  })

  it('includes hidden files (names starting with .) in the output', () => {
    const cache = new Map<string, FileEntry[]>([
      [
        '',
        [
          makeEntry('.gitignore', '.gitignore', false, { isHidden: true }),
          makeEntry('index.ts', 'index.ts', false),
        ],
      ],
    ])

    const expanded = new Set<string>()
    const result = flattenVisibleTree(cache, expanded, '')

    expect(result).toHaveLength(2)
    const hidden = result.find((n) => n.name === '.gitignore')!
    expect(hidden).toBeDefined()
    expect(hidden.isHidden).toBe(true)
  })

  it('handles multiple nested levels all expanded', () => {
    const cache = new Map<string, FileEntry[]>([
      ['', [makeEntry('a', 'a', true)]],
      ['a', [makeEntry('b', 'a/b', true)]],
      ['a/b', [makeEntry('c', 'a/b/c', true)]],
      ['a/b/c', [makeEntry('file.txt', 'a/b/c/file.txt', false)]],
    ])

    const expanded = new Set<string>(['a', 'a/b', 'a/b/c'])
    const result = flattenVisibleTree(cache, expanded, '')

    expect(result).toHaveLength(4)
    expect(result.map((n) => n.name)).toEqual(['a', 'b', 'c', 'file.txt'])
    expect(result.map((n) => n.depth)).toEqual([0, 1, 2, 3])
    expect(result.map((n) => n.parentPath)).toEqual([null, 'a', 'a/b', 'a/b/c'])
  })
})
