// ---------------------------------------------------------------------------
// codepane — Editor.Minimap
// ---------------------------------------------------------------------------
// A VS Code-style minimap that renders a scaled-down canvas representation
// of the active file's content. Shows a viewport indicator for the currently
// visible portion and supports click-to-scroll and drag-to-scroll.
//
// Standalone — no Tailwind or external UI libraries. All styling is inline,
// driven by the editor theme.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore, useEditorContext } from '../core/context'
import type { EditorTheme } from '../core/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorMinimapProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onMouseDown'
> {
  /** Width in pixels. Default: 80 */
  width?: number
  /** Whether to show the minimap. Default: true */
  visible?: boolean
  /** Scale factor for line rendering. Default: 1 */
  scale?: number
  /** CSS class for the container */
  className?: string
  /** Inline styles merged with the container element's default styles. */
  style?: React.CSSProperties
  /** Current scroll top of the editor (pixels) */
  scrollTop?: number
  /** Total scroll height of the editor (pixels) */
  scrollHeight?: number
  /** Visible client height of the editor (pixels) */
  clientHeight?: number
  /** Callback when the user clicks or drags to a position (0-1 ratio) */
  onScrollRequest?: (ratio: number) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Height of each rendered line on the minimap canvas (in CSS pixels). */
const LINE_HEIGHT = 2

/** Maximum lines to render before truncating. */
const MAX_LINES = 5000

/** Debounce delay for canvas re-render on content change (ms). */
const RENDER_DEBOUNCE_MS = 200

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a CSS hex color (#rgb or #rrggbb) into [r, g, b].
 * Returns [128, 128, 128] as a safe fallback for unparseable values.
 */
function parseHexColor(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '')
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16)
    const g = parseInt(cleaned[1] + cleaned[1], 16)
    const b = parseInt(cleaned[2] + cleaned[2], 16)
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b]
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16)
    const g = parseInt(cleaned.slice(2, 4), 16)
    const b = parseInt(cleaned.slice(4, 6), 16)
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b]
  }
  return [128, 128, 128]
}

/**
 * Render the minimap content onto a canvas.
 *
 * Each line is drawn as a thin horizontal strip. Character density within
 * the visible canvas width determines the brightness (alpha) of each pixel
 * column, giving a rough visual impression of code structure.
 */
