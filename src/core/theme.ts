/**
 * codepane — Theme system
 *
 * Provides default dark and light themes inspired by Zed's aesthetic,
 * a deep-merge utility for partial overrides, and helpers to apply/remove
 * theme values as CSS custom properties on a DOM element.
 */

import type { EditorTheme, DeepPartial } from './types'

// ---------------------------------------------------------------------------
// Default themes
// ---------------------------------------------------------------------------

/**
 * Zed-inspired dark theme.
 * Dark, muted backgrounds with blue-purple accent tones.
 */
/**
 * Default dark theme based on Zed's "One Dark" palette.
 * Colors sourced from zed-industries/zed assets/themes/one/one.json.
 */
export const defaultDarkTheme: EditorTheme = {
  colors: {
    background: '#282c33',
    foreground: '#dce0e5',
    border: '#464b57',
    accent: '#74ade8',
    selection: 'rgba(116, 173, 232, 0.24)',
    cursor: '#74ade8',

    // Surfaces
    elevatedSurface: '#2f343e',
    panelBackground: '#2f343e',
    statusBarBackground: '#3b414d',

    // File tree
    treeHover: 'rgba(116, 173, 232, 0.08)',
    treeSelected: 'rgba(116, 173, 232, 0.14)',
    treeIndentGuide: '#363c46',

    // Editor
    editorBackground: '#282c33',
    editorLineHighlight: 'rgba(47, 52, 62, 0.75)',
    editorGutter: '#4e5a5f',

    // Tabs
    tabActive: '#282c33',
    tabInactive: '#2f343e',
    tabDirtyIndicator: '#dec184',

    // Search
    searchMatch: 'rgba(222, 193, 132, 0.20)',
    searchMatchSelected: 'rgba(222, 193, 132, 0.40)',

    // Status indicators
    error: '#d07277',
    warning: '#dec184',
    success: '#a1c181',
    info: '#74ade8',

    // Version control
    added: '#27a657',
    modified: '#d3b020',
    deleted: '#e06c76',
    conflict: '#bf956a',

    // Syntax highlighting
    keyword: '#b477cf',
    string: '#a1c181',
    comment: '#5d636f',
    number: '#bf956a',
    function: '#73ade9',
    type: '#6eb4bf',
    variable: '#acb2be',
    operator: '#6eb4bf',
    attribute: '#74ade8',
    punctuation: '#b2b9c6',
    constant: '#dfc184',
    tag: '#74ade8',

    // Component-specific
    scrollbarThumb: 'rgba(200, 204, 212, 0.30)',
    scrollbarTrack: 'transparent',
    tooltipBackground: '#3b414d',
    tooltipForeground: '#dce0e5',
  },
  fonts: {
    ui: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: '"Zed Mono", "Berkeley Mono", "JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
    monoSize: 14,
    uiSize: 13,
  },
  spacing: {
    treeIndent: 16,
    treeItemHeight: 28,
    tabHeight: 36,
  },
  borderRadius: 6,
}

/**
 * Zed-inspired light theme.
 * Clean whites and soft grays with blue accent tones.
 */
export const defaultLightTheme: EditorTheme = {
  colors: {
    background: '#fafafa',
    foreground: '#3b3b4f',
    border: '#dcdcdc',
    accent: '#3574e0',
    selection: 'rgba(53, 116, 224, 0.14)',
    cursor: '#3574e0',

    // Surfaces
    elevatedSurface: '#ffffff',
    panelBackground: '#f5f5f5',
    statusBarBackground: '#eeeeee',

    // File tree
    treeHover: 'rgba(53, 116, 224, 0.06)',
    treeSelected: 'rgba(53, 116, 224, 0.12)',
    treeIndentGuide: '#e0e0e0',

    // Editor
    editorBackground: '#ffffff',
    editorLineHighlight: 'rgba(0, 0, 0, 0.025)',
    editorGutter: '#9e9e9e',

    // Tabs
    tabActive: '#ffffff',
    tabInactive: '#f2f2f2',
    tabDirtyIndicator: '#d4a017',

    // Search
    searchMatch: 'rgba(212, 160, 23, 0.18)',
    searchMatchSelected: 'rgba(212, 160, 23, 0.36)',

    // Status indicators
    error: '#d32f2f',
    warning: '#f9a825',
    success: '#388e3c',
    info: '#1976d2',

    // Version control
    added: '#388e3c',
    modified: '#f9a825',
    deleted: '#d32f2f',
    conflict: '#e65100',

    // Syntax highlighting
    keyword: '#7c4dff',
    string: '#2e7d32',
    comment: '#9e9e9e',
    number: '#e65100',
    function: '#1565c0',
    type: '#b8860b',
    variable: '#c62828',
    operator: '#00838f',
    attribute: '#e65100',
    punctuation: '#616161',
    constant: '#e65100',
    tag: '#c62828',

    // Component-specific
    scrollbarThumb: 'rgba(0, 0, 0, 0.2)',
    scrollbarTrack: 'transparent',
    tooltipBackground: '#333333',
    tooltipForeground: '#ffffff',
  },
  fonts: {
    ui: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: '"Berkeley Mono", "JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
    monoSize: 13,
    uiSize: 13,
  },
  spacing: {
    treeIndent: 16,
    treeItemHeight: 28,
    tabHeight: 36,
  },
  borderRadius: 6,
}

