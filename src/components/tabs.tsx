// ---------------------------------------------------------------------------
// codepane — Editor.Tabs
// ---------------------------------------------------------------------------
// Horizontal tab bar rendering open files from the store. Zed-inspired
// minimal design with subtle active indicator, dirty dots, and preview
// italics. Uses inline styles and CSS variables for styling-agnostic output.
// ---------------------------------------------------------------------------

import React, { useCallback, useRef, useEffect, useMemo } from 'react'
import { useEditorStore, useEditorContext } from '../core/context'
import type { Tab, EditorTheme } from '../core/types'
import { useConfig } from '../hooks/use-config'

// ---------------------------------------------------------------------------
// Tab config persistence shape
// ---------------------------------------------------------------------------

interface TabsConfig extends Record<string, unknown> {
  openPaths: string[]
  activePath: string
  pinnedPaths: string[]
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorTabsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether tabs show a close button. Defaults to `true`. */
  closable?: boolean
  /** Maximum number of visible tabs (older tabs are still accessible via scroll) */
  maxTabs?: number
  /** Custom tab renderer. Receives the full Tab object. */
  renderTab?: (tab: Tab) => React.ReactNode
  /** CSS class applied to the outermost container */
  className?: string
  /** Inline styles merged with the root element's default styles. */
  style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Close button
// ---------------------------------------------------------------------------

const CloseButton: React.FC<{
  theme: EditorTheme
  onClick: (e: React.MouseEvent) => void
}> = ({ theme, onClick }) => {
  const [hovered, setHovered] = React.useState(false)

  return (
    <button
      type="button"
      aria-label="Close tab"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        border: 'none',
        background: hovered ? `${theme.colors.foreground}15` : 'transparent',
        color: theme.colors.foreground,
        borderRadius: theme.borderRadius / 2,
        cursor: 'pointer',
        padding: 0,
        marginLeft: 4,
        opacity: hovered ? 1 : 0.5,
        transition: 'opacity 150ms ease, background 150ms ease',
        flexShrink: 0,
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <line x1="2" y1="2" x2="8" y2="8" />
        <line x1="8" y1="2" x2="2" y2="8" />
      </svg>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Single tab
// ---------------------------------------------------------------------------

interface TabItemProps {
  tab: Tab
  isActive: boolean
  theme: EditorTheme
  closable: boolean
  renderTab?: (tab: Tab) => React.ReactNode
  onActivate: (tabId: string) => void
  onClose: (tabId: string) => void
}

const TabItem = React.memo<TabItemProps>(function TabItem({
  tab,
  isActive,
  theme,
  closable,
  renderTab,
  onActivate,
  onClose,
}) {
  const [hovered, setHovered] = React.useState(false)

  const handleClick = useCallback(() => {
    onActivate(tab.id)
  }, [tab.id, onActivate])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle click closes the tab
      if (e.button === 1) {
        e.preventDefault()
        onClose(tab.id)
      }
    },
    [tab.id, onClose],
  )

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClose(tab.id)
    },
    [tab.id, onClose],
  )

  // Custom renderer
  if (renderTab) {
    return (
      <div
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        style={{ cursor: 'pointer' }}
        role="tab"
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
      >
        {renderTab(tab)}
      </div>
    )
  }

  const backgroundColor = isActive
    ? theme.colors.tabActive
    : hovered
      ? `${theme.colors.tabActive}80`
      : theme.colors.tabInactive

