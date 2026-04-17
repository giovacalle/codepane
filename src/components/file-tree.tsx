// ---------------------------------------------------------------------------
// codepane — FileTree Component
// ---------------------------------------------------------------------------
// Virtualized file tree with Zed-inspired design. Uses @tanstack/react-virtual
// for efficient rendering of large trees. Fully styled via inline styles and
// CSS custom properties (no Tailwind dependency).
// ---------------------------------------------------------------------------

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import type { FileEntry, FlatTreeNode, EditorTheme } from '../core/types'
import { useEditorStore, useEditorContext } from '../core/context'
import { getFileIcon } from '../utils/file-icons'
import { useConfig } from '../hooks/use-config'
import { useContextMenu } from '../hooks/use-context-menu'
import { ContextMenu, InlineInput, type ContextMenuItem } from './context-menu'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props passed to custom row renderers via `renderItem`. */
export interface FileTreeItemProps {
  node: FlatTreeNode
  isSelected: boolean
  isLoading: boolean
  style: CSSProperties
  icon: React.ReactNode
  indentGuides: React.ReactNode
  chevron: React.ReactNode
  onToggle: () => void
  onSelect: () => void
  onOpen: () => void
}

/** Public props for the `Editor.FileTree` component. */
export interface EditorFileTreeProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onSelect' | 'contextMenu'
> {
  /** Show hidden files (dotfiles). Defaults to store value or false. */
  showHidden?: boolean
  /** Show version-control-ignored files. Defaults to store value or false. */
  showIgnored?: boolean
  /** Sort order for entries. Defaults to 'name' (dirs first, alpha). */
  sortOrder?: 'name' | 'type' | 'modified'
  /** Filter function applied to each entry before rendering. */
  fileFilter?: (entry: FileEntry) => boolean
  /** Override the default row renderer. */
  renderItem?: (props: FileTreeItemProps) => React.ReactNode
  /** Override the default file/directory icon. */
  renderIcon?: (entry: FileEntry & { isExpanded?: boolean }) => React.ReactNode
  /** Called when a file or directory is selected (single click). */
  onSelect?: (path: string) => void
  /** Called when a directory is expanded. */
  onExpand?: (path: string) => void
  /** Called when a directory is collapsed. */
  onCollapse?: (path: string) => void
  /** Enable right-click context menu on tree items. Defaults to true. */
  contextMenu?: boolean
  /** Custom context menu items appended after the built-in entries. */
  contextMenuItems?: ContextMenuItem[]
  /** Additional CSS class name on the outer container. */
  className?: string
  /** Inline styles merged with the root element's default styles. */
  style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Chevron SVG (inline, no external deps)
// ---------------------------------------------------------------------------

const CHEVRON_SIZE = 16

/**
 * A small right-pointing chevron that rotates 90deg when expanded.
 * Pure inline SVG to avoid any icon library dependency.
 */
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width={CHEVRON_SIZE}
      height={CHEVRON_SIZE}
      viewBox="0 0 16 16"
      fill="none"
      style={{
        transition: 'transform 150ms ease',
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        flexShrink: 0,
      }}
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Loading spinner (inline SVG)
// ---------------------------------------------------------------------------

function LoadingSpinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{
        animation: 'editor-spin 0.8s linear infinite',
        flexShrink: 0,
      }}
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="20 12"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Indent guides
// ---------------------------------------------------------------------------

function IndentGuides({
  depth,
  indent,
  guideColor,
}: {
  depth: number
  indent: number
  guideColor: string
}) {
  if (depth === 0) return null

  const guides: React.ReactNode[] = []
  for (let i = 0; i < depth; i++) {
    guides.push(
      <span
        key={i}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: i * indent + indent / 2,
          top: 0,
          bottom: 0,
          width: 1,
          backgroundColor: guideColor,
          opacity: 0.4,
          pointerEvents: 'none',
        }}
      />,
    )
  }

  return <>{guides}</>
}

// ---------------------------------------------------------------------------
// Default icon renderer
// ---------------------------------------------------------------------------

