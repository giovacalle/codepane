// ---------------------------------------------------------------------------
// codepane — Virtual Tree Utilities
// ---------------------------------------------------------------------------
// Utilities for flattening a hierarchical file tree (stored as a Map of
// directory path -> children) into a flat array suitable for virtualized
// rendering via @tanstack/react-virtual.
// ---------------------------------------------------------------------------

import type { FileEntry, FlatTreeNode } from '../core/types';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Returns the parent directory path for a given path.
 *
 * - `"src/components/Button.tsx"` -> `"src/components"`
 * - `"README.md"` -> `""`
 * - `""` -> `""`
 */
export function getParentPath(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return path.slice(0, lastSlash);
}

/**
 * Returns the file name (last segment) of a path.
 *
 * - `"src/components/Button.tsx"` -> `"Button.tsx"`
 * - `"README.md"` -> `"README.md"`
 * - `""` -> `""`
 */
export function getFileName(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return path;
  return path.slice(lastSlash + 1);
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Default comparator: directories first, then case-insensitive alphabetical.
 */
function compareEntries(a: FileEntry, b: FileEntry): number {
  // Directories always come first
  if (a.isDirectory !== b.isDirectory) {
    return a.isDirectory ? -1 : 1;
  }
  // Case-insensitive alphabetical
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

// ---------------------------------------------------------------------------
// Flatten
// ---------------------------------------------------------------------------

/**
 * Recursively flatten the tree cache into a flat array for virtualized
 * rendering. Only includes nodes whose parent directories are expanded.
 *
 * @param treeCache - Map of directory path -> immediate children entries.
 *   The root directory's children are stored under `rootPath`.
 * @param expandedPaths - Set of directory paths that are currently expanded.
 * @param rootPath - The root path key in `treeCache` (typically `""` or `"/"`).
 * @returns A flat array of `FlatTreeNode` in display order.
 */
export function flattenVisibleTree(
  treeCache: Map<string, FileEntry[]>,
  expandedPaths: Set<string>,
  rootPath: string
): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];

  function walk(dirPath: string, depth: number): void {
    const children = treeCache.get(dirPath);
    if (!children) return;

    // Sort a shallow copy to avoid mutating the cache
    const sorted = children.slice().sort(compareEntries);

    for (const entry of sorted) {
      const isExpanded = entry.isDirectory && expandedPaths.has(entry.path);
      const parentPath = depth === 0 ? null : dirPath;

      result.push({
        path: entry.path,
        name: entry.name,
        isDirectory: entry.isDirectory,
        depth,
        isExpanded,
        parentPath,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
        isHidden: entry.isHidden,
        isIgnored: entry.isIgnored,
      });

      // If this directory is expanded, recurse into it
      if (isExpanded) {
        walk(entry.path, depth + 1);
      }
    }
  }

  walk(rootPath, 0);
  return result;
}
