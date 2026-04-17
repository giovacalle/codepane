// ---------------------------------------------------------------------------
// codepane — Editor.PanelGroup
// ---------------------------------------------------------------------------
// Wraps react-resizable-panels <PanelGroup> with editor theme styling.
// Provides a context for child panels to persist collapsed state via useConfig.
// ---------------------------------------------------------------------------

import { PanelGroup as ResizablePanelGroup } from 'react-resizable-panels'
import { createContext, useContext, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useConfig } from '../hooks/use-config'

// ---------------------------------------------------------------------------
// Collapsed-panels context — shared between PanelGroup and Panel
// ---------------------------------------------------------------------------

export interface PanelGroupConfigContextValue {
  /** List of panel configIds that are currently collapsed. */
  collapsedPanels: string[]
  /** Mark a panel as collapsed. */
  markCollapsed: (configId: string) => void
  /** Mark a panel as expanded (remove from collapsed list). */
  markExpanded: (configId: string) => void
}

export const PanelGroupConfigContext = createContext<PanelGroupConfigContextValue | null>(null)
PanelGroupConfigContext.displayName = 'PanelGroupConfigContext'

/** Hook for child panels to access collapsed-state persistence. */
export function usePanelGroupConfig(): PanelGroupConfigContextValue | null {
  return useContext(PanelGroupConfigContext)
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorPanelGroupProps {
  /** Layout direction for the panel group. */
  direction: 'horizontal' | 'vertical'
  /**
   * Unique identifier used to persist panel sizes to localStorage.
   * When provided, the library saves and restores sizes automatically.
   */
  autoSaveId?: string
  /**
   * Config namespace for persisting collapsed-panel state.
   * When provided, child panels with a `configId` will have their
   * collapsed/expanded state saved and restored automatically.
   */
  configId?: string
  /** Panel group contents (must include Panel and PanelResizeHandle children). */
  children: ReactNode
  /** Additional CSS class name. */
  className?: string
  /** Additional inline styles. */
  style?: React.CSSProperties
}

/**
 * Container for a group of resizable panels.
 *
 * Wraps `react-resizable-panels`'s `PanelGroup` and applies editor theme
 * styles. Use `autoSaveId` to persist layout sizes across sessions.
 * Use `configId` to persist collapsed-panel state for child panels.
 *
 * @example
 * ```tsx
 * <Editor.PanelGroup direction="horizontal" autoSaveId="editor-layout" configId="main">
 *   <Editor.Panel defaultSize={30} configId="sidebar" collapsible>...</Editor.Panel>
 *   <Editor.PanelResizeHandle />
 *   <Editor.Panel defaultSize={70}>...</Editor.Panel>
 * </Editor.PanelGroup>
 * ```
 */
export function EditorPanelGroup({
  direction,
  autoSaveId,
  configId,
  children,
  className,
  style,
}: EditorPanelGroupProps) {
  const configNamespace = configId ? `layout:${configId}` : 'layout:_default'

  const { config, setConfig } = useConfig(configNamespace, {
    defaults: { collapsedPanels: [] as string[] },
  })

  const markCollapsed = useCallback(
    (panelId: string) => {
      setConfig({
        collapsedPanels: config.collapsedPanels.includes(panelId)
          ? config.collapsedPanels
          : [...config.collapsedPanels, panelId],
      })
    },
    [config.collapsedPanels, setConfig],
  )

  const markExpanded = useCallback(
    (panelId: string) => {
      setConfig({
        collapsedPanels: config.collapsedPanels.filter((id) => id !== panelId),
      })
    },
    [config.collapsedPanels, setConfig],
  )

  const contextValue = useMemo<PanelGroupConfigContextValue>(
    () => ({
      collapsedPanels: config.collapsedPanels,
      markCollapsed,
      markExpanded,
    }),
    [config.collapsedPanels, markCollapsed, markExpanded],
  )

  const groupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: direction === 'horizontal' ? 'row' : 'column',
    height: '100%',
    width: '100%',
    background: 'var(--editor-color-background)',
    color: 'var(--editor-color-foreground)',
    fontFamily: 'var(--editor-font-ui)',
    fontSize: 'var(--editor-font-ui-size)',
    ...style,
  }

  const panelGroup = (
    <ResizablePanelGroup
      direction={direction}
      autoSaveId={autoSaveId}
      className={className}
      style={groupStyle}
    >
      {children}
    </ResizablePanelGroup>
  )

  // Only provide the config context when configId is set
  if (configId) {
    return (
      <PanelGroupConfigContext.Provider value={contextValue}>
        {panelGroup}
      </PanelGroupConfigContext.Provider>
    )
  }

  return panelGroup
}
