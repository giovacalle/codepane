import type {
  FileSystemAdapter,
  FileEntry,
  FileStat,
  ReadDirOptions,
  SearchQuery,
  SearchResult,
  SearchMatch,
  FileChangeEvent,
  Disposable,
  AdapterCapabilities,
  MemoryAdapterConfig,
} from './types';

function normalizePath(path: string): string {
  // Remove leading/trailing slashes and collapse double slashes
  return path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

function getParentPath(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

function getFileName(path: string): string {
  return path.split('/').pop() ?? path;
}

export function createMemoryAdapter(config: MemoryAdapterConfig): FileSystemAdapter {
  // Internal mutable store: normalized path -> content
  const files = new Map<string, string>();
  // Track explicitly created directories
  const directories = new Set<string>();
  // Watch subscribers
  const watchers = new Map<string, Set<(event: FileChangeEvent) => void>>();

  // Initialize from config
  for (const [rawPath, content] of Object.entries(config.files)) {
    const path = normalizePath(rawPath);
    files.set(path, content);

    // Register all ancestor directories
    let parent = getParentPath(path);
    while (parent) {
      directories.add(parent);
      parent = getParentPath(parent);
    }
  }

  function emitChange(event: FileChangeEvent): void {
    for (const [watchPath, callbacks] of watchers) {
      const normalizedWatch = normalizePath(watchPath);
      const normalizedEvent = normalizePath(event.path);

      // Emit if the watched path is a parent of the changed path, or matches exactly
      if (
        normalizedEvent === normalizedWatch ||
        normalizedEvent.startsWith(normalizedWatch + '/')
      ) {
        for (const cb of callbacks) {
          try {
            cb(event);
          } catch {
            // Swallow watcher errors
          }
        }
      }
    }
  }

  function isDirectory(path: string): boolean {
    if (directories.has(path)) return true;
    // Also a directory if any file has this as a prefix
    const prefix = path + '/';
    for (const key of files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  function pathExists(path: string): boolean {
    return files.has(path) || isDirectory(path);
  }

  function buildEntry(path: string): FileEntry {
    const name = getFileName(path);
    const isDir = isDirectory(path);

    return {
      name,
      path,
      isDirectory: isDir,
      size: isDir ? 0 : (files.get(path)?.length ?? 0),
      isHidden: name.startsWith('.'),
    };
  }

  const capabilities: AdapterCapabilities = Object.freeze({
    write: true,
    rename: true,
    delete: true,
    createDir: true,
    search: true,
    watch: true,
    binaryPreview: false,
  });

  const adapter: FileSystemAdapter = {
    capabilities,

    async readDirectory(path: string, options?: ReadDirOptions): Promise<FileEntry[]> {
      const normalized = normalizePath(path);
      const prefix = normalized ? normalized + '/' : '';
      const seen = new Set<string>();
      const entries: FileEntry[] = [];

      for (const filePath of files.keys()) {
        if (!filePath.startsWith(prefix)) continue;

        const relative = filePath.slice(prefix.length);
        if (!relative) continue;

        if (options?.depth && options.depth > 1) {
          entries.push(buildEntry(filePath));
        } else {
          // Only immediate children
          const firstSegment = relative.split('/')[0];
          const childPath = prefix + firstSegment;

          if (seen.has(childPath)) continue;
          seen.add(childPath);

          entries.push(buildEntry(childPath));
        }
      }

      // Also include explicitly created empty directories
      for (const dirPath of directories) {
        if (!dirPath.startsWith(prefix)) continue;

        const relative = dirPath.slice(prefix.length);
        if (!relative) continue;

        if (options?.depth && options.depth > 1) {
          if (!seen.has(dirPath)) {
            seen.add(dirPath);
            entries.push(buildEntry(dirPath));
          }
        } else {
          const firstSegment = relative.split('/')[0];
          const childPath = prefix + firstSegment;

          if (seen.has(childPath)) continue;
          seen.add(childPath);

          entries.push(buildEntry(childPath));
        }
      }

      // Filter hidden files unless showHidden is true
      const filtered = options?.showHidden
        ? entries
        : entries.filter((e) => !e.name.startsWith('.'));

      // Sort: directories first, then alphabetical
      filtered.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return filtered;
    },

    async readFile(path: string): Promise<string> {
      const normalized = normalizePath(path);
      const content = files.get(normalized);

      if (content === undefined) {
        throw new Error(`File not found: ${path}`);
      }

      return content;
    },

    async writeFile(path: string, content: string): Promise<void> {
      const normalized = normalizePath(path);
      const existed = files.has(normalized);

      files.set(normalized, content);

      // Ensure parent directories exist
      let parent = getParentPath(normalized);
      while (parent) {
        directories.add(parent);
        parent = getParentPath(parent);
      }

      emitChange({
        type: existed ? 'modified' : 'created',
        path: normalized,
      });
    },

    async deleteFile(path: string): Promise<void> {
      const normalized = normalizePath(path);

      if (files.has(normalized)) {
        files.delete(normalized);
        emitChange({ type: 'deleted', path: normalized });
        return;
      }

      // If it's a directory, delete all children
      if (isDirectory(normalized)) {
        const prefix = normalized + '/';
        const toDelete: string[] = [];

        for (const key of files.keys()) {
          if (key.startsWith(prefix)) {
            toDelete.push(key);
          }
        }

        for (const key of toDelete) {
          files.delete(key);
        }

        directories.delete(normalized);

        // Remove child directories too
        for (const dir of directories) {
          if (dir.startsWith(prefix)) {
            directories.delete(dir);
          }
        }

        emitChange({ type: 'deleted', path: normalized });
        return;
      }

      throw new Error(`Path not found: ${path}`);
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      const normalizedOld = normalizePath(oldPath);
      const normalizedNew = normalizePath(newPath);

      if (files.has(normalizedOld)) {
        // Rename a single file
        const content = files.get(normalizedOld)!;
        files.delete(normalizedOld);
        files.set(normalizedNew, content);

        // Ensure parent directories for new path
        let parent = getParentPath(normalizedNew);
        while (parent) {
          directories.add(parent);
          parent = getParentPath(parent);
        }

        emitChange({ type: 'renamed', path: normalizedNew, oldPath: normalizedOld });
        return;
      }

      if (isDirectory(normalizedOld)) {
        // Rename a directory: move all children
        const oldPrefix = normalizedOld + '/';
        const toMove: Array<[string, string]> = [];

        for (const [key, content] of files) {
          if (key.startsWith(oldPrefix)) {
            const newKey = normalizedNew + '/' + key.slice(oldPrefix.length);
            toMove.push([key, newKey]);
          }
        }

        for (const [oldKey, newKey] of toMove) {
          const content = files.get(oldKey)!;
          files.delete(oldKey);
          files.set(newKey, content);
        }

        // Move directory entries
        const dirsToMove: Array<[string, string]> = [];
        for (const dir of directories) {
          if (dir === normalizedOld || dir.startsWith(oldPrefix)) {
            const newDir = normalizedNew + dir.slice(normalizedOld.length);
            dirsToMove.push([dir, newDir]);
          }
        }

        for (const [oldDir, newDir] of dirsToMove) {
          directories.delete(oldDir);
          directories.add(newDir);
        }

        // Ensure parent directories for new path
        let parent = getParentPath(normalizedNew);
        while (parent) {
          directories.add(parent);
          parent = getParentPath(parent);
        }

        emitChange({ type: 'renamed', path: normalizedNew, oldPath: normalizedOld });
        return;
      }

      throw new Error(`Path not found: ${oldPath}`);
    },

    async createDirectory(path: string): Promise<void> {
      const normalized = normalizePath(path);
      directories.add(normalized);

      // Ensure parent directories
      let parent = getParentPath(normalized);
      while (parent) {
        directories.add(parent);
        parent = getParentPath(parent);
      }

      emitChange({ type: 'created', path: normalized });
    },

    async stat(path: string): Promise<FileStat> {
      const normalized = normalizePath(path);
      const isDir = isDirectory(normalized);
      const isFile = files.has(normalized);

      if (!isDir && !isFile) {
        throw new Error(`Path not found: ${path}`);
      }

      const now = Date.now();

      return {
        isDirectory: isDir,
        isSymlink: false,
        size: isFile ? (files.get(normalized)?.length ?? 0) : 0,
        modifiedAt: now,
        createdAt: now,
      };
    },

    async exists(path: string): Promise<boolean> {
      const normalized = normalizePath(path);
      return pathExists(normalized);
    },

    async search(query: SearchQuery): Promise<SearchResult[]> {
      const results: SearchResult[] = [];

      let regex: RegExp;
      try {
        regex = new RegExp(
          query.isRegex ? query.pattern : escapeRegExp(query.pattern),
          query.caseSensitive ? 'g' : 'gi'
        );
      } catch {
        return [];
      }

      for (const [filePath, content] of files) {
        // Apply include/exclude glob patterns (simple prefix matching)
        if (query.includeGlob && !matchesSimpleGlob(filePath, query.includeGlob)) continue;
        if (query.excludeGlob && matchesSimpleGlob(filePath, query.excludeGlob)) continue;

        const lines = content.split('\n');
        const matches: SearchMatch[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          regex.lastIndex = 0;
          let match: RegExpExecArray | null;

          while ((match = regex.exec(line)) !== null) {
            matches.push({
              line: i + 1,
              column: match.index,
              length: match[0].length,
              lineContent: line,
            });

            // Prevent infinite loops on zero-length matches
            if (match[0].length === 0) {
              regex.lastIndex++;
            }
          }
        }

        if (matches.length > 0) {
          results.push({
            path: filePath,
            matches,
          });
        }
      }

      return results;
    },

    watch(path: string, callback: (event: FileChangeEvent) => void): Disposable {
      const normalized = normalizePath(path);

      if (!watchers.has(normalized)) {
        watchers.set(normalized, new Set());
      }

      watchers.get(normalized)!.add(callback);

      const disposable: import('../core/types').Disposable = {
        dispose() {
          const callbacks = watchers.get(normalized);
          if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
              watchers.delete(normalized);
            }
          }
        },
      };
      return disposable;
    },
  };

  return adapter;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Simple glob matching supporting * and ** patterns.
 * This is intentionally lightweight for in-memory use.
 */
function matchesSimpleGlob(path: string, pattern: string): boolean {
  // Convert glob to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  return new RegExp(`^${regexStr}$`).test(path) || new RegExp(`(^|/)${regexStr}($|/)`).test(path);
}
