// ---------------------------------------------------------------------------
// codepane — useCommandPalette hook
// ---------------------------------------------------------------------------
// Manages the open/close state of the command palette and registers the
// global Cmd+P / Ctrl+P keyboard shortcut to toggle it.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCommandPaletteReturn {
  /** Whether the command palette is currently visible. */
  isOpen: boolean;
  /** Open the command palette. */
  open: () => void;
  /** Close the command palette. */
  close: () => void;
  /** Toggle the command palette open/closed. */
  toggle: () => void;
  /** Ref to attach to the search input for auto-focus on open. */
  inputRef: React.RefObject<HTMLInputElement | null>;
}

// ---------------------------------------------------------------------------
// Recently opened files tracking (scoped per editor instance by rootPath)
// ---------------------------------------------------------------------------

const MAX_RECENT = 20;
const recentFilesMap = new Map<string, string[]>();

/**
 * Record a file as recently opened for a specific editor instance.
 * Moves it to the front of the list if already present, otherwise prepends it.
 *
 * @param rootPath - The root path of the editor instance (scoping key).
 * @param filePath - The file path to record.
 */
export function recordRecentFile(rootPath: string, filePath: string): void {
  const existing = recentFilesMap.get(rootPath) ?? [];
  const updated = [filePath, ...existing.filter((p) => p !== filePath)].slice(0, MAX_RECENT);
  recentFilesMap.set(rootPath, updated);
}

/**
 * Returns the list of recently opened file paths (most recent first)
 * for a specific editor instance.
 *
 * @param rootPath - The root path of the editor instance (scoping key).
 */
export function getRecentFiles(rootPath: string): readonly string[] {
  return recentFilesMap.get(rootPath) ?? [];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for controlling the command palette.
 *
 * Registers a global `Cmd+P` / `Ctrl+P` keyboard shortcut that toggles
 * the palette. When opened, the input ref is focused automatically.
 *
 * @example
 * ```tsx
 * function MyEditor() {
 *   const palette = useCommandPalette();
 *   return (
 *     <>
 *       <button onClick={palette.open}>Open Palette</button>
 *       {palette.isOpen && <CommandPalette onClose={palette.close} inputRef={palette.inputRef} />}
 *     </>
 *   );
 * }
 * ```
 */
export function useCommandPalette(): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    // Focus is handled after mount via a useEffect in the component itself,
    // but we also schedule a focus here as a fallback.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
      return next;
    });
  }, []);

  // Register global Cmd+P / Ctrl+P shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [toggle]);

  return { isOpen, open, close, toggle, inputRef };
}
