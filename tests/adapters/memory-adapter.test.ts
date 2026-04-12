import { describe, it, expect, vi } from 'vitest';
import { createMemoryAdapter } from '../../src/adapters/memory-adapter';

function createTestAdapter() {
  return createMemoryAdapter({
    files: {
      'src/index.ts': 'export const hello = "world"',
      'src/utils/math.ts': 'export const add = (a: number, b: number) => a + b',
      'src/utils/string.ts': 'export const upper = (s: string) => s.toUpperCase()',
      '.env': 'SECRET=123',
      'README.md': '# Test Project',
      'package.json': '{ "name": "test" }',
    },
  });
}

describe('memory-adapter', () => {
  // -------------------------------------------------------------------------
  // readDirectory
  // -------------------------------------------------------------------------
  describe('readDirectory', () => {
    it('lists immediate children of root ("")', async () => {
      const adapter = createTestAdapter();
      const entries = await adapter.readDirectory('');

      const names = entries.map((e) => e.name);
      // "src" is a directory, should appear; hidden ".env" should be filtered
      expect(names).toContain('src');
      expect(names).toContain('README.md');
      expect(names).toContain('package.json');
      expect(names).not.toContain('.env');
    });

    it('lists children of subdirectory', async () => {
      const adapter = createTestAdapter();
      const entries = await adapter.readDirectory('src');

      const names = entries.map((e) => e.name);
      expect(names).toContain('utils');
      expect(names).toContain('index.ts');
    });

    it('returns dirs first, then files, alphabetically', async () => {
      const adapter = createTestAdapter();
      const entries = await adapter.readDirectory('src');

      // "utils" is a directory, should come before "index.ts"
      const dirEntries = entries.filter((e) => e.isDirectory);
      const fileEntries = entries.filter((e) => !e.isDirectory);

      expect(dirEntries.length).toBeGreaterThan(0);
      expect(entries.indexOf(dirEntries[0])).toBeLessThan(
        entries.indexOf(fileEntries[0]),
      );

      // Files should be alphabetically sorted among themselves
      const fileNames = fileEntries.map((e) => e.name);
      expect(fileNames).toEqual([...fileNames].sort());
    });

    it('filters hidden files (dotfiles) by default', async () => {
      const adapter = createTestAdapter();
      const entries = await adapter.readDirectory('');

      const names = entries.map((e) => e.name);
      expect(names).not.toContain('.env');
    });

    it('showHidden: true includes dotfiles', async () => {
      const adapter = createTestAdapter();
      const entries = await adapter.readDirectory('', { showHidden: true });

      const names = entries.map((e) => e.name);
      expect(names).toContain('.env');
    });

    it('returns empty array for empty directory', async () => {
      const adapter = createTestAdapter();
      await adapter.createDirectory('empty');

      const entries = await adapter.readDirectory('empty');
      expect(entries).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // readFile
  // -------------------------------------------------------------------------
  describe('readFile', () => {
    it('returns file content', async () => {
      const adapter = createTestAdapter();
      const content = await adapter.readFile('src/index.ts');
      expect(content).toBe('export const hello = "world"');
    });

    it('throws for non-existent file', async () => {
      const adapter = createTestAdapter();
      await expect(adapter.readFile('nope.txt')).rejects.toThrow();
    });

    it('returns content after writeFile', async () => {
      const adapter = createTestAdapter();
      await adapter.writeFile('new-file.txt', 'hello');
      const content = await adapter.readFile('new-file.txt');
      expect(content).toBe('hello');
    });
  });

  // -------------------------------------------------------------------------
  // writeFile
  // -------------------------------------------------------------------------
  describe('writeFile', () => {
    it('creates a new file', async () => {
      const adapter = createTestAdapter();
      await adapter.writeFile('new.txt', 'content');
      expect(await adapter.exists('new.txt')).toBe(true);
      expect(await adapter.readFile('new.txt')).toBe('content');
    });

    it('updates existing file', async () => {
      const adapter = createTestAdapter();
      await adapter.writeFile('README.md', 'updated');
      expect(await adapter.readFile('README.md')).toBe('updated');
    });

    it('creates parent directories implicitly', async () => {
      const adapter = createTestAdapter();
      await adapter.writeFile('a/b/c/deep.txt', 'deep');
      expect(await adapter.exists('a')).toBe(true);
      expect(await adapter.exists('a/b')).toBe(true);
      expect(await adapter.exists('a/b/c')).toBe(true);
      expect(await adapter.readFile('a/b/c/deep.txt')).toBe('deep');
    });

    it('emits "created" event for new file', async () => {
      const adapter = createTestAdapter();
      const callback = vi.fn();
      adapter.watch!('src', callback);

      await adapter.writeFile('src/new-file.ts', 'data');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'created', path: 'src/new-file.ts' }),
      );
    });

    it('emits "modified" event for existing file', async () => {
      const adapter = createTestAdapter();
      const callback = vi.fn();
      adapter.watch!('src/index.ts', callback);

      await adapter.writeFile('src/index.ts', 'changed');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'modified', path: 'src/index.ts' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteFile
  // -------------------------------------------------------------------------
  describe('deleteFile', () => {
    it('deletes a file', async () => {
      const adapter = createTestAdapter();
      await adapter.deleteFile('README.md');
      expect(await adapter.exists('README.md')).toBe(false);
    });

    it('deletes a directory recursively', async () => {
      const adapter = createTestAdapter();
      await adapter.deleteFile('src/utils');

      expect(await adapter.exists('src/utils')).toBe(false);
      expect(await adapter.exists('src/utils/math.ts')).toBe(false);
      expect(await adapter.exists('src/utils/string.ts')).toBe(false);
      // Parent should still exist
      expect(await adapter.exists('src')).toBe(true);
    });

    it('throws for non-existent path', async () => {
      const adapter = createTestAdapter();
      await expect(adapter.deleteFile('does-not-exist')).rejects.toThrow();
    });

    it('deleted file no longer exists', async () => {
      const adapter = createTestAdapter();
      expect(await adapter.exists('package.json')).toBe(true);
      await adapter.deleteFile('package.json');
      expect(await adapter.exists('package.json')).toBe(false);
      await expect(adapter.readFile('package.json')).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // rename
  // -------------------------------------------------------------------------
  describe('rename', () => {
    it('renames a file', async () => {
      const adapter = createTestAdapter();
      await adapter.rename('README.md', 'DOCS.md');

      expect(await adapter.exists('DOCS.md')).toBe(true);
      expect(await adapter.readFile('DOCS.md')).toBe('# Test Project');
    });

    it('renames a directory (moves all children)', async () => {
      const adapter = createTestAdapter();
      await adapter.rename('src/utils', 'src/helpers');

      expect(await adapter.exists('src/helpers')).toBe(true);
      expect(await adapter.exists('src/helpers/math.ts')).toBe(true);
      expect(await adapter.exists('src/helpers/string.ts')).toBe(true);

      expect(await adapter.readFile('src/helpers/math.ts')).toBe(
        'export const add = (a: number, b: number) => a + b',
      );
    });

    it('throws for non-existent path', async () => {
      const adapter = createTestAdapter();
      await expect(adapter.rename('ghost', 'phantom')).rejects.toThrow();
    });

    it('emits "renamed" event with oldPath', async () => {
      const adapter = createTestAdapter();
      const callback = vi.fn();
      // Watch the new path since the event is emitted with the new path
      adapter.watch!('DOCS.md', callback);

      await adapter.rename('README.md', 'DOCS.md');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'renamed',
          path: 'DOCS.md',
          oldPath: 'README.md',
        }),
      );
    });

    it('old path no longer exists, new path does', async () => {
      const adapter = createTestAdapter();
      await adapter.rename('package.json', 'pkg.json');

      expect(await adapter.exists('package.json')).toBe(false);
      expect(await adapter.exists('pkg.json')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // createDirectory
  // -------------------------------------------------------------------------
  describe('createDirectory', () => {
    it('creates empty directory', async () => {
      const adapter = createTestAdapter();
      await adapter.createDirectory('lib');

      expect(await adapter.exists('lib')).toBe(true);
      const stat = await adapter.stat('lib');
      expect(stat.isDirectory).toBe(true);
    });

    it('directory appears in parent listing', async () => {
      const adapter = createTestAdapter();
      await adapter.createDirectory('lib');

      const entries = await adapter.readDirectory('');
      const names = entries.map((e) => e.name);
      expect(names).toContain('lib');
    });

    it('emits "created" event', async () => {
      const adapter = createTestAdapter();
      const callback = vi.fn();
      adapter.watch!('lib', callback);

      await adapter.createDirectory('lib');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'created', path: 'lib' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // stat
  // -------------------------------------------------------------------------
  describe('stat', () => {
    it('returns file stat (isDirectory: false, size = content length)', async () => {
      const adapter = createTestAdapter();
      const stat = await adapter.stat('README.md');

      expect(stat.isDirectory).toBe(false);
      expect(stat.isSymlink).toBe(false);
      expect(stat.size).toBe('# Test Project'.length);
      expect(typeof stat.modifiedAt).toBe('number');
      expect(typeof stat.createdAt).toBe('number');
    });

    it('returns directory stat (isDirectory: true)', async () => {
      const adapter = createTestAdapter();
      const stat = await adapter.stat('src');

      expect(stat.isDirectory).toBe(true);
      expect(stat.isSymlink).toBe(false);
    });

    it('throws for non-existent path', async () => {
      const adapter = createTestAdapter();
      await expect(adapter.stat('nonexistent')).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // exists
  // -------------------------------------------------------------------------
  describe('exists', () => {
    it('returns true for existing file', async () => {
      const adapter = createTestAdapter();
      expect(await adapter.exists('README.md')).toBe(true);
    });

    it('returns true for existing directory', async () => {
      const adapter = createTestAdapter();
      expect(await adapter.exists('src')).toBe(true);
      expect(await adapter.exists('src/utils')).toBe(true);
    });

    it('returns false for non-existent path', async () => {
      const adapter = createTestAdapter();
      expect(await adapter.exists('nope')).toBe(false);
      expect(await adapter.exists('src/nope')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // search
  // -------------------------------------------------------------------------
  describe('search', () => {
    it('finds text in files', async () => {
      const adapter = createTestAdapter();
      const results = await adapter.search!({ pattern: 'hello' });

      expect(results.length).toBeGreaterThan(0);
      const paths = results.map((r) => r.path);
      expect(paths).toContain('src/index.ts');
    });

    it('is case-insensitive by default', async () => {
      const adapter = createTestAdapter();
      const results = await adapter.search!({ pattern: 'HELLO' });

      const paths = results.map((r) => r.path);
      expect(paths).toContain('src/index.ts');
    });

    it('respects caseSensitive when specified', async () => {
      const adapter = createTestAdapter();
      const results = await adapter.search!({
        pattern: 'HELLO',
        caseSensitive: true,
      });

      const paths = results.map((r) => r.path);
      expect(paths).not.toContain('src/index.ts');
    });

    it('supports regex patterns', async () => {
      const adapter = createTestAdapter();
      const results = await adapter.search!({
        pattern: 'export const \\w+',
        isRegex: true,
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('includeGlob filters files', async () => {
      const adapter = createTestAdapter();
      const results = await adapter.search!({
        pattern: 'export',
        includeGlob: 'src/utils/*',
      });

      const paths = results.map((r) => r.path);
      expect(paths).toContain('src/utils/math.ts');
      expect(paths).toContain('src/utils/string.ts');
      expect(paths).not.toContain('src/index.ts');
    });

    it('excludeGlob excludes files', async () => {
      const adapter = createTestAdapter();
      const results = await adapter.search!({
        pattern: 'export',
        excludeGlob: 'src/utils/*',
      });

      const paths = results.map((r) => r.path);
      expect(paths).not.toContain('src/utils/math.ts');
      expect(paths).not.toContain('src/utils/string.ts');
      // src/index.ts should still match
      expect(paths).toContain('src/index.ts');
    });

    it('returns correct line numbers and columns', async () => {
      const adapter = createMemoryAdapter({
        files: {
          'test.txt': 'line one\nfind me here\nline three',
        },
      });

      const results = await adapter.search!({ pattern: 'find me' });

      expect(results).toHaveLength(1);
      expect(results[0].matches).toHaveLength(1);

      const match = results[0].matches[0];
      expect(match.line).toBe(2);
      expect(match.column).toBe(0);
      expect(match.length).toBe('find me'.length);
      expect(match.lineContent).toBe('find me here');
    });

    it('returns no results for non-matching pattern', async () => {
      const adapter = createTestAdapter();
      const results = await adapter.search!({
        pattern: 'zzz_no_match_zzz',
      });

      expect(results).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // watch
  // -------------------------------------------------------------------------
  describe('watch', () => {
    it('callback fires on writeFile', async () => {
      const adapter = createTestAdapter();
      const callback = vi.fn();
      adapter.watch!('src', callback);

      await adapter.writeFile('src/new.ts', 'hi');

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'created', path: 'src/new.ts' }),
      );
    });

    it('callback fires on deleteFile', async () => {
      const adapter = createTestAdapter();
      const callback = vi.fn();
      adapter.watch!('README.md', callback);

      await adapter.deleteFile('README.md');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'deleted', path: 'README.md' }),
      );
    });

    it('dispose stops callbacks', async () => {
      const adapter = createTestAdapter();
      const callback = vi.fn();
      const disposable = adapter.watch!('src', callback);

      disposable.dispose();

      await adapter.writeFile('src/after-dispose.ts', 'data');
      expect(callback).not.toHaveBeenCalled();
    });

    it('multiple watchers all receive events', async () => {
      const adapter = createTestAdapter();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      adapter.watch!('src', cb1);
      adapter.watch!('src', cb2);

      await adapter.writeFile('src/multi.ts', 'test');

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // capabilities
  // -------------------------------------------------------------------------
  describe('capabilities', () => {
    it('all capability flags are correct', () => {
      const adapter = createTestAdapter();

      expect(adapter.capabilities).toEqual({
        write: true,
        rename: true,
        delete: true,
        createDir: true,
        search: true,
        watch: true,
        binaryPreview: false,
      });
    });
  });
});
