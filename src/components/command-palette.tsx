// ---------------------------------------------------------------------------
// codepane — Command Palette (Compound Components)
// ---------------------------------------------------------------------------
// A VS Code/Zed-style command palette for quick file navigation. Activated
// via Cmd+P / Ctrl+P (handled by the useCommandPalette hook). All styling
// is inline using the editor theme — no Tailwind or external UI libraries.
//
// Supports two usage modes:
//   1. Simple (retrocompatible): <CommandPalette onClose={…} inputRef={…} />
//   2. Compound:
//        <CommandPalette.Root onClose={…} inputRef={…}>
//          <CommandPalette.Overlay />
//          <CommandPalette.Container>
//            <CommandPalette.Input />
//            <CommandPalette.Results />
//          </CommandPalette.Container>
//        </CommandPalette.Root>
// ---------------------------------------------------------------------------

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useEditorContext, useEditorStore } from '../core/context'
import type { FlatTreeNode, ResolvedEditorTheme } from '../core/types'
import { getRecentFiles, recordRecentFile } from '../hooks/use-command-palette'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandPaletteProps {
  /** Callback invoked when the palette should close. */
  onClose: () => void
  /** Ref to the search input — attached by useCommandPalette for auto-focus. */
  inputRef: React.RefObject<HTMLInputElement | null>
  /** CSS class applied to the backdrop element. */
  className?: string
  /** Inline styles merged with the backdrop element's default styles. */
  style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Fuzzy Search
// ---------------------------------------------------------------------------

export interface FuzzyMatch {
  /** The tree node that matched. */
  node: FlatTreeNode
  /** Indices of matched characters in the node's name. */
  matchIndices: number[]
  /** Score for ranking (higher is better). */
  score: number
}

/**
 * Simple fuzzy matching algorithm. Characters in `pattern` must appear in
 * order within `text`, but need not be consecutive. Scoring rewards:
 *   - Consecutive character matches
 *   - Matches at the start of a word (after `/`, `.`, `-`, `_`)
 *   - Exact prefix matches
 *
 * Returns `null` if the pattern does not match.
 */
function fuzzyMatch(text: string, pattern: string): { indices: number[]; score: number } | null {
  const textLower = text.toLowerCase()
  const patternLower = pattern.toLowerCase()

  if (patternLower.length === 0) return { indices: [], score: 0 }
  if (patternLower.length > textLower.length) return null

  const indices: number[] = []
  let score = 0
  let patternIdx = 0
  let prevMatchIdx = -2 // -2 so the first match is never "consecutive"

  for (let i = 0; i < textLower.length && patternIdx < patternLower.length; i++) {
    if (textLower[i] === patternLower[patternIdx]) {
      indices.push(i)

      // Consecutive match bonus
      if (i === prevMatchIdx + 1) {
        score += 5
      }

      // Start-of-word bonus
      if (i === 0 || /[/.\-_]/.test(text[i - 1])) {
        score += 10
      }

      // Exact case match bonus
      if (text[i] === pattern[patternIdx]) {
        score += 1
      }

      prevMatchIdx = i
      patternIdx++
    }
  }

  // All pattern characters must be matched
  if (patternIdx !== patternLower.length) return null

  // Prefix bonus: pattern matches the beginning of text
  if (textLower.startsWith(patternLower)) {
    score += 20
  }

  // Shorter file names are slightly preferred
  score -= text.length * 0.1

  return { indices, score }
}

/**
 * Search the flat tree for files matching the query. Returns up to
 * `maxResults` items sorted by score (descending).
 */
function searchFiles(tree: FlatTreeNode[], query: string, maxResults: number): FuzzyMatch[] {
  if (!query.trim()) return []

  const matches: FuzzyMatch[] = []

  for (const node of tree) {
    // Only match files, not directories
    if (node.isDirectory) continue

    // Try matching against the file name first, then fall back to full path
    const nameResult = fuzzyMatch(node.name, query)
    const pathResult = fuzzyMatch(node.path, query)

    // Take the best match
    const result =
      nameResult && pathResult
        ? nameResult.score >= pathResult.score
          ? { ...nameResult, usedPath: false }
          : { indices: pathResult.indices, score: pathResult.score, usedPath: true }
        : nameResult
          ? { ...nameResult, usedPath: false }
          : pathResult
            ? { ...pathResult, usedPath: true }
            : null

    if (result) {
      matches.push({
        node,
        // When matched against path, we still highlight against the name for display
        matchIndices: result.usedPath ? [] : result.indices,
        score: result.score,
      })
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score)

  return matches.slice(0, maxResults)
}

/**
 * Build a "recent files" result list from the tree nodes and the
 * recently-opened file paths.
 */
function getRecentResults(
  tree: FlatTreeNode[],
  rootPath: string,
  maxResults: number,
): FuzzyMatch[] {
  const recents = getRecentFiles(rootPath)
  const nodeMap = new Map<string, FlatTreeNode>()
  for (const node of tree) {
    if (!node.isDirectory) {
      nodeMap.set(node.path, node)
    }
  }

  const results: FuzzyMatch[] = []
  for (const path of recents) {
    const node = nodeMap.get(path)
    if (node) {
      results.push({ node, matchIndices: [], score: 0 })
    }
    if (results.length >= maxResults) break
  }

  return results
}

// ---------------------------------------------------------------------------
// File Icons (inline SVGs by extension)
// ---------------------------------------------------------------------------

type IconColor = string

function getFileIconProps(name: string): { paths: string; color: IconColor } {
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : ''

  switch (ext) {
    case 'ts':
    case 'tsx':
      return {
        paths: 'M3 3h18v18H3V3zm4 6v2h3v7h2v-7h3V9H7z',
        color: '#3178c6',
      }
    case 'js':
    case 'jsx':
      return {
        paths:
          'M3 3h18v18H3V3zm7 14c0-1.1-.4-1.7-1.2-1.7-.5 0-.8.3-1 .6l-.8-.5c.3-.6 1-1.1 1.9-1.1 1.3 0 2.1.8 2.1 2.2V19H10v-2zm4.5-2.7c-.6 0-1 .2-1 .7 0 .4.3.6 1.1.8 1.3.4 2 .8 2 2 0 1.3-1 2.2-2.5 2.2-1.2 0-2.1-.5-2.6-1.3l.8-.5c.4.6 1 1 1.8 1 .8 0 1.3-.4 1.3-.9 0-.5-.3-.7-1.2-1-1.3-.4-1.9-.9-1.9-1.9 0-1.1.9-1.8 2.2-1.8 1 0 1.7.4 2.1 1.1l-.8.5c-.3-.5-.7-.7-1.3-.7z',
        color: '#f0db4f',
      }
    case 'css':
    case 'scss':
    case 'less':
      return {
        paths:
          'M3 3h18v18H3V3zm6.5 13.5c1 0 1.8-.3 2.3-.8l-.6-.8c-.4.3-.9.5-1.6.5-1.2 0-2-.9-2-2.2s.8-2.2 2-2.2c.6 0 1.1.2 1.5.5l.6-.8c-.5-.5-1.3-.8-2.2-.8-1.8 0-3.1 1.3-3.1 3.3s1.3 3.3 3.1 3.3z',
        color: '#1572b6',
      }
    case 'json':
      return {
        paths:
          'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm3 8c0-1.1.5-1.6 1.3-1.6.3 0 .5.1.7.2l.3-.8c-.3-.2-.6-.3-1-.3C7.7 8.5 7 9.4 7 11s.7 2.5 1.3 2.5c.4 0 .7-.1 1-.3l-.3-.8c-.2.1-.4.2-.7.2C7.5 12.6 8 12.1 8 11z',
        color: '#a8b1c1',
      }
    case 'md':
    case 'mdx':
      return {
        paths: 'M3 3h18v18H3V3zm3 12V9h2l2 3 2-3h2v6h-2v-3.5L9.5 14 8 11.5V15H6z',
        color: '#519aba',
      }
    default:
      return {
        paths:
          'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v6h6v10H6z',
        color: '#a8b1c1',
      }
  }
}

// ---------------------------------------------------------------------------
// Search Icon (inline SVG)
// ---------------------------------------------------------------------------

function SearchIcon({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESULTS = 50
const MAX_VISIBLE = 12
const DEBOUNCE_MS = 100

// ---------------------------------------------------------------------------
// Internal Context
// ---------------------------------------------------------------------------

interface CommandPaletteContextValue {
  query: string
  setQuery: (q: string) => void
  debouncedQuery: string
  results: FuzzyMatch[]
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  handleSelectFile: (path: string) => void
  handleItemMouseEnter: (index: number) => void
  onClose: () => void
  theme: ResolvedEditorTheme
  showRecentLabel: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  resultsContainerRef: React.RefObject<HTMLDivElement | null>
  isAnimating: boolean
  handleKeyDown: (e: React.KeyboardEvent) => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

function useCommandPaletteContext(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) {
    throw new Error(
      'CommandPalette compound components must be rendered inside <CommandPalette.Root>.',
    )
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Sub-component Prop Types
// ---------------------------------------------------------------------------

export interface CommandPaletteRootProps {
  onClose: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export interface CommandPaletteOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  style?: React.CSSProperties
}

export interface CommandPaletteContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  style?: React.CSSProperties
}

export interface CommandPaletteInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> {
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export interface CommandPaletteResultsProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  maxHeight?: number
  children?: (match: FuzzyMatch, index: number) => ReactNode
  className?: string
  style?: React.CSSProperties
}

export interface CommandPaletteResultItemProps extends React.HTMLAttributes<HTMLDivElement> {
  match: FuzzyMatch
  index: number
  className?: string
  style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Result Item (memoized for performance)
// ---------------------------------------------------------------------------

interface InternalResultItemProps {
  match: FuzzyMatch
  isSelected: boolean
  theme: ResolvedEditorTheme
  onClick: (path: string) => void
  onMouseEnter: (index: number) => void
  index: number
}

const ResultItem = memo(function ResultItem({
  match,
  isSelected,
  theme,
  onClick,
  onMouseEnter,
  index,
}: InternalResultItemProps) {
  const { node, matchIndices } = match
  const icon = getFileIconProps(node.name)

  // Extract the directory portion of the path for display
  const lastSlash = node.path.lastIndexOf('/')
  const dirPath = lastSlash > 0 ? node.path.substring(0, lastSlash) : ''

  const handleClick = useCallback(() => onClick(node.path), [onClick, node.path])
  const handleMouseEnter = useCallback(() => onMouseEnter(index), [onMouseEnter, index])

  // Render the file name with highlighted match characters
  const highlightedName = useMemo(() => {
    if (matchIndices.length === 0) {
      return <span>{node.name}</span>
    }

    const matchSet = new Set(matchIndices)
    const parts: React.ReactNode[] = []
    let i = 0

    while (i < node.name.length) {
      if (matchSet.has(i)) {
        // Collect consecutive highlighted characters
        const start = i
        while (i < node.name.length && matchSet.has(i)) {
          i++
        }
        parts.push(
          <span key={`h-${start}`} style={{ color: theme.colors.accent, fontWeight: 600 }}>
            {node.name.substring(start, i)}
          </span>,
        )
      } else {
        // Collect consecutive non-highlighted characters
        const start = i
        while (i < node.name.length && !matchSet.has(i)) {
          i++
        }
        parts.push(<span key={`n-${start}`}>{node.name.substring(start, i)}</span>)
      }
    }

    return <>{parts}</>
  }, [node.name, matchIndices, theme.colors.accent])

  return (
    <div
      role="option"
      aria-selected={isSelected}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        cursor: 'pointer',
        backgroundColor: isSelected ? theme.colors.treeSelected : 'transparent',
        borderRadius: `${theme.borderRadius}px`,
        margin: '0 4px',
        transition: 'background-color 0.1s ease',
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {/* File icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill={icon.color} style={{ flexShrink: 0 }}>
        <path d={icon.paths} />
      </svg>

      {/* File name + path */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.fonts.uiSize}px`,
            color: theme.colors.foreground,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {highlightedName}
        </span>
        {dirPath && (
          <span
            style={{
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.fonts.uiSize - 1}px`,
              color: theme.colors.editorGutter,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {dirPath}
          </span>
        )}
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CommandPaletteRoot({
  onClose,
  inputRef,
  children,
  className,
  style,
  ...rest
}: CommandPaletteRootProps) {
  const { theme, rootPath } = useEditorContext()
  const tree = useEditorStore((s) => s.tree)
  const openFile = useEditorStore((s) => s.openFile)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(true)

  const resultsContainerRef = useRef<HTMLDivElement | null>(null)

  // Trigger open animation
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsAnimating(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [inputRef])

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  // Compute results
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return getRecentResults(tree, rootPath, MAX_RESULTS)
    }
    return searchFiles(tree, debouncedQuery, MAX_RESULTS)
  }, [tree, rootPath, debouncedQuery])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsContainerRef.current
    if (!container) return

    const items = container.querySelectorAll('[role="option"]')
    const selectedItem = items[selectedIndex] as HTMLElement | undefined
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Handle opening a file
  const handleSelectFile = useCallback(
    (path: string) => {
      recordRecentFile(rootPath, path)
      openFile(path)
      onClose()
    },
    [rootPath, openFile, onClose],
  )

  const handleItemMouseEnter = useCallback((index: number) => {
    setSelectedIndex(index)
  }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break
        case 'Enter':
          e.preventDefault()
          if (results[selectedIndex]) {
            handleSelectFile(results[selectedIndex].node.path)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [results, selectedIndex, handleSelectFile, onClose],
  )

  const showRecentLabel = !debouncedQuery.trim() && results.length > 0

  const contextValue = useMemo<CommandPaletteContextValue>(
    () => ({
      query,
      setQuery,
      debouncedQuery,
      results,
      selectedIndex,
      setSelectedIndex,
      handleSelectFile,
      handleItemMouseEnter,
      onClose,
      theme,
      showRecentLabel,
      inputRef,
      resultsContainerRef,
      isAnimating,
      handleKeyDown,
    }),
    [
      query,
      debouncedQuery,
      results,
      selectedIndex,
      handleSelectFile,
      handleItemMouseEnter,
      onClose,
      theme,
      showRecentLabel,
      inputRef,
      isAnimating,
      handleKeyDown,
    ],
  )

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      <div className={className} style={style} {...rest}>
        {children}
      </div>
    </CommandPaletteContext.Provider>
  )
}

function CommandPaletteOverlay({ className, style, ...rest }: CommandPaletteOverlayProps) {
  const { onClose, isAnimating, handleKeyDown } = useCommandPaletteContext()

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose],
  )

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '20vh',
        zIndex: 9999,
        opacity: isAnimating ? 0 : 1,
        transition: 'opacity 0.15s ease',
        ...style,
      }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  )
}

