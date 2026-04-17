// ---------------------------------------------------------------------------
// codepane — Context Menu Component
// ---------------------------------------------------------------------------
// Right-click context menu for the file tree. Renders as a positioned overlay
// at mouse coordinates. All styling is inline using the editor theme — no
// Tailwind, no external UI libraries.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

import type { EditorTheme } from '../core/types'
import { useEditorContext } from '../core/context'
import type {
  ContextMenuTargetType,
  ContextMenuPosition,
  UseContextMenuReturn,
} from '../hooks/use-context-menu'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Custom context menu item injected by consumers. */
export interface ContextMenuItem {
  /** Unique identifier. */
  id: string
  /** Display label. */
  label: string
  /** Optional icon (React node, e.g. SVG). */
  icon?: React.ReactNode
  /** Optional keyboard shortcut display text. */
  shortcut?: string
  /** Whether the item is disabled. */
  disabled?: boolean
  /** Filter: only show this item for specific target types. Shows for all if omitted. */
  visibleFor?: (targetType: 'file' | 'directory' | 'background') => boolean
  /** Called when the item is clicked. */
  action: (targetPath: string | null, targetType: 'file' | 'directory' | 'background') => void
}

export interface ContextMenuProps {
  /** Whether the menu is currently visible. */
  isOpen: boolean
  /** Screen coordinates for the menu. */
  position: ContextMenuPosition | null
  /** Path of the right-clicked item (null for background). */
  targetPath: string | null
  /** What was right-clicked. */
  targetType: ContextMenuTargetType | null
  /** Context menu hook return — supplies action handlers. */
  actions: UseContextMenuReturn
  /** Custom menu items injected by consumers. */
  customItems?: ContextMenuItem[]
  /** CSS class applied to the menu element. */
  className?: string
  /** Inline styles merged with the menu element's default styles. */
  style?: React.CSSProperties
}

interface MenuItemDef {
  id: string
  label: string
  icon: React.ReactNode
  shortcut?: string
  disabled?: boolean
  action: () => void
}

interface MenuSeparatorDef {
  id: string
  separator: true
}

type MenuEntry = MenuItemDef | MenuSeparatorDef

// ---------------------------------------------------------------------------
// Inline SVG Icons (minimal, 16x16)
// ---------------------------------------------------------------------------

const ICON_SIZE = 14

function NewFileIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
      <path
        d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 7v4M6 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function NewFolderIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
      <path
        d="M2 3.5A1.5 1.5 0 013.5 2H6l1.5 2H12.5A1.5 1.5 0 0114 5.5v7a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 7v4M6 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function RenameIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
      <path
        d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
      <path
        d="M3 4h10M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M5 7v5M8 7v5M11 7v5M4.5 4l.5 9.5a1 1 0 001 .5h4a1 1 0 001-.5L11.5 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
      <path
        d="M2.5 8a5.5 5.5 0 019.3-3.95M13.5 2v4h-4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 8a5.5 5.5 0 01-9.3 3.95M2.5 14v-4h4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/**
 * Brighten a hex color by a percentage (0-100).
 * Falls back gracefully if the color is not a standard hex format.
 */
function brighten(hex: string, percent: number): string {
  // Handle rgb/rgba or non-hex values — return as-is
  if (!hex.startsWith('#')) return hex

  const raw = hex.replace('#', '')
  const num = parseInt(
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw,
    16,
  )

  if (isNaN(num)) return hex

  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round((255 * percent) / 100))
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round((255 * percent) / 100))
  const b = Math.min(255, (num & 0xff) + Math.round((255 * percent) / 100))

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

// ---------------------------------------------------------------------------
// Menu Item (memoized)
// ---------------------------------------------------------------------------

interface MenuItemComponentProps {
  item: MenuItemDef
  theme: EditorTheme
}

