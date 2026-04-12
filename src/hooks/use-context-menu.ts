// ---------------------------------------------------------------------------
// codepane — Context Menu Hook
// ---------------------------------------------------------------------------
// Manages context menu state, positioning, and action handlers.
// All filesystem operations delegate to the adapter via the editor store.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';

import { useEditorStore, useEditorContext } from '../core/context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextMenuTargetType = 'file' | 'directory' | 'background';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface InlineInputState {
  /** The parent directory where the new entry will be created, or the path being renamed. */
  path: string;
  /** Whether this is a rename of an existing entry or creation of a new one. */
  mode: 'rename' | 'new-file' | 'new-folder';
}

export interface UseContextMenuReturn {
  isOpen: boolean;
  position: ContextMenuPosition | null;
  targetPath: string | null;
  targetType: ContextMenuTargetType | null;
  inlineInput: InlineInputState | null;
  open: (e: React.MouseEvent, path: string | null, type: ContextMenuTargetType) => void;
  close: () => void;
  closeInlineInput: () => void;
  // Actions
  handleNewFile: (parentDir: string) => void;
  handleNewFolder: (parentDir: string) => void;
  handleRename: (path: string) => void;
  handleDelete: (path: string) => void;
  handleCopyPath: (path: string) => void;
  handleCopyRelativePath: (path: string) => void;
  handleRefresh: () => void;
  /** Confirm an inline input (create or rename). */
  confirmInlineInput: (value: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Debounce helper
// ---------------------------------------------------------------------------

/**
 * Returns true if a right-click happened too recently (within `ms`).
 * Prevents rapid-fire context menu openings from causing flicker.
 */
function createDebounce(ms: number) {
  let lastCall = 0;
  return (): boolean => {
    const now = Date.now();
    if (now - lastCall < ms) return true;
    lastCall = now;
    return false;
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContextMenu(): UseContextMenuReturn {
  const { adapter, rootPath } = useEditorContext();
  const refreshTree = useEditorStore((s) => s.refreshTree);

  // --- Menu state ---
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition | null>(null);
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<ContextMenuTargetType | null>(null);

  // --- Inline input state ---
  const [inlineInput, setInlineInput] = useState<InlineInputState | null>(null);

  // --- Debounce rapid right-clicks ---
  const debounceRef = useRef(createDebounce(200));

  // --- Open ---
  const open = useCallback(
    (e: React.MouseEvent, path: string | null, type: ContextMenuTargetType) => {
      e.preventDefault();
      e.stopPropagation();

      if (debounceRef.current()) return;

      // Clamp position so the menu doesn't overflow the viewport
      const x = Math.min(e.clientX, window.innerWidth - 8);
      const y = Math.min(e.clientY, window.innerHeight - 8);

      setPosition({ x, y });
      setTargetPath(path);
      setTargetType(type);
      setIsOpen(true);
    },
    []
  );

  // --- Close ---
  const close = useCallback(() => {
    setIsOpen(false);
    setPosition(null);
    setTargetPath(null);
    setTargetType(null);
  }, []);

  const closeInlineInput = useCallback(() => {
    setInlineInput(null);
  }, []);

  // --- Close on Escape, outside click, scroll ---
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    const handleClick = () => close();
    const handleScroll = () => close();

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, close]);

  // --- Helpers ---
  const parentDirOf = useCallback(
    (filePath: string): string => {
      const idx = filePath.lastIndexOf('/');
      return idx > 0 ? filePath.substring(0, idx) : rootPath;
    },
    [rootPath]
  );

  // --- Actions ---

  const handleNewFile = useCallback(
    (parentDir: string) => {
      close();
      setInlineInput({ path: parentDir, mode: 'new-file' });
    },
    [close]
  );

  const handleNewFolder = useCallback(
    (parentDir: string) => {
      close();
      setInlineInput({ path: parentDir, mode: 'new-folder' });
    },
    [close]
  );

  const handleRename = useCallback(
    (path: string) => {
      close();
      setInlineInput({ path, mode: 'rename' });
    },
    [close]
  );

  const handleDelete = useCallback(
    async (path: string) => {
      close();

      if (!adapter.capabilities.delete) return;

      try {
        await adapter.deleteFile(path);
        const parent = parentDirOf(path);
        await refreshTree(parent);
      } catch {
        // Silently fail — adapter will surface errors via store
      }
    },
    [close, adapter, parentDirOf, refreshTree]
  );

  const handleCopyPath = useCallback(
    (path: string) => {
      close();
      void navigator.clipboard?.writeText(path);
    },
    [close]
  );

  const handleCopyRelativePath = useCallback(
    (path: string) => {
      close();
      // Strip rootPath prefix to get relative path
      const relative = path.startsWith(rootPath + '/') ? path.slice(rootPath.length + 1) : path;
      void navigator.clipboard?.writeText(relative);
    },
    [close, rootPath]
  );

  const handleRefresh = useCallback(() => {
    close();
    void refreshTree();
  }, [close, refreshTree]);

  // --- Confirm inline input ---
  const confirmInlineInput = useCallback(
    async (value: string) => {
      if (!inlineInput || !value.trim()) {
        setInlineInput(null);
        return;
      }

      const trimmed = value.trim();

      try {
        if (inlineInput.mode === 'rename') {
          if (!adapter.capabilities.rename) return;
          const parent = parentDirOf(inlineInput.path);
          const newPath = parent === rootPath ? trimmed : `${parent}/${trimmed}`;
          await adapter.rename(inlineInput.path, newPath);
          await refreshTree(parent);
        } else if (inlineInput.mode === 'new-file') {
          if (!adapter.capabilities.write) return;
          const newPath =
            inlineInput.path === rootPath ? trimmed : `${inlineInput.path}/${trimmed}`;
          await adapter.writeFile(newPath, '');
          await refreshTree(inlineInput.path);
        } else if (inlineInput.mode === 'new-folder') {
          if (!adapter.capabilities.createDir) return;
          const newPath =
            inlineInput.path === rootPath ? trimmed : `${inlineInput.path}/${trimmed}`;
          await adapter.createDirectory(newPath);
          await refreshTree(inlineInput.path);
        }
      } catch {
        // Adapter errors are surfaced via the store's error state
      }

      setInlineInput(null);
    },
    [inlineInput, adapter, parentDirOf, rootPath, refreshTree]
  );

  return {
    isOpen,
    position,
    targetPath,
    targetType,
    inlineInput,
    open,
    close,
    closeInlineInput,
    handleNewFile,
    handleNewFolder,
    handleRename,
    handleDelete,
    handleCopyPath,
    handleCopyRelativePath,
    handleRefresh,
    confirmInlineInput,
  };
}