  return (
    <div
      role="tab"
      aria-selected={isActive}
      aria-label={`${tab.label}${tab.isDirty ? ' (unsaved)' : ''}`}
      tabIndex={isActive ? 0 : -1}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        padding: '0 12px',
        backgroundColor,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        position: 'relative',
        transition: 'background-color 150ms ease',
        flexShrink: 0,
        gap: 2,
      }}
    >
      {/* Active tab accent border (bottom) */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: theme.colors.accent,
          }}
        />
      )}

      {/* Dirty indicator dot */}
      {tab.isDirty && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: theme.colors.tabDirtyIndicator,
            flexShrink: 0,
            marginRight: 4,
          }}
        />
      )}

      {/* File name */}
      <span
        style={{
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.fonts.uiSize}px`,
          color: isActive ? theme.colors.foreground : `${theme.colors.foreground}99`,
          fontStyle: tab.isPreview ? 'italic' : 'normal',
          lineHeight: 1,
          transition: 'color 150ms ease',
        }}
      >
        {tab.label}
      </span>

      {/* Close button */}
      {closable && !tab.isPinned && <CloseButton theme={theme} onClick={handleClose} />}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

const TABS_CONFIG_DEFAULTS: TabsConfig = {
  openPaths: [],
  activePath: '',
  pinnedPaths: [],
}

export const EditorTabs = React.memo<EditorTabsProps>(function EditorTabs({
  closable = true,
  maxTabs,
  renderTab,
  className,
  style,
  ...rest
}) {
  const { theme, adapter, store } = useEditorContext()

  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const closeTab = useEditorStore((s) => s.closeTab)
  const openFile = useEditorStore((s) => s.openFile)

  // -- Config persistence ----------------------------------------------------

  const configOptions = useMemo(() => ({ defaults: TABS_CONFIG_DEFAULTS }), [])
  const {
    config,
    setConfig,
    isLoading: configLoading,
  } = useConfig<TabsConfig>('tabs', configOptions)

  // Track whether initial restore has been performed
  const restoredRef = useRef(false)

  // Restore tabs from persisted config on initial mount (after config loads)
  useEffect(() => {
    if (configLoading || restoredRef.current) return

    const { openPaths, activePath, pinnedPaths } = config

    // Nothing to restore — mark as done immediately
    if (!openPaths || openPaths.length === 0) {
      restoredRef.current = true
      return
    }

    const pinnedSet = new Set(pinnedPaths ?? [])
    let cancelled = false

    ;(async () => {
      // Open files sequentially to maintain tab order
      for (const filePath of openPaths) {
        if (cancelled) break
        try {
          const fileExists = await adapter.exists(filePath)
          if (!fileExists) continue
          await openFile(filePath)
        } catch {
          // Skip files that fail to open
        }
      }

      if (cancelled) return

      // Restore pinned state
      if (pinnedSet.size > 0) {
        const state = store.getState()
        const updatedTabs = state.tabs.map((t) =>
          pinnedSet.has(t.path) ? { ...t, isPinned: true } : t,
        )
        store.setState({ tabs: updatedTabs })
      }

      // Restore active tab
      if (activePath) {
        const state = store.getState()
        const targetTab = state.tabs.find((t) => t.path === activePath)
        if (targetTab) {
          store.setState({ activeTabId: targetTab.id, selectedPath: activePath })
        }
      }

      // Mark restore as complete AFTER all async work finishes —
      // this prevents the sync-to-config effect from overwriting
      // persisted state with partial data during restore.
      restoredRef.current = true
    })()

    return () => {
      cancelled = true
    }
  }, [configLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync store tab changes to config
  useEffect(() => {
    // Don't sync until restore is complete
    if (!restoredRef.current) return

    const unsubscribe = store.subscribe((state, prevState) => {
      if (state.tabs === prevState.tabs && state.activeTabId === prevState.activeTabId) {
        return
      }

      const openPaths = state.tabs.map((t) => t.path)
      const pinnedPaths = state.tabs.filter((t) => t.isPinned).map((t) => t.path)
      const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
      const activePath = activeTab?.path ?? ''

      setConfig({ openPaths, activePath, pinnedPaths })
    })

    return unsubscribe
  }, [store, setConfig])

  // Limit visible tabs if maxTabs is set
  const visibleTabs = maxTabs ? tabs.slice(0, maxTabs) : tabs

  // Scroll container ref for auto-scrolling to active tab
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (!scrollRef.current || !activeTabId) return

    const container = scrollRef.current
    const activeEl = container.querySelector(`[data-tab-id="${CSS.escape(activeTabId)}"]`)

    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      })
    }
  }, [activeTabId])

  const handleActivate = useCallback(
    (tabId: string) => {
      setActiveTab(tabId)
    },
    [setActiveTab],
  )

  const handleClose = useCallback(
    (tabId: string) => {
      closeTab(tabId)
    },
    [closeTab],
  )

  if (visibleTabs.length === 0) {
    return null
  }

  return (
    <div
      className={className}
      role="tablist"
      aria-label="Open files"
      style={{
        display: 'flex',
        height: theme.spacing.tabHeight,
        minHeight: theme.spacing.tabHeight,
        maxHeight: theme.spacing.tabHeight,
        backgroundColor: theme.colors.tabInactive,
        borderBottom: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    >
      {/* Hide webkit scrollbar via inline style tag */}
      <style>{`
        [data-editor-tabs-scroll]::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div
        ref={scrollRef}
        data-editor-tabs-scroll=""
        style={{
          display: 'flex',
          alignItems: 'stretch',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          flex: 1,
        }}
      >
        {visibleTabs.map((tab) => (
          <div key={tab.id} data-tab-id={tab.id} style={{ display: 'flex' }}>
            <TabItem
              tab={tab}
              isActive={tab.id === activeTabId}
              theme={theme}
              closable={closable}
              renderTab={renderTab}
              onActivate={handleActivate}
              onClose={handleClose}
            />
          </div>
        ))}
      </div>
    </div>
  )
})
