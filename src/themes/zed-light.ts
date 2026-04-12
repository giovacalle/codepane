/**
 * Zed Light theme preset.
 *
 * Colors sourced from Zed's default light theme (One Light inspired).
 * https://zed.dev
 */

import type { EditorTheme } from '../core/types';

export const zedLight: EditorTheme = {
  colors: {
    background: '#fafafa',
    foreground: '#383a42',
    border: '#d3d4d5',
    accent: '#4078f2',
    selection: 'rgba(64, 120, 242, 0.12)',
    cursor: '#526eff',

    // Surfaces
    elevatedSurface: '#ffffff',
    panelBackground: '#f0f0f0',
    statusBarBackground: '#eaeaeb',

    // File tree
    treeHover: 'rgba(56, 58, 66, 0.05)',
    treeSelected: 'rgba(64, 120, 242, 0.12)',
    treeIndentGuide: '#d3d4d5',

    // Editor
    editorBackground: '#fafafa',
    editorLineHighlight: 'rgba(0, 0, 0, 0.03)',
    editorGutter: '#9d9d9f',

    // Tabs
    tabActive: '#fafafa',
    tabInactive: '#f0f0f0',
    tabDirtyIndicator: '#c18401',

    // Search
    searchMatch: 'rgba(193, 132, 1, 0.20)',
    searchMatchSelected: 'rgba(193, 132, 1, 0.40)',

    // Status indicators
    error: '#e45649',
    warning: '#c18401',
    success: '#50a14f',
    info: '#4078f2',

    // Version control
    added: '#50a14f',
    modified: '#c18401',
    deleted: '#e45649',
    conflict: '#c18401',

    // Syntax highlighting
    keyword: '#a626a4',
    string: '#50a14f',
    comment: '#a0a1a7',
    number: '#986801',
    function: '#4078f2',
    type: '#c18401',
    variable: '#e45649',
    operator: '#0184bc',
    attribute: '#986801',
    punctuation: '#383a42',
    constant: '#986801',
    tag: '#e45649',

    // Component-specific
    scrollbarThumb: 'rgba(0, 0, 0, 0.15)',
    scrollbarTrack: 'transparent',
    tooltipBackground: '#383a42',
    tooltipForeground: '#fafafa',
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
