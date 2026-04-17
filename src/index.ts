// ---------------------------------------------------------------------------
// codepane — Public API
// ---------------------------------------------------------------------------
// Barrel export for the editor package. Provides the `Editor` namespace
// object for dot-notation component access, all public hooks, adapter
// factories, theme utilities, and re-exported types.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Components — assembled into a namespace object for dot-notation usage
// ---------------------------------------------------------------------------

import { EditorRoot } from './components/root'
import { EditorPanel } from './components/panel'
import { EditorPanelGroup } from './components/panel-group'
import { EditorPanelResizeHandle } from './components/panel-resize-handle'
import { FileTree as EditorFileTree } from './components/file-tree'
import { EditorTabs } from './components/tabs'
import { EditorContent } from './components/content'
import { EditorBreadcrumbs } from './components/breadcrumbs'
import { EditorStatusBar } from './components/status-bar'
import { CommandPalette as EditorCommandPalette } from './components/command-palette'
import { EditorMinimap } from './components/minimap'
import { DiffViewer as EditorDiffViewer } from './components/diff-viewer'
import { EditorMenubar } from './components/menubar'
import { SearchPanel as EditorSearchPanel } from './components/search-panel'
import { SettingsPanel as EditorSettingsPanel } from './components/settings-panel'

/**
 * Composable editor component namespace.
 *
 * @example
 * ```tsx
 * import { Editor } from 'codepane';
 *
 * <Editor.Root adapter={adapter}>
 *   <Editor.PanelGroup direction="horizontal">
 *     <Editor.Panel defaultSize={25} minSize={15}>
 *       <Editor.FileTree />
 *     </Editor.Panel>
 *     <Editor.PanelResizeHandle />
 *     <Editor.Panel defaultSize={75}>
 *       <Editor.Breadcrumbs />
 *       <Editor.Tabs />
 *       <Editor.Content />
 *       <Editor.StatusBar />
 *     </Editor.Panel>
 *   </Editor.PanelGroup>
 * </Editor.Root>
 * ```
 */
export const Editor = {
  Root: EditorRoot,
  Panel: EditorPanel,
  PanelGroup: EditorPanelGroup,
  PanelResizeHandle: EditorPanelResizeHandle,
  FileTree: EditorFileTree,
  Tabs: EditorTabs,
  Content: EditorContent,
  Breadcrumbs: EditorBreadcrumbs,
  StatusBar: EditorStatusBar,
  CommandPalette: EditorCommandPalette,
  Minimap: EditorMinimap,
  DiffViewer: EditorDiffViewer,
  Menubar: EditorMenubar,
  SearchPanel: EditorSearchPanel,
  SettingsPanel: EditorSettingsPanel,
} as const

// ---------------------------------------------------------------------------
// Hooks — public API for headless usage
// ---------------------------------------------------------------------------

export { useEditor } from './hooks/use-editor'
export { useFileTree } from './hooks/use-file-tree'
export { useTabs } from './hooks/use-tabs'
export { useSearch } from './hooks/use-search'
export { useTheme } from './hooks/use-theme'
export { useKeybindings } from './hooks/use-keybindings'
export { useConfig } from './hooks/use-config'
export { useContextMenu } from './hooks/use-context-menu'
export { useCommandPalette, recordRecentFile, getRecentFiles } from './hooks/use-command-palette'

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

export { createHttpAdapter } from './adapters/http-adapter'
export { createMemoryAdapter } from './adapters/memory-adapter'

// ---------------------------------------------------------------------------
// Config storage
// ---------------------------------------------------------------------------

export { createLocalStorageAdapter } from './core/config-storage'
export { createMemoryConfigAdapter } from './core/config-storage'

// ---------------------------------------------------------------------------
// Theme utilities
// ---------------------------------------------------------------------------

export { defaultDarkTheme, defaultLightTheme, mergeTheme } from './core/theme'
export { applyThemeToElement, removeThemeFromElement } from './core/theme'

// ---------------------------------------------------------------------------
// Theme presets
// ---------------------------------------------------------------------------

export { zedDark, zedLight } from './themes'

// ---------------------------------------------------------------------------
// Language registration
// ---------------------------------------------------------------------------

