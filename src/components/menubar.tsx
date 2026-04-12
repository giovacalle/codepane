import { useState, useRef, useEffect, useCallback, memo, type ReactNode } from 'react'
import { useEditorContext } from '../core/context'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MenuItemDef =
  | { type: 'item'; label: string; shortcut?: string; disabled?: boolean; onSelect?: () => void }
  | { type: 'checkbox'; label: string; checked: boolean; shortcut?: string; onToggle?: () => void }
  | { type: 'separator' }

export interface MenuDefinition {
  label: string
  items: MenuItemDef[]
}

export interface EditorMenubarProps {
  menus: MenuDefinition[]
  className?: string
  style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Platform detection & shortcut formatting
// ---------------------------------------------------------------------------

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

function formatShortcut(shortcut: string): string {
  const parts = shortcut.split('+')
  const formatted = parts.map((part) => {
    const lower = part.toLowerCase()
    if (lower === 'mod') return isMac ? '\u2318' : 'Ctrl'
    if (lower === 'shift') return isMac ? '\u21E7' : 'Shift'
    if (lower === 'alt') return isMac ? '\u2325' : 'Alt'
    return part.charAt(0).toUpperCase() + part.slice(1)
  })

  if (isMac) {
    // Mac: join without separator
    return formatted.join('')
  }
  return formatted.join('+')
}

// ---------------------------------------------------------------------------
// Check mark SVG
// ---------------------------------------------------------------------------

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 11.94l6.72-6.72a.75.75 0 011.06 0z" />
  </svg>
)

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: 32,
  padding: '0 4px',
  background: 'var(--editor-color-status-bar-background)',
  borderBottom: '1px solid var(--editor-color-border)',
  fontFamily: 'var(--editor-font-ui)',
  fontSize: 12,
  color: 'var(--editor-color-foreground)',
  userSelect: 'none',
  position: 'relative',
}

const triggerBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: 24,
  padding: '0 8px',
  borderRadius: 4,
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  position: 'relative',
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  minWidth: 180,
  padding: '4px 0',
  background: 'var(--editor-color-elevated-surface)',
  border: '1px solid var(--editor-color-border)',
  borderRadius: 6,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  zIndex: 1000,
}

const menuItemBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '4px 12px',
  border: 'none',
  background: 'transparent',
  color: 'var(--editor-color-foreground)',
  fontFamily: 'var(--editor-font-ui)',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
  gap: 8,
}

const separatorStyle: React.CSSProperties = {
  height: 1,
  margin: '4px 8px',
  background: 'var(--editor-color-border)',
}

const shortcutStyle: React.CSSProperties = {
  marginLeft: 'auto',
  opacity: 0.5,
  fontSize: 11,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EditorMenubar = memo(function EditorMenubar({
  menus,
  className,
  style,
}: EditorMenubarProps) {
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null)
  const [hoveredItem, setHoveredItem] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (openMenuIndex === null) return

    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenuIndex(null)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openMenuIndex])

  // Close on Escape
  useEffect(() => {
    if (openMenuIndex === null) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuIndex(null)
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [openMenuIndex])

  const handleTriggerClick = useCallback((index: number) => {
    setOpenMenuIndex((prev) => (prev === index ? null : index))
  }, [])

  const handleTriggerMouseEnter = useCallback(
    (index: number) => {
      if (openMenuIndex !== null) {
        setOpenMenuIndex(index)
      }
    },
    [openMenuIndex],
  )

  const handleItemClick = useCallback(
    (item: MenuItemDef) => {
      if (item.type === 'separator') return
      if (item.type === 'item') {
        if (item.disabled) return
        item.onSelect?.()
      } else if (item.type === 'checkbox') {
        item.onToggle?.()
      }
      setOpenMenuIndex(null)
    },
    [],
  )

  return (
    <div
      ref={barRef}
      className={className}
      style={{ ...barStyle, ...style }}
      role="menubar"
    >
      {menus.map((menu, menuIndex) => (
        <div key={menuIndex} style={{ position: 'relative' }}>
          <button
            style={{
              ...triggerBaseStyle,
              background:
                openMenuIndex === menuIndex
                  ? 'var(--editor-color-tree-selected)'
                  : 'transparent',
            }}
            onClick={() => handleTriggerClick(menuIndex)}
            onMouseEnter={() => handleTriggerMouseEnter(menuIndex)}
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={openMenuIndex === menuIndex}
          >
            {menu.label}
          </button>

          {openMenuIndex === menuIndex && (
            <div style={dropdownStyle} role="menu">
              {menu.items.map((item, itemIndex) => {
                if (item.type === 'separator') {
                  return <div key={itemIndex} style={separatorStyle} role="separator" />
                }

                const isDisabled = item.type === 'item' && item.disabled

                return (
                  <button
                    key={itemIndex}
                    style={{
                      ...menuItemBaseStyle,
                      opacity: isDisabled ? 0.4 : 1,
                      cursor: isDisabled ? 'default' : 'pointer',
                      background:
                        hoveredItem === itemIndex
                          ? 'var(--editor-color-tree-hover)'
                          : 'transparent',
                    }}
                    onClick={() => handleItemClick(item)}
                    onMouseEnter={() => setHoveredItem(itemIndex)}
                    onMouseLeave={() => setHoveredItem(null)}
                    disabled={isDisabled}
                    role="menuitem"
                  >
                    {item.type === 'checkbox' && (
                      <span style={{ width: 14, height: 14, display: 'inline-flex' }}>
                        {item.checked && <CheckIcon />}
                      </span>
                    )}
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span style={shortcutStyle}>{formatShortcut(item.shortcut)}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
})
