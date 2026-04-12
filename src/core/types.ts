// ---------------------------------------------------------------------------
// codepane — Core Type Definitions
// ---------------------------------------------------------------------------
// This file contains all foundational types used across the editor package.
// Zero external runtime dependencies — fully self-contained.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Utility Types
// ---------------------------------------------------------------------------

/** Recursively makes all properties of `T` optional. Useful for theme overrides. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ---------------------------------------------------------------------------
// Filesystem Types
// ---------------------------------------------------------------------------

/** A single entry within a directory listing. */
export interface FileEntry {
  /** File or directory name (e.g. "index.ts") */
  name: string;
  /** Full path relative to the adapter root (e.g. "src/index.ts") */
  path: string;
  /** Whether this entry represents a directory */
  isDirectory: boolean;
  /** File size in bytes (may be omitted for directories) */
  size?: number;
  /** Last-modified timestamp as Unix epoch milliseconds */
  modifiedAt?: number;
  /** Whether this entry is a symbolic link */
  isSymlink?: boolean;
  /** Whether this is a hidden file (dotfile) */
  isHidden?: boolean;
  /** Whether this file is ignored by version control (e.g. .gitignore) */
  isIgnored?: boolean;
}

/** Detailed metadata for a file or directory. */
export interface FileStat {
  /** File size in bytes */
  size: number;
  /** Last-modified timestamp as Unix epoch milliseconds */
  modifiedAt: number;
  /** Creation timestamp as Unix epoch milliseconds */
  createdAt: number;
  /** Whether this stat represents a directory */
  isDirectory: boolean;
  /** Whether this stat represents a symbolic link */
  isSymlink: boolean;
}

/** Options for reading a directory listing. */
export interface ReadDirOptions {
  /** How deep to recurse. `1` returns immediate children only. */
  depth?: number;
  /** Include hidden files (dotfiles). Defaults to `false`. */
  showHidden?: boolean;
  /** Include version-control-ignored files. Defaults to `false`. */
  showIgnored?: boolean;
  /** Abort signal to cancel the request */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Tree Types
// ---------------------------------------------------------------------------

/**
 * A flattened tree node optimized for virtualized rendering.
 *
 * The flat array structure allows `@tanstack/react-virtual` to render only
 * visible rows (~50-100 DOM nodes), even for trees with 10,000+ entries.
 */
export interface FlatTreeNode {
  /** Full path relative to the adapter root */
  path: string;
  /** Display name (e.g. "index.ts") */
  name: string;
  /** Whether this node represents a directory */
  isDirectory: boolean;
  /** Nesting depth, starting at 0 for root-level entries */
  depth: number;
  /** Whether this directory is currently expanded in the tree */
  isExpanded: boolean;
  /** Path of the parent directory, or `null` for root-level entries */
  parentPath: string | null;
  /** File size in bytes */
  size?: number;
  /** Last-modified timestamp as Unix epoch milliseconds */
  modifiedAt?: number;
  /** Whether this is a hidden file (dotfile) */
  isHidden?: boolean;
  /** Whether this file is ignored by version control */
  isIgnored?: boolean;
  /** Lazily loaded children (populated when the directory is expanded) */
  children?: FileEntry[];
}

// ---------------------------------------------------------------------------
// Tab Types
// ---------------------------------------------------------------------------

/** Represents an open file tab in the editor. */
export interface Tab {
  /** Unique identifier for this tab */
  id: string;
  /** File path associated with this tab */
  path: string;
  /** Display label (typically the file name, may include parent for disambiguation) */
  label: string;
  /** Whether the file has unsaved modifications */
  isDirty: boolean;
  /** Whether this tab is pinned (protected from auto-close) */
  isPinned: boolean;
  /** Whether this tab is in preview mode (single-click, italic, replaceable) */
  isPreview: boolean;
}

// ---------------------------------------------------------------------------
// Search Types
// ---------------------------------------------------------------------------

/** Parameters for a file content search query. */
export interface SearchQuery {
  /** The search pattern (plain text or regex) */
  pattern: string;
  /** Treat the pattern as a regular expression */
  isRegex?: boolean;
  /** Whether the search should be case-sensitive */
  caseSensitive?: boolean;
  /** Glob pattern to include files (e.g. "*.ts") */
  includeGlob?: string;
  /** Glob pattern to exclude files (e.g. "node_modules/**") */
  excludeGlob?: string;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Abort signal to cancel the search */
  signal?: AbortSignal;
}

/** A single file that contains one or more search matches. */
export interface SearchResult {
  /** Path to the file containing matches */
  path: string;
  /** Individual matches within the file */
  matches: SearchMatch[];
}

/** A single match occurrence within a file. */
export interface SearchMatch {
  /** 1-based line number */
  line: number;
  /** 0-based column offset */
  column: number;
  /** Length of the matched text */
  length: number;
  /** Full content of the line containing the match */
  lineContent: string;
}

// ---------------------------------------------------------------------------
// Event Types
// ---------------------------------------------------------------------------

/** Describes a filesystem change event (used by the watch capability). */
export interface FileChangeEvent {
  /** The type of change that occurred */
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  /** Path affected by the change */
  path: string;
  /** Previous path (only present for `renamed` events) */
  oldPath?: string;
}

// ---------------------------------------------------------------------------
// Lifecycle Types
// ---------------------------------------------------------------------------

/** A handle that can be disposed to release resources (e.g. stop watching). */
export interface Disposable {
  /** Release the underlying resource */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/** Structured error type surfaced by the editor to consumers. */
export interface EditorError {
  /** Machine-readable error code */
  code:
    | 'ADAPTER_ERROR'
    | 'FILE_NOT_FOUND'
    | 'PERMISSION_DENIED'
    | 'NETWORK_ERROR'
    | 'PARSE_ERROR'
    | 'UNKNOWN';
  /** Human-readable error message */
  message: string;
  /** The file path related to the error, if applicable */
  path?: string;
  /** The original error that caused this error */
  cause?: unknown;
}

// ---------------------------------------------------------------------------
// Theme Types
// ---------------------------------------------------------------------------

/** Color tokens for the editor theme. */
export interface EditorThemeColors {
  /** Primary background color */
  background: string;
  /** Primary foreground (text) color */
  foreground: string;
  /** Border color for panels and dividers */
  border: string;
  /** Accent color for focused elements and highlights */
  accent: string;
  /** Text selection background */
  selection: string;
  /** Cursor (caret) color */
  cursor: string;