export { registerLanguage, getLanguageExtension } from './utils/language-map'
export type { LanguageLoader } from './utils/language-map'

// ---------------------------------------------------------------------------
// Diff utilities
// ---------------------------------------------------------------------------

export { computeDiff } from './utils/diff'

// ---------------------------------------------------------------------------
// Types — re-exported for consumer convenience
// ---------------------------------------------------------------------------

export type {
  // Core types
  EditorTheme,
  EditorThemeColors,
  EditorThemeFonts,
  EditorThemeSpacing,
  ResolvedEditorTheme,
  DeepPartial,

  // Filesystem types
  FileEntry,
  FileStat,
  ReadDirOptions,

  // Tree types
  FlatTreeNode,

  // Tab types
  Tab,

  // Search types
  SearchQuery,
  SearchResult,
  SearchMatch,

  // Event types
  FileChangeEvent,

  // Lifecycle types
  Disposable,

  // Error types
  EditorError,
} from './core/types'

export type {
  FileSystemAdapter,
  AdapterCapabilities,
  HttpAdapterConfig,
  HttpAdapterEndpoints,
  HttpAdapterMethods,
  HttpMethod,
  MemoryAdapterConfig,
} from './adapters/types'

// Hook return types (for advanced consumers)
export type { UseEditorReturn } from './hooks/use-editor'
export type { UseFileTreeReturn } from './hooks/use-file-tree'
export type { UseTabsReturn } from './hooks/use-tabs'
export type { UseSearchReturn } from './hooks/use-search'
export type { UseThemeReturn } from './hooks/use-theme'
export type { KeyBinding } from './hooks/use-keybindings'
export type { UseConfigReturn, UseConfigOptions } from './hooks/use-config'
export type {
  UseContextMenuReturn,
  ContextMenuTargetType,
  ContextMenuPosition,
  InlineInputState,
} from './hooks/use-context-menu'
export type { UseCommandPaletteReturn } from './hooks/use-command-palette'

// Config types
export type {
  ConfigStorageAdapter,
  EditorRootConfig,
  ThemeConfig,
  LayoutConfig,
  FileTreeConfig,
  ContentConfig,
  TabsConfig,
  SearchConfig,
  ConfigNamespace,
} from './core/config-types'
export { CONFIG_NAMESPACES } from './core/config-types'

// Component prop types
export type { EditorPanelProps } from './components/panel'
export type { EditorPanelGroupProps } from './components/panel-group'
export type { EditorPanelResizeHandleProps } from './components/panel-resize-handle'
export type { EditorBreadcrumbsProps } from './components/breadcrumbs'
export type { EditorStatusBarProps } from './components/status-bar'
export type { ContextMenuProps, InlineInputProps, ContextMenuItem } from './components/context-menu'
export type {
  CommandPaletteProps,
  CommandPaletteRootProps,
  CommandPaletteOverlayProps,
  CommandPaletteContainerProps,
  CommandPaletteInputProps,
  CommandPaletteResultsProps,
  CommandPaletteResultItemProps,
} from './components/command-palette'
export type { FuzzyMatch } from './components/command-palette'
export type { EditorMinimapProps } from './components/minimap'
export type { DiffViewerProps } from './components/diff-viewer'
export type { EditorMenubarProps, MenuDefinition, MenuItemDef } from './components/menubar'
export type {
  SearchPanelProps,
  SearchPanelRootProps,
  SearchPanelOverlayProps,
  SearchPanelContainerProps,
  SearchPanelInputProps,
  SearchPanelTogglesProps,
  SearchPanelReplaceInputProps,
  SearchPanelStatsProps,
  SearchPanelResultsProps,
  SearchPanelFileGroupProps,
  SearchPanelMatchRowProps,
} from './components/search-panel'
export type {
  SettingsPanelProps,
  SettingsPanelRootProps,
  SettingsPanelOverlayProps,
  SettingsPanelContainerProps,
  SettingsPanelTabsProps,
  SettingsPanelContentProps,
  SettingsPanelSectionProps,
  SettingsPanelToggleProps,
  SettingsPanelSliderProps,
  SettingsPanelColorPickerProps,
  SettingsData,
} from './components/settings-panel'

// Diff types
export type { DiffResult, DiffLine, DiffLineType } from './utils/diff'