function MenuItem({ item, theme }: MenuItemComponentProps) {
  const [hovered, setHovered] = useState(false)
  const { colors, fonts, borderRadius } = theme

  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    cursor: item.disabled ? 'default' : 'pointer',
    opacity: item.disabled ? 0.5 : 1,
    fontFamily: fonts.ui,
    fontSize: fonts.uiSize,
    color: colors.foreground,
    backgroundColor: hovered && !item.disabled ? colors.treeHover : 'transparent',
    borderRadius: Math.max(borderRadius - 2, 2),
    border: 'none',
    outline: 'none',
    width: '100%',
    textAlign: 'left',
    transition: 'background-color 100ms ease',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
  }

  return (
    <div
      role="menuitem"
      aria-disabled={item.disabled}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e: React.MouseEvent) => {
        // Prevent the document mousedown listener from closing the menu
        // before the click handler fires
        e.stopPropagation()
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation()
        if (!item.disabled) {
          item.action()
        }
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          flexShrink: 0,
          color: colors.foreground,
          opacity: 0.7,
        }}
      >
        {item.icon}
      </span>

      <span style={{ flex: 1 }}>{item.label}</span>

      {item.shortcut && (
        <span
          style={{
            fontSize: fonts.uiSize - 1,
            opacity: 0.5,
            marginLeft: 16,
          }}
        >
          {item.shortcut}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Separator
// ---------------------------------------------------------------------------

function MenuSeparator({ theme }: { theme: EditorTheme }) {
  return (
    <div
      role="separator"
      style={{
        height: 1,
        backgroundColor: theme.colors.border,
        margin: '4px 8px',
        opacity: 0.5,
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Context Menu
// ---------------------------------------------------------------------------

export function ContextMenu({
  isOpen,
  position,
  targetPath,
  targetType,
  actions,
  customItems,
  className,
  style,
}: ContextMenuProps) {
  const { theme, adapter } = useEditorContext()
  const menuRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [adjustedPos, setAdjustedPos] = useState<ContextMenuPosition | null>(null)

  // Fade in after mount to allow CSS transition
  useEffect(() => {
    let rafId: number | undefined
    if (isOpen && position) {
      // Start with the raw position, adjust after measuring
      setAdjustedPos(position)
      // Trigger fade-in on next frame
      rafId = requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
      setAdjustedPos(null)
    }
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId)
    }
  }, [isOpen, position])

  // Adjust position if menu overflows viewport
  useEffect(() => {
    if (!isOpen || !position || !menuRef.current) return

    const rect = menuRef.current.getBoundingClientRect()
    let { x, y } = position

    if (x + rect.width > window.innerWidth - 8) {
      x = Math.max(8, window.innerWidth - rect.width - 8)
    }
    if (y + rect.height > window.innerHeight - 8) {
      y = Math.max(8, window.innerHeight - rect.height - 8)
    }

    if (x !== position.x || y !== position.y) {
      setAdjustedPos({ x, y })
    }
  }, [isOpen, position, visible])

  // --- Build menu items based on target type ---
  const entries: MenuEntry[] = []

  const canWrite = adapter.capabilities.write
  const canRename = adapter.capabilities.rename
  const canDelete = adapter.capabilities.delete
  const canCreateDir = adapter.capabilities.createDir

  if (targetType === 'file' && targetPath) {
    entries.push({
      id: 'rename',
      label: 'Rename',
      icon: <RenameIcon />,
      shortcut: 'F2',
      disabled: !canRename,
      action: () => actions.handleRename(targetPath),
    })
    entries.push({
      id: 'delete',
      label: 'Delete',
      icon: <DeleteIcon />,
      disabled: !canDelete,
      action: () => actions.handleDelete(targetPath),
    })
    entries.push({ id: 'sep-1', separator: true })
    entries.push({
      id: 'copy-path',
      label: 'Copy Path',
      icon: <CopyIcon />,
      action: () => actions.handleCopyPath(targetPath),
    })
    entries.push({
      id: 'copy-relative-path',
      label: 'Copy Relative Path',
      icon: <CopyIcon />,
      action: () => actions.handleCopyRelativePath(targetPath),
    })
  } else if (targetType === 'directory' && targetPath) {
    entries.push({
      id: 'new-file',
      label: 'New File',
      icon: <NewFileIcon />,
      disabled: !canWrite,
      action: () => actions.handleNewFile(targetPath),
    })
    entries.push({
      id: 'new-folder',
      label: 'New Folder',
      icon: <NewFolderIcon />,
      disabled: !canCreateDir,
      action: () => actions.handleNewFolder(targetPath),
    })
    entries.push({ id: 'sep-1', separator: true })
    entries.push({
      id: 'rename',
      label: 'Rename',
      icon: <RenameIcon />,
      shortcut: 'F2',
      disabled: !canRename,
      action: () => actions.handleRename(targetPath),
    })
    entries.push({
      id: 'delete',
      label: 'Delete',
      icon: <DeleteIcon />,
      disabled: !canDelete,
      action: () => actions.handleDelete(targetPath),
    })
    entries.push({ id: 'sep-2', separator: true })
    entries.push({
      id: 'copy-path',
      label: 'Copy Path',
      icon: <CopyIcon />,
      action: () => actions.handleCopyPath(targetPath),
    })
  } else if (targetType === 'background') {
    entries.push({
      id: 'new-file',
      label: 'New File',
      icon: <NewFileIcon />,
      disabled: !canWrite,
      action: () => actions.handleNewFile(actions.targetPath ?? ''),
    })
    entries.push({
      id: 'new-folder',
      label: 'New Folder',
      icon: <NewFolderIcon />,
      disabled: !canCreateDir,
      action: () => actions.handleNewFolder(actions.targetPath ?? ''),
    })
    entries.push({ id: 'sep-1', separator: true })
    entries.push({
      id: 'refresh',
      label: 'Refresh',
      icon: <RefreshIcon />,
      action: () => actions.handleRefresh(),
    })
  }

  // --- Append custom items ---
  if (customItems && customItems.length > 0 && targetType) {
    const visibleCustom = customItems.filter(
      (item) => !item.visibleFor || item.visibleFor(targetType),
    )
    if (visibleCustom.length > 0) {
      entries.push({ id: 'sep-custom', separator: true })
      for (const item of visibleCustom) {
        entries.push({
          id: `custom-${item.id}`,
          label: item.label,
          icon: item.icon ?? null,
          shortcut: item.shortcut,
          disabled: item.disabled,
          action: () => item.action(targetPath, targetType),
        })
      }
    }
  }

  // --- Don't render if closed ---
  if (!isOpen || !adjustedPos || entries.length === 0) return null

  const menuBg = brighten(theme.colors.background, 10)

  const containerStyle: CSSProperties = {
    position: 'fixed',
    top: adjustedPos.y,
    left: adjustedPos.x,
    zIndex: 9999,
    minWidth: 180,
    padding: 4,
    backgroundColor: menuBg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2)',
    fontFamily: theme.fonts.ui,
    fontSize: theme.fonts.uiSize,
    color: theme.colors.foreground,
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1)' : 'scale(0.96)',
    transition: 'opacity 120ms ease, transform 120ms ease',
    pointerEvents: visible ? 'auto' : 'none',
    userSelect: 'none',
    boxSizing: 'border-box',
    ...style,
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="File tree context menu"
      className={className}
      style={containerStyle}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry) => {
        if ('separator' in entry) {
          return <MenuSeparator key={entry.id} theme={theme} />
        }
        return <MenuItem key={entry.id} item={entry} theme={theme} />
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline Input Component
// ---------------------------------------------------------------------------

export interface InlineInputProps {
  /** The initial value for the input (current name for rename, empty for new). */
  initialValue: string
  /** Whether this is a rename (selects filename without extension). */
  isRename: boolean
  /** Called with the confirmed value. */
  onConfirm: (value: string) => void
  /** Called when the input is cancelled. */
  onCancel: () => void
  /** Editor theme for styling. */
  theme: EditorTheme
}

export function InlineInput({
  initialValue,
  isRename,
  onConfirm,
  onCancel,
  theme,
}: InlineInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(initialValue)
  const confirmedRef = useRef(false)

  // Auto-focus and select on mount
  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    input.focus()

    if (isRename && initialValue.includes('.')) {
      // Select just the filename part, not the extension
      const dotIndex = initialValue.lastIndexOf('.')
      if (dotIndex > 0) {
        input.setSelectionRange(0, dotIndex)
      } else {
        input.select()
      }
    } else {
      input.select()
    }
  }, [isRename, initialValue])

  const confirm = useCallback(() => {
    if (confirmedRef.current) return
    confirmedRef.current = true
    onConfirm(value)
  }, [value, onConfirm])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        confirm()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
      // Stop propagation so tree keyboard handlers don't interfere
      e.stopPropagation()
    },
    [confirm, onCancel],
  )

  const handleBlur = useCallback(() => {
    if (!confirmedRef.current) {
      onCancel()
    }
  }, [onCancel])

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '1px 4px',
    fontFamily: theme.fonts.ui,
    fontSize: theme.fonts.uiSize,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.editorBackground,
    border: `1px solid ${theme.colors.accent}`,
    borderRadius: Math.max(theme.borderRadius - 2, 2),
    outline: 'none',
    boxSizing: 'border-box',
    lineHeight: 'normal',
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={inputStyle}
    />
  )
}
