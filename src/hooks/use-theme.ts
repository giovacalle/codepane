// ---------------------------------------------------------------------------
// codepane — useTheme hook
// ---------------------------------------------------------------------------
// Provides access to the fully resolved editor theme from context.
// ---------------------------------------------------------------------------

import { useEditorContext } from '../core/context'
import type { ResolvedEditorTheme } from '../core/types'

export interface UseThemeReturn {
  /** The fully resolved editor theme (default theme merged with overrides). */
  theme: ResolvedEditorTheme
}

/**
 * Hook for accessing the resolved editor theme.
 *
 * Returns the theme provided to `Editor.Root`, with user overrides
 * merged into the default theme. Useful for building custom components
 * that need to match the editor's visual style.
 *
 * @example
 * ```tsx
 * function MyCustomPanel() {
 *   const { theme } = useTheme();
 *
 *   return (
 *     <div style={{
 *       background: theme.colors.background,
 *       color: theme.colors.foreground,
 *       fontFamily: theme.fonts.ui,
 *     }}>
 *       Custom content
 *     </div>
 *   );
 * }
 * ```
 */
export function useTheme(): UseThemeReturn {
  const { theme } = useEditorContext()
  return { theme }
}