function DefaultFileIcon({
  name,
  isDirectory,
  isExpanded,
}: {
  name: string
  isDirectory: boolean
  isExpanded: boolean
}) {
  const descriptor = getFileIcon(name, isDirectory, isExpanded)

  return (
    <span
      aria-hidden="true"
      style={{
        color: descriptor.color,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        lineHeight: 1,
        width: 20,
        textAlign: 'center',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {descriptor.icon}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tree row component (memoized)
// ---------------------------------------------------------------------------

interface TreeRowProps {
  node: FlatTreeNode
  isSelected: boolean
  isLoading: boolean
  theme: EditorTheme
  virtualRowStart: number
  virtualRowSize: number
  renderItem?: EditorFileTreeProps['renderItem']
  renderIcon?: EditorFileTreeProps['renderIcon']
  onToggleDir: (path: string) => void
  onSelectFile: (path: string) => void
  onOpenFile: (path: string) => void
  onSelectCallback?: (path: string) => void
  onExpandCallback?: (path: string) => void
  onCollapseCallback?: (path: string) => void
  onContextMenu?: (e: MouseEvent, path: string, type: 'file' | 'directory') => void
  /** When set, renders an inline input instead of the file name. */
  inlineInput?: {
    initialValue: string
    isRename: boolean
    onConfirm: (value: string) => void
    onCancel: () => void
  }
}

const TreeRow = React.memo(function TreeRow({
  node,
  isSelected,
  isLoading,
  theme,
  virtualRowStart,
  virtualRowSize,
  renderItem,
  renderIcon,
  onToggleDir,
  onSelectFile,
  onOpenFile,
  onSelectCallback,
  onExpandCallback,
  onCollapseCallback,
  onContextMenu: onContextMenuProp,
  inlineInput: inlineInputProps,
}: TreeRowProps) {
  const { colors, spacing, fonts } = theme
  const indent = spacing.treeIndent

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      if (node.isDirectory) {
        if (node.isExpanded) {
          onCollapseCallback?.(node.path)
        } else {
          onExpandCallback?.(node.path)
        }
        onToggleDir(node.path)
      } else {
        onSelectFile(node.path)
        onSelectCallback?.(node.path)
      }
    },
    [
      node.path,
      node.isDirectory,
      node.isExpanded,
      onToggleDir,
      onSelectFile,
      onSelectCallback,
      onExpandCallback,
      onCollapseCallback,
    ],
  )

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      if (!node.isDirectory) {
        onOpenFile(node.path)
      }
    },
    [node.path, node.isDirectory, onOpenFile],
  )

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      if (onContextMenuProp) {
        onContextMenuProp(e, node.path, node.isDirectory ? 'directory' : 'file')
      }
    },
    [onContextMenuProp, node.path, node.isDirectory],
  )

  // Absolute positioning style for the virtual row
  const positionStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: virtualRowSize,
    transform: `translateY(${virtualRowStart}px)`,
  }

  // Build sub-elements for potential custom renderer
  const indentGuides = (
    <IndentGuides depth={node.depth} indent={indent} guideColor={colors.treeIndentGuide} />
  )

  const chevron = node.isDirectory ? (
    isLoading ? (
      <span
        style={{
          width: CHEVRON_SIZE,
          height: CHEVRON_SIZE,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: 0.6,
        }}
      >
        <LoadingSpinner size={12} />
      </span>
    ) : (
      <ChevronIcon expanded={node.isExpanded} />
    )
  ) : (
    // Spacer for files to align with directory rows
    <span
      style={{
        width: CHEVRON_SIZE,
        flexShrink: 0,
      }}
    />
  )

  const icon = renderIcon ? (
    renderIcon({
      name: node.name,
      path: node.path,
      isDirectory: node.isDirectory,
      size: node.size,
      modifiedAt: node.modifiedAt,
      isHidden: node.isHidden,
      isIgnored: node.isIgnored,
      isExpanded: node.isExpanded,
    })
  ) : (
    <DefaultFileIcon name={node.name} isDirectory={node.isDirectory} isExpanded={node.isExpanded} />
  )

  // If a custom renderer is provided, delegate to it
  if (renderItem) {
    return renderItem({
      node,
      isSelected,
      isLoading,
      style: positionStyle,
      icon,
      indentGuides,
      chevron,
      onToggle: () => onToggleDir(node.path),
      onSelect: () => onSelectFile(node.path),
      onOpen: () => onOpenFile(node.path),
    })
  }

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={node.isDirectory ? node.isExpanded : undefined}
      aria-level={node.depth + 1}
      data-path={node.path}
      style={{
        ...positionStyle,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: node.depth * indent + 4,
        paddingRight: 8,
        gap: 4,
        cursor: 'pointer',
        userSelect: 'none',
        fontFamily: fonts.ui,
        fontSize: fonts.uiSize,
        color: colors.foreground,
        backgroundColor: isSelected ? colors.treeSelected : 'transparent',
        transition: 'background-color 150ms ease',
        position: 'absolute',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        boxSizing: 'border-box',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={(e) => {
        if (!isSelected) {
          ;(e.currentTarget as HTMLElement).style.backgroundColor = colors.treeHover
        }
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.backgroundColor = isSelected
          ? colors.treeSelected
          : 'transparent'
      }}
    >
      {/* Indent guide lines (absolutely positioned within the row) */}
      {indentGuides}

      {/* Chevron / spacer */}
      {chevron}

      {/* File/directory icon */}
      {icon}

      {/* File name or inline input */}
      {inlineInputProps ? (
        <span style={{ flex: 1, minWidth: 0 }}>
          <InlineInput
            initialValue={inlineInputProps.initialValue}
            isRename={inlineInputProps.isRename}
            onConfirm={inlineInputProps.onConfirm}
            onCancel={inlineInputProps.onCancel}
            theme={theme}
          />
        </span>
      ) : (
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: node.isIgnored ? 0.5 : node.isHidden ? 0.65 : 1,
            fontStyle: node.isIgnored ? 'italic' : 'normal',
          }}
        >
          {node.name}
        </span>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Keyframe injection (for spinner animation)
// ---------------------------------------------------------------------------

let keyframesInjected = false

function injectKeyframes(): void {
  if (keyframesInjected || typeof document === 'undefined') return
  keyframesInjected = true

  const style = document.createElement('style')
  style.textContent = `
    @keyframes editor-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}

// ---------------------------------------------------------------------------
// FileTree config defaults (stable reference outside component)
// ---------------------------------------------------------------------------

const FILE_TREE_CONFIG_DEFAULTS = {
  showHidden: false,
  showIgnored: false,
  sortOrder: 'name' as const,
  expandedPaths: [] as string[],
}

const FILE_TREE_CONFIG_OPTIONS = { defaults: FILE_TREE_CONFIG_DEFAULTS }

// ---------------------------------------------------------------------------
// FileTree component
// ---------------------------------------------------------------------------

/**
 * Virtualized file tree component.
 *
 * Renders inside an `<Editor.Root>` context — reads tree state from the
 * editor store and dispatches actions (expand, collapse, select, open)
 * through the store.
 *
 * Supports thousands of visible nodes with minimal DOM footprint via
 * `@tanstack/react-virtual`.
 */
export function FileTree({
  showHidden,
  showIgnored,
  fileFilter,
  renderItem,
  renderIcon,
  onSelect,
  onExpand,
  onCollapse,
  contextMenu: contextMenuEnabled = true,
  contextMenuItems,
  className,
  style,
  ...rest
}: EditorFileTreeProps) {
  // Inject spinner keyframes once
  injectKeyframes()

  // --- Persisted config ---
  const { config, setConfig } = useConfig('fileTree', FILE_TREE_CONFIG_OPTIONS)

  // Props override saved config (props > config > defaults)
  const effectiveShowHidden = showHidden ?? config.showHidden
  const effectiveShowIgnored = showIgnored ?? config.showIgnored

  // --- Store state ---
  // The store pre-computes a flat, sorted tree array on every expand/collapse.
  const flatTree = useEditorStore((s) => s.tree)
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const treeLoading = useEditorStore((s) => s.treeLoading)
  const expandedPaths = useEditorStore((s) => s.expandedPaths)

  // --- Store actions ---
  const toggleDir = useEditorStore((s) => s.toggleDir)
  const selectFile = useEditorStore((s) => s.selectFile)
  const openFile = useEditorStore((s) => s.openFile)
  const expandDir = useEditorStore((s) => s.expandDir)

  // --- Context ---
  const { theme, rootPath } = useEditorContext()

  // --- Context menu ---
  const ctxMenu = useContextMenu()

  // --- Restore persisted expanded paths on mount ---
  const hasRestoredRef = useRef(false)

  useEffect(() => {
    if (hasRestoredRef.current) return
    if (config.expandedPaths.length === 0) return
    hasRestoredRef.current = true

    let cancelled = false

    // Expand each saved path sequentially to ensure parent dirs load first
    ;(async () => {
      for (const dirPath of config.expandedPaths) {
        if (cancelled) break
        await expandDir(dirPath)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [config.expandedPaths, expandDir])

  // --- Sync expanded paths to config when they change ---
  const prevExpandedRef = useRef<Set<string>>(expandedPaths)

  useEffect(() => {
    // Skip the initial sync before restoration is complete
    if (!hasRestoredRef.current && config.expandedPaths.length > 0) return

    if (prevExpandedRef.current !== expandedPaths) {
      prevExpandedRef.current = expandedPaths
      setConfig({ expandedPaths: Array.from(expandedPaths) })
    }
  }, [expandedPaths, setConfig, config.expandedPaths.length])

  // --- Virtualizer ref ---
  const scrollRef = useRef<HTMLDivElement>(null)

  // --- Filter the pre-flattened tree ---
  const flatNodes = useMemo(() => {
    let filtered = flatTree

    if (!effectiveShowHidden) {
      filtered = filtered.filter((n) => !n.isHidden)
    }

    if (!effectiveShowIgnored) {
      filtered = filtered.filter((n) => !n.isIgnored)
    }

    if (fileFilter) {
      filtered = filtered.filter((n) =>
        fileFilter({
          name: n.name,
          path: n.path,
          isDirectory: n.isDirectory,
          size: n.size,
          modifiedAt: n.modifiedAt,
          isHidden: n.isHidden,
          isIgnored: n.isIgnored,
        }),
      )
    }

    return filtered
  }, [flatTree, effectiveShowHidden, effectiveShowIgnored, fileFilter])

  // --- Virtualizer ---
  const itemHeight = theme.spacing.treeItemHeight

  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 10,
  })

  // --- Callbacks (stable references) ---
  const handleToggleDir = useCallback(
    (path: string) => {
      toggleDir(path)
    },
    [toggleDir],
  )

  const handleSelectFile = useCallback(
    (path: string) => {
      selectFile(path)
    },
    [selectFile],
  )

  const handleOpenFile = useCallback(
    (path: string) => {
      openFile(path, { preview: false })
    },
    [openFile],
  )

  // --- Context menu handlers ---
  const handleRowContextMenu = useCallback(
    (e: MouseEvent, path: string, type: 'file' | 'directory') => {
      if (contextMenuEnabled) {
        ctxMenu.open(e, path, type)
      }
    },
    [contextMenuEnabled, ctxMenu],
  )

  const handleBackgroundContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!contextMenuEnabled) return
      // Only trigger when clicking the empty area (not a tree row)
      if ((e.target as HTMLElement).closest('[role="treeitem"]')) return
      ctxMenu.open(e, rootPath, 'background')
    },
    [contextMenuEnabled, ctxMenu, rootPath],
  )

  // --- Build inline input props for the matching row ---
  const getInlineInputForNode = useCallback(
    (node: FlatTreeNode) => {
      if (!ctxMenu.inlineInput) return undefined

      const { path: inputPath, mode } = ctxMenu.inlineInput

      // For rename: show input on the exact node being renamed
      if (mode === 'rename' && node.path === inputPath) {
        return {
          initialValue: node.name,
          isRename: true,
          onConfirm: (val: string) => void ctxMenu.confirmInlineInput(val),
          onCancel: ctxMenu.closeInlineInput,
        }
      }

      return undefined
    },
    [ctxMenu],
  )

  // --- Determine if we need a "new entry" placeholder row ---
  // For new-file/new-folder, we inject a visual placeholder node into the
  // rendered output. It appears as the first child of the target directory.
  const newEntryPlaceholder = useMemo(() => {
    if (!ctxMenu.inlineInput) return null
    const { path: parentPath, mode } = ctxMenu.inlineInput
    if (mode === 'rename') return null

    return {
      parentPath,
      mode,
    }
  }, [ctxMenu.inlineInput])

  // Find the index after which the placeholder should appear (the expanded
  // parent directory row). All virtualizer rows after this index need to be
  // offset by one row height to make room for the placeholder.
  const placeholderIndex = useMemo(() => {
    if (!newEntryPlaceholder) return -1
    return flatNodes.findIndex(
      (n) => n.isDirectory && n.isExpanded && n.path === newEntryPlaceholder.parentPath,
    )
  }, [flatNodes, newEntryPlaceholder])

  // --- Render ---
  const virtualItems = virtualizer.getVirtualItems()
  const placeholderHeight = placeholderIndex >= 0 ? itemHeight : 0

  return (
    <div
      ref={scrollRef}
      role="tree"
      aria-label="File explorer"
      className={className}
      style={{
        height: '100%',
        width: '100%',
        overflow: 'auto',
        position: 'relative',
        // Thin auto-hiding scrollbar via CSS
        scrollbarWidth: 'thin',
        scrollbarColor: `${theme.colors.border} transparent`,
        ...style,
      }}
      onContextMenu={handleBackgroundContextMenu}
      {...rest}
    >
      <div
        style={{
          height: virtualizer.getTotalSize() + placeholderHeight,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const node = flatNodes[virtualRow.index]
          if (!node) return null

          // Check if we need to render a "new entry" placeholder after this node
          // The placeholder appears as the first item inside the expanded directory.
          const showPlaceholderAfter =
            placeholderIndex >= 0 && virtualRow.index === placeholderIndex

          // Offset rows after the placeholder by one row height to avoid overlap
          const rowOffset =
            placeholderIndex >= 0 && virtualRow.index > placeholderIndex ? itemHeight : 0

          return (
            <React.Fragment key={node.path}>
              <TreeRow
                node={node}
                isSelected={selectedPath === node.path}
                isLoading={treeLoading.has(node.path)}
                theme={theme}
                virtualRowStart={virtualRow.start + rowOffset}
                virtualRowSize={virtualRow.size}
                renderItem={renderItem}
                renderIcon={renderIcon}
                onToggleDir={handleToggleDir}
                onSelectFile={handleSelectFile}
                onOpenFile={handleOpenFile}
                onSelectCallback={onSelect}
                onExpandCallback={onExpand}
                onCollapseCallback={onCollapse}
                onContextMenu={contextMenuEnabled ? handleRowContextMenu : undefined}
                inlineInput={getInlineInputForNode(node)}
              />
              {showPlaceholderAfter && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: itemHeight,
                    transform: `translateY(${virtualRow.start + virtualRow.size}px)`,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: (node.depth + 1) * theme.spacing.treeIndent + 4 + 16 + 4 + 20 + 4,
                    paddingRight: 8,
                    boxSizing: 'border-box',
                    zIndex: 1,
                  }}
                >
                  <InlineInput
                    initialValue=""
                    isRename={false}
                    onConfirm={(val) => void ctxMenu.confirmInlineInput(val)}
                    onCancel={ctxMenu.closeInlineInput}
                    theme={theme}
                  />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Context menu overlay */}
      {contextMenuEnabled && (
        <ContextMenu
          isOpen={ctxMenu.isOpen}
          position={ctxMenu.position}
          targetPath={ctxMenu.targetPath}
          targetType={ctxMenu.targetType}
          actions={ctxMenu}
          customItems={contextMenuItems}
        />
      )}
    </div>
  )
}
