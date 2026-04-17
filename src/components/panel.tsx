// ---------------------------------------------------------------------------
// codepane — Editor.Panel
// ---------------------------------------------------------------------------
// Thin wrapper around react-resizable-panels <Panel> that applies editor
// theme CSS variables for consistent styling within the panel layout.
// When a `configId` is provided and the panel is collapsible, collapsed
// state is persisted via the parent PanelGroup's config context.
// ---------------------------------------------------------------------------

import { Panel as ResizablePanel } from 'react-resizable-panels'
import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { usePanelGroupConfig } from './panel-group'

export interface EditorPanelProps {
  /** Default panel size as a percentage (0-100). */
  defaultSize?: number
  /** Minimum panel size as a percentage (0-100). */
  minSize?: number
  /** Maximum panel size as a percentage (0-100). */
  maxSize?: number
  /** Whether the panel can be collapsed. */
  collapsible?: boolean
  /** Size of the panel when collapsed (percentage). */
  collapsedSize?: number
  /** Called when the panel is collapsed. */
  onCollapse?: () => void
  /** Called when the panel is expanded from a collapsed state. */
  onExpand?: () => void
  /** Called when the panel is resized. */
  onResize?: (size: number) => void
  /** Panel order within the group (lower values come first). */
  order?: number
  /** Panel contents. */
  children: ReactNode
  /** Additional CSS class name. */
  className?: string
  /** Additional inline styles. */
  style?: React.CSSProperties
  /** Unique id for layout persistence (used by react-resizable-panels). */
  id?: string
  /**
   * Config persistence identifier. When set on a collapsible panel inside
   * a PanelGroup with its own `configId`, collapsed state is saved and
   * restored automatically across sessions.
   */
  configId?: string
}

/**
 * A resizable panel within an `Editor.PanelGroup`.
 *
 * Wraps `react-resizable-panels`'s `Panel` component with editor theme
 * integration. Use alongside `Editor.PanelGroup` and
 * `Editor.PanelResizeHandle` to build custom layouts.
 *
 * @example
 * ```tsx
 * <Editor.PanelGroup direction="horizontal" configId="main">
 *   <Editor.Panel defaultSize={25} minSize={15} collapsible configId="sidebar">
 *     <Editor.FileTree />
 *   </Editor.Panel>
 *   <Editor.PanelResizeHandle />
 *   <Editor.Panel defaultSize={75}>
 *     <Editor.Content />
 *   </Editor.Panel>
 * </Editor.PanelGroup>
 * ```
 */
export function EditorPanel({
  defaultSize,
  minSize,
  maxSize,
  collapsible,
  collapsedSize,
  onCollapse,
  onExpand,
  onResize,
  order,
  children,
  className,
  style,
  id,
  configId,
}: EditorPanelProps) {
  const groupConfig = usePanelGroupConfig()

  // Determine if this panel should start collapsed from persisted config
  const shouldStartCollapsed =
    configId && collapsible && groupConfig
      ? groupConfig.collapsedPanels.includes(configId)
      : undefined

  const handleCollapse = useCallback(() => {
    if (configId && groupConfig) {
      groupConfig.markCollapsed(configId)
    }
    onCollapse?.()
  }, [configId, groupConfig, onCollapse])

  const handleExpand = useCallback(() => {
    if (configId && groupConfig) {
      groupConfig.markExpanded(configId)
    }
    onExpand?.()
  }, [configId, groupConfig, onExpand])

  const panelStyle: React.CSSProperties = {
    overflow: 'hidden',
    ...style,
  }

  return (
    <ResizablePanel
      id={id}
      defaultSize={shouldStartCollapsed ? (collapsedSize ?? 0) : defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      collapsible={collapsible}
      collapsedSize={collapsedSize}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
      onResize={onResize}
      order={order}
      className={className}
      style={panelStyle}
    >
      {children}
    </ResizablePanel>
  )
}
