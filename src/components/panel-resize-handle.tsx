// ---------------------------------------------------------------------------
// codepane — Editor.PanelResizeHandle
// ---------------------------------------------------------------------------
// Styled resize handle for use between Editor.Panel components.
// Renders a thin line with hover/active accent highlighting.
// ---------------------------------------------------------------------------

import { PanelResizeHandle as ResizableHandle } from 'react-resizable-panels';
import { useState, useCallback } from 'react';

export interface EditorPanelResizeHandleProps {
  /** Unique identifier for the handle. */
  id?: string;
  /** Whether the handle is disabled. */
  disabled?: boolean;
  /** Additional CSS class name. */
  className?: string;
  /** Additional inline styles. */
  style?: React.CSSProperties;
}

/**
 * A styled resize handle placed between `Editor.Panel` components.
 *
 * Renders as a subtle 2px line that highlights with the accent color
 * on hover and while dragging. Cursor automatically adjusts based on
 * the parent `PanelGroup` direction.
 *
 * @example
 * ```tsx
 * <Editor.PanelGroup direction="horizontal">
 *   <Editor.Panel defaultSize={30}>...</Editor.Panel>
 *   <Editor.PanelResizeHandle />
 *   <Editor.Panel defaultSize={70}>...</Editor.Panel>
 * </Editor.PanelGroup>
 * ```
 */
export function EditorPanelResizeHandle({
  id,
  disabled,
  className,
  style,
}: EditorPanelResizeHandleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const isActive = isHovered || isDragging;

  const handleStyle: React.CSSProperties = {
    // Layout
    flex: '0 0 2px',
    position: 'relative',
    outline: 'none',

    // Visual
    background: isActive ? 'var(--editor-color-accent)' : 'var(--editor-color-border)',
    transition: 'background 150ms ease',
    ...style,
  };

  // Invisible hit area for easier grabbing
  const hitAreaStyle: React.CSSProperties = {
    position: 'absolute',
    inset: '-3px',
    zIndex: 1,
  };

  return (
    <ResizableHandle
      id={id}
      disabled={disabled}
      className={className}
      style={handleStyle}
      onDragging={setIsDragging}
    >
      <div
        style={hitAreaStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-hidden
      />
    </ResizableHandle>
  );
}