  // Surfaces
  /** Background for floating panels and dropdowns */
  elevatedSurface: string;
  /** Background for side panels */
  panelBackground: string;
  /** Background for status/footer bar */
  statusBarBackground: string;

  // File tree
  /** Background color when hovering a tree item */
  treeHover: string;
  /** Background color for the selected tree item */
  treeSelected: string;
  /** Color of the indentation guide lines */
  treeIndentGuide: string;

  // Editor
  /** Code editor background (may differ from the overall background) */
  editorBackground: string;
  /** Background highlight for the active line */
  editorLineHighlight: string;
  /** Gutter (line numbers) background */
  editorGutter: string;

  // Tabs
  /** Background color for the active tab */
  tabActive: string;
  /** Background color for inactive tabs */
  tabInactive: string;
  /** Indicator color for tabs with unsaved changes */
  tabDirtyIndicator: string;

  // Search
  /** Background highlight for search matches */
  searchMatch: string;
  /** Background highlight for the currently selected search match */
  searchMatchSelected: string;

  // Status indicators
  /** Error state color */
  error: string;
  /** Warning state color */
  warning: string;
  /** Success state color */
  success: string;
  /** Info state color */
  info: string;

  // Version control
  /** Color for new/added lines */
  added: string;
  /** Color for changed/modified lines */
  modified: string;
  /** Color for removed/deleted lines */
  deleted: string;
  /** Color for merge conflicts */
  conflict: string;

  // Syntax highlighting
  /** Language keywords (if, else, return, etc.) */
  keyword: string;
  /** String literals */
  string: string;
  /** Comments */
  comment: string;
  /** Numeric values */
  number: string;
  /** Function names */
  function: string;
  /** Type names */
  type: string;
  /** Variable names */
  variable: string;
  /** Operators (+, -, =, etc.) */
  operator: string;
  /** Attributes and decorators */
  attribute: string;
  /** Brackets, semicolons, and other punctuation */
  punctuation: string;
  /** Constants and boolean values */
  constant: string;
  /** HTML/XML tags */
  tag: string;

  // Component-specific
  /** Scrollbar thumb color */
  scrollbarThumb: string;
  /** Scrollbar track color */
  scrollbarTrack: string;
  /** Tooltip background color */
  tooltipBackground: string;
  /** Tooltip text color */
  tooltipForeground: string;
}

/** Font tokens for the editor theme. */
export interface EditorThemeFonts {
  /** Font family for UI elements (tree, tabs, status bar) */
  ui: string;
  /** Monospace font family for the code editor */
  mono: string;
  /** Font size for the monospace editor in pixels */
  monoSize: number;
  /** Font size for UI elements in pixels */
  uiSize: number;
}

/** Spacing tokens for the editor theme. */
export interface EditorThemeSpacing {
  /** Indentation width per depth level in the file tree (pixels) */
  treeIndent: number;
  /** Height of each row in the file tree (pixels) */
  treeItemHeight: number;
  /** Height of the tab bar (pixels) */
  tabHeight: number;
}

/**
 * Complete theme definition for the editor.
 *
 * Consumers can provide a `DeepPartial<EditorTheme>` to override individual
 * tokens — unspecified values fall back to the built-in default theme.
 */
export interface EditorTheme {
  /** Color tokens */
  colors: EditorThemeColors;
  /** Font tokens */
  fonts: EditorThemeFonts;
  /** Spacing tokens */
  spacing: EditorThemeSpacing;
  /** Border radius in pixels, applied to panels, tabs, and inputs */
  borderRadius: number;
}

/**
 * A fully resolved theme where every token has a concrete value.
 * Produced by merging a partial user theme with the built-in defaults.
 */
export type ResolvedEditorTheme = Readonly<EditorTheme>;
