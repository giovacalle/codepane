/**
 * Zed Dark theme preset.
 *
 * Colors sourced from Zed's default dark theme (One Dark inspired).
 * https://zed.dev
 */

import type { EditorTheme } from '../core/types';

export const zedDark: EditorTheme = {
  colors: {
    background: '#1e2027',
    foreground: '#abb2bf',
    border: '#3e4452',
    accent: '#528bff',
    selection: 'rgba(82, 139, 255, 0.20)',
    cursor: '#528bff',

    // Surfaces
    elevatedSurface: '#252830',
    panelBackground: '#1b1d23',
    statusBarBackground: '#1b1d23',

    // File tree
    treeHover: 'rgba(171, 178, 191, 0.06)',
    treeSelected: 'rgba(82, 139, 255, 0.15)',
    treeIndentGuide: '#3e4452',

    // Editor
    editorBackground: '#282c34',
    editorLineHighlight: 'rgba(171, 178, 191, 0.04)',
    editorGutter: '#5c6370',

    // Tabs
    tabActive: '#282c34',
    tabInactive: '#21252b',
    tabDirtyIndicator: '#e5c07b',

    // Search
    searchMatch: 'rgba(229, 192, 123, 0.25)',
    searchMatchSelected: 'rgba(229, 192, 123, 0.50)',

    // Status indicators
    error: '#e05561',
    warning: '#d4a72c',
    success: '#7ec699',
    info: '#54b9ff',

    // Version control
    added: '#7ec699',
    modified: '#d4a72c',
    deleted: '#e05561',
    conflict: '#d4a72c',

    // Syntax highlighting
    keyword: '#c678dd',
    string: '#98c379',
    comment: '#5c6370',
    number: '#d19a66',
    function: '#61afef',
    type: '#e5c07b',
    variable: '#e06c75',
    operator: '#56b6c2',
    attribute: '#d19a66',
    punctuation: '#abb2bf',
    constant: '#d19a66',
    tag: '#e06c75',

    // Component-specific
    scrollbarThumb: 'rgba(171, 178, 191, 0.18)',
    scrollbarTrack: 'transparent',
    tooltipBackground: '#3e4452',
    tooltipForeground: '#abb2bf',
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
};