function CommandPaletteContainer({
  className,
  style,
  children,
  ...rest
}: CommandPaletteContainerProps & { children?: ReactNode }) {
  const { theme, isAnimating } = useCommandPaletteContext()

  return (
    <div
      role="combobox"
      aria-expanded="true"
      aria-haspopup="listbox"
      className={className}
      style={{
        width: '100%',
        maxWidth: '500px',
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: `${theme.borderRadius + 2}px`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        transform: isAnimating ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        opacity: isAnimating ? 0 : 1,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

function CommandPaletteInput({
  placeholder = 'Search files by name...',
  className,
  style,
  ...rest
}: CommandPaletteInputProps) {
  const { query, setQuery, theme, inputRef } = useCommandPaletteContext()

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderBottom: `1px solid ${theme.colors.border}`,
        ...style,
      }}
    >
      <SearchIcon color={theme.colors.editorGutter} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="Search files"
        autoComplete="off"
        spellCheck={false}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.fonts.uiSize}px`,
          color: theme.colors.foreground,
          caretColor: theme.colors.accent,
        }}
        {...rest}
      />
    </div>
  )
}

function CommandPaletteResults({
  maxHeight,
  children,
  className,
  style,
  ...rest
}: CommandPaletteResultsProps) {
  const {
    results,
    selectedIndex,
    theme,
    handleSelectFile,
    handleItemMouseEnter,
    showRecentLabel,
    debouncedQuery,
    resultsContainerRef,
  } = useCommandPaletteContext()

  const itemHeight = 32
  const computedMaxHeight = maxHeight ?? MAX_VISIBLE * itemHeight

  return (
    <>
      {/* Recent files label */}
      {showRecentLabel && (
        <div
          style={{
            padding: '6px 16px 2px',
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.fonts.uiSize - 2}px`,
            color: theme.colors.editorGutter,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Recent files
        </div>
      )}

      {/* Results list */}
      <div
        ref={resultsContainerRef}
        role="listbox"
        className={className}
        style={{
          maxHeight: `${computedMaxHeight}px`,
          overflowY: 'auto',
          padding: '4px 0',
          ...style,
        }}
        {...rest}
      >
        {results.length > 0 ? (
          results.map((match, i) =>
            children ? (
              children(match, i)
            ) : (
              <CommandPaletteResultItem key={match.node.path} match={match} index={i} />
            ),
          )
        ) : debouncedQuery.trim() ? (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.fonts.uiSize}px`,
              color: theme.colors.editorGutter,
            }}
          >
            No files found
          </div>
        ) : null}
      </div>
    </>
  )
}

function CommandPaletteResultItem({
  match,
  index,
  className,
  style,
  ...rest
}: CommandPaletteResultItemProps) {
  const { selectedIndex, theme, handleSelectFile, handleItemMouseEnter } =
    useCommandPaletteContext()

  return (
    <div className={className} style={style} {...rest}>
      <ResultItem
        match={match}
        isSelected={index === selectedIndex}
        theme={theme}
        onClick={handleSelectFile}
        onMouseEnter={handleItemMouseEnter}
        index={index}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Default component (retrocompatible)
// ---------------------------------------------------------------------------

/**
 * Command palette overlay for quick file navigation.
 *
 * Renders as a centered modal with a search input and fuzzy-matched file
 * results. Supports keyboard navigation (Arrow Up/Down, Enter, Escape)
 * and mouse interaction.
 *
 * This component should only be mounted when the palette is open (lazy
 * mounting). The `useCommandPalette` hook manages the open/close state.
 *
 * @example
 * ```tsx
 * const palette = useCommandPalette();
 *
 * return (
 *   <>
 *     {palette.isOpen && (
 *       <CommandPalette onClose={palette.close} inputRef={palette.inputRef} />
 *     )}
 *   </>
 * );
 * ```
 */
function CommandPaletteSimple({ onClose, inputRef, className, style }: CommandPaletteProps) {
  return (
    <CommandPaletteRoot onClose={onClose} inputRef={inputRef}>
      <CommandPaletteOverlay className={className} style={style}>
        <CommandPaletteContainer>
          <CommandPaletteInput />
          <CommandPaletteResults />
        </CommandPaletteContainer>
      </CommandPaletteOverlay>
    </CommandPaletteRoot>
  )
}

// ---------------------------------------------------------------------------
// Export with namespace
// ---------------------------------------------------------------------------

export const CommandPalette = Object.assign(CommandPaletteSimple, {
  Root: CommandPaletteRoot,
  Overlay: CommandPaletteOverlay,
  Container: CommandPaletteContainer,
  Input: CommandPaletteInput,
  Results: CommandPaletteResults,
  ResultItem: CommandPaletteResultItem,
})
