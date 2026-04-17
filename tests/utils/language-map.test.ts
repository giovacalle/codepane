import { getLanguageExtension } from '../../src/utils/language-map'

describe('getLanguageExtension', () => {
  // ---------------------------------------------------------------------------
  // Known extensions — returns a non-null, truthy Extension
  // ---------------------------------------------------------------------------

  it.each([
    'index.ts',
    'app.tsx',
    'main.js',
    'style.css',
    'page.html',
    'data.json',
    'readme.md',
    'script.py',
    'lib.rs',
    'query.sql',
    'App.java',
    'main.cpp',
    'main.go',
    'index.php',
    'config.yml',
    'layout.xml',
  ])('returns a non-null extension for %s', async (filename) => {
    const result = await getLanguageExtension(filename)
    expect(result).toBeTruthy()
  })

  // ---------------------------------------------------------------------------
  // Unknown extensions — returns null
  // ---------------------------------------------------------------------------

  it.each(['file.xyz', 'file.unknown'])(
    'returns null for unknown extension: %s',
    async (filename) => {
      const result = await getLanguageExtension(filename)
      expect(result).toBeNull()
    },
  )

  // ---------------------------------------------------------------------------
  // No extension — returns null
  // ---------------------------------------------------------------------------

  it.each(['Makefile', 'Dockerfile'])(
    'returns null for files without extension: %s',
    async (filename) => {
      const result = await getLanguageExtension(filename)
      expect(result).toBeNull()
    },
  )

  // ---------------------------------------------------------------------------
  // Dotfiles — returns null (dotIndex <= 0)
  // ---------------------------------------------------------------------------

  it('returns null for dotfiles like .gitignore', async () => {
    const result = await getLanguageExtension('.gitignore')
    expect(result).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Full paths — extracts extension correctly
  // ---------------------------------------------------------------------------

  it('handles full paths', async () => {
    const result = await getLanguageExtension('src/components/App.tsx')
    expect(result).toBeTruthy()
  })

  // ---------------------------------------------------------------------------
  // Caching — same extension resolves to the same Extension reference
  // ---------------------------------------------------------------------------
  // The function is `async`, so it always returns a new outer Promise.
  // However, the internal cache ensures the same loader is not called twice.
  // We verify caching by checking that resolved values share the same reference.

  it('resolves to the same Extension object for different files with the same extension', async () => {
    const ext1 = await getLanguageExtension('a.scss')
    const ext2 = await getLanguageExtension('b.scss')
    expect(ext1).toBe(ext2)
  })

  it('resolves to the same Extension object when called twice with the same file', async () => {
    const ext1 = await getLanguageExtension('styles.scss')
    const ext2 = await getLanguageExtension('styles.scss')
    expect(ext1).toBe(ext2)
  })
})