function renderMinimapCanvas(
  canvas: HTMLCanvasElement,
  lines: string[],
  theme: EditorTheme,
  width: number,
  scale: number,
): void {
  const dpr = window.devicePixelRatio || 1
  const lineCount = Math.min(lines.length, MAX_LINES)
  const lineH = LINE_HEIGHT * scale
  const canvasHeight = lineCount * lineH

  // Size the canvas to match the logical dimensions, scaled for DPR.
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(canvasHeight * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${canvasHeight}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, canvasHeight)

  const [fgR, fgG, fgB] = parseHexColor(theme.colors.foreground)

  // Horizontal padding (CSS px) inside the minimap.
  const padX = 4
  const drawWidth = width - padX * 2

  // Each character in a source line maps to roughly this many CSS px.
  // We cap the maximum "virtual line length" to avoid ultra-wide lines
  // dominating the minimap.
  const maxCharsPerLine = 120
  const charWidth = drawWidth / maxCharsPerLine

  for (let i = 0; i < lineCount; i++) {
    const line = lines[i]
    const y = i * lineH

    if (!line || line.trim().length === 0) continue

    // Walk through the line and draw character blocks.
    const len = Math.min(line.length, maxCharsPerLine)

    // Batch contiguous non-whitespace characters for fewer draw calls.
    let blockStart = -1

    for (let c = 0; c <= len; c++) {
      const ch = c < len ? line[c] : ' ' // sentinel to flush last block
      const isSpace = ch === ' ' || ch === '\t'

      if (!isSpace && blockStart === -1) {
        blockStart = c
      } else if (isSpace && blockStart !== -1) {
        // Flush the block.
        const x = padX + blockStart * charWidth
        const w = (c - blockStart) * charWidth

        // Alpha varies by block density — longer blocks are slightly brighter.
        const density = Math.min((c - blockStart) / 8, 1)
        const alpha = 0.35 + density * 0.25

        ctx.fillStyle = `rgba(${fgR}, ${fgG}, ${fgB}, ${alpha})`
        ctx.fillRect(x, y, w, lineH)

        blockStart = -1
      }
    }
  }

  // If we hit the MAX_LINES limit, draw a fade-out gradient at the bottom.
  if (lines.length > MAX_LINES) {
    const fadeHeight = 20
    const fadeY = canvasHeight - fadeHeight
    const [bgR, bgG, bgB] = parseHexColor(theme.colors.editorBackground)
    const gradient = ctx.createLinearGradient(0, fadeY, 0, canvasHeight)
    gradient.addColorStop(0, `rgba(${bgR}, ${bgG}, ${bgB}, 0)`)
    gradient.addColorStop(1, `rgba(${bgR}, ${bgG}, ${bgB}, 1)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, fadeY, width, fadeHeight)
  }
}

// ---------------------------------------------------------------------------
// EditorMinimap component
// ---------------------------------------------------------------------------

export const EditorMinimap = React.memo<EditorMinimapProps>(function EditorMinimap({
  width = 80,
  visible = true,
  scale = 1,
  className,
  style,
  scrollTop = 0,
  scrollHeight = 0,
  clientHeight = 0,
  onScrollRequest,
  ...rest
}) {
  const { theme } = useEditorContext()

  // Store selectors — read content for the active file.
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const tabs = useEditorStore((s) => s.tabs)
  const fileContents = useEditorStore((s) => s.fileContents)
  const dirtyFiles = useEditorStore((s) => s.dirtyFiles)

  // Resolve active file path.
  const filePath = useMemo(() => {
    const tab = tabs.find((t) => t.id === activeTabId)
    return tab?.path ?? null
  }, [tabs, activeTabId])

  // Resolve content (dirty takes precedence).
  const content = useMemo(() => {
    if (!filePath) return ''
    const dirty = dirtyFiles.get(filePath)
    if (dirty !== undefined) return dirty
    return fileContents.get(filePath) ?? ''
  }, [filePath, dirtyFiles, fileContents])

  // Split content into lines (memoized).
  const lines = useMemo(() => content.split('\n'), [content])

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  // Track previous content for debounced re-render.
  const prevContentRef = useRef<string>('')

  // -----------------------------------------------------------------------
  // Canvas rendering (debounced)
  // -----------------------------------------------------------------------

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderMinimapCanvas(canvas, lines, theme, width, scale)
  }, [lines, theme, width, scale])

  // Debounced render: re-render only when content changes.
  useEffect(() => {
    if (prevContentRef.current === content && canvasRef.current?.width) {
      // Content unchanged — skip re-render.
      return
    }
    prevContentRef.current = content

    if (renderTimeoutRef.current !== null) {
      clearTimeout(renderTimeoutRef.current)
    }

    renderTimeoutRef.current = setTimeout(() => {
      renderCanvas()
      renderTimeoutRef.current = null
    }, RENDER_DEBOUNCE_MS)

    return () => {
      if (renderTimeoutRef.current !== null) {
        clearTimeout(renderTimeoutRef.current)
        renderTimeoutRef.current = null
      }
    }
  }, [content, renderCanvas])

  // Re-render immediately when theme, width, or scale change (no debounce).
  useLayoutEffect(() => {
    renderCanvas()
  }, [theme, width, scale]) // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Viewport indicator position (lightweight — CSS transform, no re-render)
  // -----------------------------------------------------------------------

  const viewportRef = useRef<HTMLDivElement>(null)

  // Total minimap content height in CSS pixels.
  const minimapContentHeight = Math.min(lines.length, MAX_LINES) * LINE_HEIGHT * scale

  // Compute the viewport indicator position and size.
  const viewportStyle = useMemo(() => {
    if (scrollHeight <= 0 || clientHeight <= 0) {
      return { top: 0, height: 0, visible: false }
    }

    const ratio = minimapContentHeight / scrollHeight
    const indicatorHeight = Math.max(clientHeight * ratio, 12) // minimum 12px
    const indicatorTop = scrollTop * ratio

    return {
      top: indicatorTop,
      height: indicatorHeight,
      visible: true,
    }
  }, [scrollTop, scrollHeight, clientHeight, minimapContentHeight])

  // Update viewport indicator via rAF for smooth positioning.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = requestAnimationFrame(() => {
      if (viewportStyle.visible) {
        el.style.transform = `translateY(${viewportStyle.top}px)`
        el.style.height = `${viewportStyle.height}px`
        el.style.opacity = '1'
      } else {
        el.style.opacity = '0'
      }
      rafRef.current = null
    })

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [viewportStyle])

  // -----------------------------------------------------------------------
  // Click & drag handling
  // -----------------------------------------------------------------------

  const [isHovered, setIsHovered] = useState(false)

  const computeScrollRatio = useCallback(
    (clientY: number): number => {
      const container = containerRef.current
      if (!container || minimapContentHeight <= 0) return 0

      const rect = container.getBoundingClientRect()
      const relativeY = clientY - rect.top
      const ratio = Math.max(0, Math.min(1, relativeY / minimapContentHeight))
      return ratio
    },
    [minimapContentHeight],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDraggingRef.current = true

      const ratio = computeScrollRatio(e.clientY)
      onScrollRequest?.(ratio)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return
        const moveRatio = computeScrollRatio(moveEvent.clientY)
        onScrollRequest?.(moveRatio)
      }

      const handleMouseUp = () => {
        isDraggingRef.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        dragCleanupRef.current = null
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      dragCleanupRef.current = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    },
    [computeScrollRatio, onScrollRequest],
  )

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.()
      if (renderTimeoutRef.current !== null) {
        clearTimeout(renderTimeoutRef.current)
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!visible || !filePath) return null

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: `${width}px`,
        backgroundColor: theme.colors.editorBackground,
        borderLeft: `1px solid ${theme.colors.border}`,
        cursor: 'pointer',
        overflow: 'hidden',
        zIndex: 5,
        opacity: isHovered ? 1 : 0.85,
        transition: 'opacity 150ms ease',
        ...style,
      }}
      {...rest}
    >
      {/* Canvas — the scaled-down code representation */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          pointerEvents: 'none',
        }}
      />

      {/* Viewport indicator */}
      <div
        ref={viewportRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: `${theme.colors.accent}26`, // ~15% opacity
          border: `1px solid ${theme.colors.accent}4D`, // ~30% opacity
          borderRadius: '2px',
          pointerEvents: 'none',
          willChange: 'transform, height',
          transition: isDraggingRef.current ? 'none' : 'transform 60ms ease-out',
          opacity: 0,
        }}
      />
    </div>
  )
})
