// ---------------------------------------------------------------------------
// codepane — useEditor hook
// ---------------------------------------------------------------------------
// Top-level hook that exposes the editor's adapter, resolved theme, and
// current error state. Useful for consumers that need to interact with the
// adapter directly or read global editor state.
// ---------------------------------------------------------------------------

import { useEditorContext, useEditorStore } from '../core/context';
import type { FileSystemAdapter } from '../adapters/types';
import type { ResolvedEditorTheme, EditorError } from '../core/types';

export interface UseEditorReturn {
  /** The filesystem adapter provided to `Editor.Root`. */
  adapter: FileSystemAdapter;
  /** The fully resolved editor theme. */
  theme: ResolvedEditorTheme;
  /** The current global error, or `null` if none. */
  error: EditorError | null;
  /** Set or clear the global error. */
  setError: (error: EditorError | null) => void;
  /** The currently focused panel identifier, or `null`. */
  focusedPanel: string | null;
}

/**
 * Primary hook for accessing top-level editor state.
 *
 * Returns the adapter, theme, and error state. This is the recommended
 * entry point for consumers building headless UIs on top of the editor.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { adapter, theme, error } = useEditor();
 *
 *   if (error) {
 *     return <div>Error: {error.message}</div>;
 *   }
 *
 *   return <div style={{ background: theme.colors.background }}>...</div>;
 * }
 * ```
 */
export function useEditor(): UseEditorReturn {
  const { adapter, theme } = useEditorContext();
  const error = useEditorStore((s) => s.error);
  const setError = useEditorStore((s) => s.setError);
  const focusedPanel = useEditorStore((s) => s.focusedPanel);

  return {
    adapter,
    theme,
    error,
    setError,
    focusedPanel,
  };
}