// ---------------------------------------------------------------------------
// Deep merge
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deep-merge `overrides` into `base`, returning a new `EditorTheme`.
 *
 * - Primitives in `overrides` replace the corresponding value in `base`.
 * - Nested objects are merged recursively.
 * - `base` is never mutated.
 */
export function mergeTheme(base: EditorTheme, overrides: DeepPartial<EditorTheme>): EditorTheme {
  function merge<T>(target: T, source: DeepPartial<T>): T {
    if (!isPlainObject(target) || !isPlainObject(source)) {
      return (source ?? target) as T
    }

    const result: Record<string, unknown> = { ...target }

    for (const key of Object.keys(source)) {
      const sourceVal = (source as Record<string, unknown>)[key]
      const targetVal = (target as Record<string, unknown>)[key]

      if (sourceVal === undefined) {
        continue
      }

      if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
        result[key] = merge(targetVal, sourceVal as DeepPartial<typeof targetVal>)
      } else {
        result[key] = sourceVal
      }
    }

    return result as T
  }

  return merge(base, overrides)
}

// ---------------------------------------------------------------------------
// CSS custom-property helpers
// ---------------------------------------------------------------------------

/** Prefix used for all editor CSS variables. */
const VAR_PREFIX = '--editor'

/**
 * Convert a camelCase key to a kebab-case CSS segment.
 * e.g. `editorBackground` -> `editor-background`
 */
function toKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase()
}

/**
 * Build a flat map of CSS variable names to values from an `EditorTheme`.
 *
 * Naming convention: `--editor-{category}-{property}`
 *   - `--editor-color-background`
 *   - `--editor-font-mono`
 *   - `--editor-spacing-tree-indent`
 *   - `--editor-border-radius`
 */
function themeToVars(theme: EditorTheme): Map<string, string> {
  const vars = new Map<string, string>()

  // Colors
  for (const [key, value] of Object.entries(theme.colors)) {
    vars.set(`${VAR_PREFIX}-color-${toKebab(key)}`, value)
  }

  // Fonts
  vars.set(`${VAR_PREFIX}-font-ui`, theme.fonts.ui)
  vars.set(`${VAR_PREFIX}-font-mono`, theme.fonts.mono)
  vars.set(`${VAR_PREFIX}-font-mono-size`, `${theme.fonts.monoSize}px`)
  vars.set(`${VAR_PREFIX}-font-ui-size`, `${theme.fonts.uiSize}px`)

  // Spacing
  vars.set(`${VAR_PREFIX}-spacing-tree-indent`, `${theme.spacing.treeIndent}px`)
  vars.set(`${VAR_PREFIX}-spacing-tree-item-height`, `${theme.spacing.treeItemHeight}px`)
  vars.set(`${VAR_PREFIX}-spacing-tab-height`, `${theme.spacing.tabHeight}px`)

  // Border radius
  vars.set(`${VAR_PREFIX}-border-radius`, `${theme.borderRadius}px`)

  return vars
}

/** Data attribute set on themed elements for identification during cleanup. */
const THEMED_ATTR = 'data-editor-themed'

/**
 * Apply an `EditorTheme` to a DOM element as CSS custom properties.
 *
 * Each call replaces the previous set of variables on the element (tracked
 * via a data attribute so `removeThemeFromElement` can clean up precisely).
 */
export function applyThemeToElement(element: HTMLElement, theme: EditorTheme): void {
  const vars = themeToVars(theme)
  const varNames: string[] = []

  for (const [name, value] of vars) {
    element.style.setProperty(name, value)
    varNames.push(name)
  }

  // Store the variable names so we can remove exactly these later.
  element.setAttribute(THEMED_ATTR, varNames.join(','))
}

/**
 * Remove all editor CSS custom properties previously applied by
 * `applyThemeToElement` from the given element.
 */
export function removeThemeFromElement(element: HTMLElement): void {
  const stored = element.getAttribute(THEMED_ATTR)
  if (!stored) return

  for (const name of stored.split(',')) {
    element.style.removeProperty(name)
  }

  element.removeAttribute(THEMED_ATTR)
}
