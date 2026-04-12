// ---------------------------------------------------------------------------
// codepane — useFileTree hook
// ---------------------------------------------------------------------------
// Provides reactive access to the file tree state and actions for expanding,
// collapsing, selecting, and refreshing the tree.
// ---------------------------------------------------------------------------

import { useCallback } from 'react';
import { useEditorStore } from '../core/context';
import type { FlatTreeNode } from '../core/types';

export interface UseFileTreeReturn {
  /** Flattened, display-order tree nodes (only visible nodes are included). */
  tree: FlatTreeNode[];
  /** The currently selected file or directory path, or `null`. */
  selectedPath: string | null;
  /** Set of directory paths that are currently expanded. */
  expandedPaths: Set<string>;
  /** Check whether a specific directory is currently loading its children. */
  isLoading: (path: string) => boolean;
  /** Expand a directory, loading its children if needed. */
  expandDir: (path: string) => Promise<void>;
  /** Collapse a directory. */
  collapseDir: (path: string) => void;
  /** Toggle a directory between expanded and collapsed. */
  toggleDir: (path: string) => Promise<void>;
  /** Select a file or directory in the tree (highlights it). */
  selectFile: (path: string) => void;
  /** Reload the tree from the adapter, optionally scoped to a directory. */
  refresh: (path?: string) => Promise<void>;
}

/**
 * Hook for interacting with the file tree.
 *
 * Returns the flattened tree nodes, selection state, and actions for
 * tree manipulation. Uses granular store selectors to minimize re-renders.
 *
 * @example
 * ```tsx
 * function MyFileTree() {
 *   const { tree, selectedPath, toggleDir, selectFile } = useFileTree();
 *
 *   return (
 *     <ul>
 *       {tree.map(node => (
 *         <li
 *           key={node.path}
 *           onClick={() => node.isDirectory ? toggleDir(node.path) : selectFile(node.path)}
 *           style={{ paddingLeft: node.depth * 16 }}
 *         >
 *           {node.name}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useFileTree(): UseFileTreeReturn {
  const tree = useEditorStore((s) => s.tree);
  const selectedPath = useEditorStore((s) => s.selectedPath);
  const expandedPaths = useEditorStore((s) => s.expandedPaths);
  const treeLoading = useEditorStore((s) => s.treeLoading);
  const expandDir = useEditorStore((s) => s.expandDir);
  const collapseDir = useEditorStore((s) => s.collapseDir);
  const toggleDir = useEditorStore((s) => s.toggleDir);
  const selectFile = useEditorStore((s) => s.selectFile);
  const refreshTree = useEditorStore((s) => s.refreshTree);

  const isLoading = useCallback((path: string): boolean => treeLoading.has(path), [treeLoading]);

  return {
    tree,
    selectedPath,
    expandedPaths,
    isLoading,
    expandDir,
    collapseDir,
    toggleDir,
    selectFile,
    refresh: refreshTree,
  };
}
