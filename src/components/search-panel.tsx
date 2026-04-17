// ---------------------------------------------------------------------------
// codepane — Editor.SearchPanel (Compound Components)
// ---------------------------------------------------------------------------
// A VS Code-style find-in-files panel. Renders as a centered modal overlay
// with search input, options toggles (regex, case-sensitive), results grouped
// by file, and optional replace functionality.
//
// Compound component architecture:
//   SearchPanel.Root, .Overlay, .Container, .Input, .Toggles,
//   .ReplaceInput, .Stats, .Results, .FileGroup, .MatchRow
//
// Zero external dependencies — inline styles + CSS vars from the editor theme.
// ---------------------------------------------------------------------------

import React, {
  createContext,
  Fragment,
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
import type { ResolvedEditorTheme, SearchMatch, SearchResult } from '../core/types'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SearchPanelContextValue {
  query: string
  setQuery: (q: string) => void
  replaceText: string
  setReplaceText: (t: string) => void
  isRegex: boolean
  setIsRegex: (v: boolean) => void
  caseSensitive: boolean
  setCaseSensitive: (v: boolean) => void
  replaceVisible: boolean
  setReplaceVisible: (v: boolean) => void
  results: SearchResult[] | null
  isLoading: boolean
  totalMatches: number
  totalFiles: number
  onClose: () => void
  theme: ResolvedEditorTheme
  handleMatchClick: (path: string, line: number) => void
  handleReplaceAll: () => void
  isAnimating: boolean
}

const SearchPanelContext = createContext<SearchPanelContextValue | null>(null)

function useSearchPanelContext(): SearchPanelContextValue {
  const ctx = useContext(SearchPanelContext)
  if (!ctx) {
    throw new Error('SearchPanel compound components must be rendered inside <SearchPanel.Root>')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Legacy props (retrocompatible)
// ---------------------------------------------------------------------------

export interface SearchPanelProps {
  /** Callback invoked when the panel should close. */
  onClose: () => void
  /** Whether to show the replace input. Default: false */
  showReplace?: boolean
  /** CSS class applied to the backdrop. */
  className?: string
  /** Inline styles merged with the backdrop's default styles. */
  style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Icons (inline SVG)
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
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function RegexIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill={active ? color : 'currentColor'}
      opacity={active ? 1 : 0.4}
    >
      <path d="M10.012 2h1.976v3.373l2.922-1.686 1.012 1.686-2.922 1.686 2.922 1.686-1.012 1.686-2.922-1.686V12h-1.976V8.627L7.09 10.313 6.078 8.627 9 6.941 6.078 5.255l1.012-1.686L10.012 5.255V2zM2 10h4v2H2v-2z" />
    </svg>
  )
}

function CaseIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill={active ? color : 'currentColor'}
      opacity={active ? 1 : 0.4}
    >
      <path d="M8.854 11.702h-1.058l-.768-2.212H3.772l-.725 2.212H2L5.158 3h1.03l3.666 8.702zM6.702 8.63l-1.26-3.645h-.044l-1.26 3.645h2.564zM13.339 11.702h-.985v-.726h-.044c-.31.554-.903.862-1.592.862-1.17 0-1.97-.834-1.97-2.144V6.71h1.03v2.79c0 .858.437 1.39 1.17 1.39.762 0 1.361-.594 1.361-1.478V6.71h1.03v4.992z" />
    </svg>
  )
}

function CloseIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={color}>
      <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z" />
    </svg>
  )
}

function ReplaceIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={color}>
      <path d="M11.5 1a.5.5 0 010 1H4.707l2.147 2.146a.5.5 0 01-.708.708l-3-3a.5.5 0 010-.708l3-3a.5.5 0 01.708.708L4.707 1H11.5zM4.5 15a.5.5 0 010-1h6.793l-2.147-2.146a.5.5 0 01.708-.708l3 3a.5.5 0 010 .708l-3 3a.5.5 0 01-.708-.708L11.293 15H4.5z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 200

function useToggleBtnStyle(theme: ResolvedEditorTheme) {
  return useCallback(
    (active: boolean): React.CSSProperties => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 26,
      height: 26,
      border: `1px solid ${active ? theme.colors.accent : theme.colors.border}`,
      borderRadius: theme.borderRadius - 2,
      background: active ? `${theme.colors.accent}20` : 'transparent',
      cursor: 'pointer',
      color: theme.colors.foreground,
      flexShrink: 0,
    }),
    [theme],
  )
}

// ---------------------------------------------------------------------------
// Sub-component prop types
// ---------------------------------------------------------------------------

export interface SearchPanelRootProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose: () => void
  showReplace?: boolean
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export interface SearchPanelOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  style?: React.CSSProperties
}

export interface SearchPanelContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  style?: React.CSSProperties
}

export interface SearchPanelInputProps extends React.HTMLAttributes<HTMLDivElement> {
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export interface SearchPanelTogglesProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  style?: React.CSSProperties
}

export interface SearchPanelReplaceInputProps extends React.HTMLAttributes<HTMLDivElement> {
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export interface SearchPanelStatsProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  style?: React.CSSProperties
}

export interface SearchPanelResultsProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  children?: (result: SearchResult) => ReactNode
  className?: string
  style?: React.CSSProperties
}

export interface SearchPanelFileGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  result: SearchResult
  className?: string
  style?: React.CSSProperties
}

export interface SearchPanelMatchRowProps extends React.HTMLAttributes<HTMLDivElement> {
  match: SearchMatch
  filePath: string
  className?: string
  style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// SearchPanelRoot — context provider + state management
// ---------------------------------------------------------------------------

function SearchPanelRoot({
  onClose,
  showReplace = false,
  children,
  className,
  style,
  ...rest
}: SearchPanelRootProps) {
  const { theme } = useEditorContext()
  const searchAction = useEditorStore((s) => s.search)
  const clearSearch = useEditorStore((s) => s.clearSearch)
  const searchResults = useEditorStore((s) => s.searchResults)
  const searchLoading = useEditorStore((s) => s.searchLoading)
  const openFile = useEditorStore((s) => s.openFile)
  const replaceAllAction = useEditorStore((s) => s.replaceAll)

  const [query, setQuery] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [replaceVisible, setReplaceVisible] = useState(showReplace)
  const [isAnimating, setIsAnimating] = useState(true)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Animate in
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsAnimating(false))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      clearSearch()
      return
    }

    debounceRef.current = setTimeout(() => {
      searchAction(query, 'content')
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, isRegex, caseSensitive, searchAction, clearSearch])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleMatchClick = useCallback(
    (path: string, _line: number) => {
      openFile(path)
    },
    [openFile],
  )

  const handleReplaceAll = useCallback(() => {
    if (replaceText !== undefined) {
      replaceAllAction(replaceText)
    }
  }, [replaceAllAction, replaceText])

  const totalMatches = useMemo(() => {
    if (!searchResults) return 0
    return searchResults.reduce((sum, r) => sum + r.matches.length, 0)
  }, [searchResults])

  const totalFiles = searchResults?.length ?? 0

  const contextValue = useMemo<SearchPanelContextValue>(
    () => ({
      query,
      setQuery,
      replaceText,
      setReplaceText,
      isRegex,
      setIsRegex,
      caseSensitive,
      setCaseSensitive,
      replaceVisible,
      setReplaceVisible,
      results: searchResults,
      isLoading: searchLoading,
      totalMatches,
      totalFiles,
      onClose,
      theme,
      handleMatchClick,
      handleReplaceAll,
      isAnimating,
    }),
    [
      query,
      replaceText,
      isRegex,
      caseSensitive,
      replaceVisible,
      searchResults,
      searchLoading,
      totalMatches,
      totalFiles,
      onClose,
      theme,
      handleMatchClick,
      handleReplaceAll,
      isAnimating,
    ],
  )

  return (
    <SearchPanelContext.Provider value={contextValue}>
      <div className={className} style={style} {...rest}>
        {children}
      </div>
    </SearchPanelContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// SearchPanelOverlay — backdrop, click-to-close
// ---------------------------------------------------------------------------

function SearchPanelOverlay({ className, style, ...rest }: SearchPanelOverlayProps) {
  const { onClose, isAnimating } = useSearchPanelContext()

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        opacity: isAnimating ? 0 : 1,
        transition: 'opacity 0.15s ease',
        ...style,
      }}
      onClick={onClose}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// SearchPanelContainer — modal card
// ---------------------------------------------------------------------------

function SearchPanelContainer({ className, style, children, ...rest }: SearchPanelContainerProps) {
  const { theme, isAnimating } = useSearchPanelContext()

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '15vh',
        zIndex: 10000,
        pointerEvents: 'none',
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius + 2,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          transform: isAnimating ? 'scale(0.95)' : 'scale(1)',
          transition: 'transform 0.15s ease',
          pointerEvents: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchPanelInput — search input with icon, auto-focus
// ---------------------------------------------------------------------------

function SearchPanelInput({
  placeholder = 'Search in files...',
  className,
  style,
  ...rest
}: SearchPanelInputProps) {
  const { query, setQuery, theme } = useSearchPanelContext()
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        ...style,
      }}
      {...rest}
    >
      <SearchIcon color={theme.colors.editorGutter} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: theme.fonts.ui,
          fontSize: theme.fonts.uiSize,
          color: theme.colors.foreground,
          caretColor: theme.colors.accent,
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchPanelToggles — regex, case-sensitive, replace toggle, close
// ---------------------------------------------------------------------------

function SearchPanelToggles({ className, style, ...rest }: SearchPanelTogglesProps) {
  const {
    isRegex,
    setIsRegex,
    caseSensitive,
    setCaseSensitive,
    replaceVisible,
    setReplaceVisible,
    onClose,
    theme,
  } = useSearchPanelContext()
  const toggleBtnStyle = useToggleBtnStyle(theme)

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        ...style,
      }}
      {...rest}
    >
      <button
        onClick={() => setIsRegex(!isRegex)}
        style={toggleBtnStyle(isRegex)}
        title="Use regex"
      >
        <RegexIcon active={isRegex} color={theme.colors.accent} />
      </button>
      <button
        onClick={() => setCaseSensitive(!caseSensitive)}
        style={toggleBtnStyle(caseSensitive)}
        title="Case sensitive"
      >
        <CaseIcon active={caseSensitive} color={theme.colors.accent} />
      </button>
      <button
        onClick={() => setReplaceVisible(!replaceVisible)}
        style={toggleBtnStyle(replaceVisible)}
        title="Toggle replace"
      >
        <ReplaceIcon color={theme.colors.foreground} />
      </button>
      <button onClick={onClose} style={{ ...toggleBtnStyle(false), border: 'none' }} title="Close">
        <CloseIcon color={theme.colors.foreground} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchPanelReplaceInput — replace text + Replace All button
// ---------------------------------------------------------------------------

function SearchPanelReplaceInput({
  placeholder = 'Replace with...',
  className,
  style,
  ...rest
}: SearchPanelReplaceInputProps) {
  const { replaceVisible, replaceText, setReplaceText, query, results, handleReplaceAll, theme } =
    useSearchPanelContext()

  if (!replaceVisible) return null

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        ...style,
      }}
      {...rest}
    >
      <div style={{ width: 16 }} />
      <input
        type="text"
        value={replaceText}
        onChange={(e) => setReplaceText(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        style={{
          flex: 1,
          background: 'transparent',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius - 2,
          padding: '4px 8px',
          outline: 'none',
          fontFamily: theme.fonts.ui,
          fontSize: theme.fonts.uiSize,
          color: theme.colors.foreground,
          caretColor: theme.colors.accent,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = theme.colors.accent)}
        onBlur={(e) => (e.currentTarget.style.borderColor = theme.colors.border)}
      />
      <button
        onClick={handleReplaceAll}
        disabled={!query.trim() || !results?.length}
        style={{
          padding: '4px 10px',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius - 2,
          background: theme.colors.accent,
          color: '#1e1e2e',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: theme.fonts.ui,
          cursor: 'pointer',
          opacity: !query.trim() || !results?.length ? 0.4 : 1,
          flexShrink: 0,
        }}
      >
        Replace All
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchPanelStats — "X results in Y files" or "Searching..."
// ---------------------------------------------------------------------------

function SearchPanelStats({ className, style, ...rest }: SearchPanelStatsProps) {
  const { query, isLoading, totalMatches, totalFiles, theme } = useSearchPanelContext()

  if (!query.trim()) return null

  return (
    <div
      className={className}
      style={{
        padding: '4px 12px',
        fontSize: 11,
        fontFamily: theme.fonts.ui,
        color: theme.colors.editorGutter,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
      {...rest}
    >
      {isLoading ? (
        <span>Searching...</span>
      ) : (
        <span>
          {totalMatches} result{totalMatches !== 1 ? 's' : ''} in {totalFiles} file
          {totalFiles !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchPanelMatchRow — single match line with highlighted text
// ---------------------------------------------------------------------------

const SearchPanelMatchRow = memo(function SearchPanelMatchRow({
  match,
  filePath,
  className,
  style,
  ...rest
}: SearchPanelMatchRowProps) {
  const { theme, handleMatchClick } = useSearchPanelContext()
  const handleClick = useCallback(
    () => handleMatchClick(filePath, match.line),
    [handleMatchClick, filePath, match.line],
  )

  // Highlight the matched text within the line
  const before = match.lineContent.substring(0, match.column)
  const matched = match.lineContent.substring(match.column, match.column + match.length)
  const after = match.lineContent.substring(match.column + match.length)

  return (
    <div
      className={className}
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '3px 12px 3px 32px',
        cursor: 'pointer',
        fontSize: theme.fonts.monoSize - 1,
        fontFamily: theme.fonts.mono,
        whiteSpace: 'pre',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = theme.colors.treeHover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      {...rest}
    >
      <span
        style={{
          color: theme.colors.editorGutter,
          minWidth: 28,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {match.line}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span style={{ opacity: 0.7 }}>{before}</span>
        <span
          style={{
            color: theme.colors.accent,
            fontWeight: 600,
            background: theme.colors.searchMatch,
          }}
        >
          {matched}
        </span>
        <span style={{ opacity: 0.7 }}>{after}</span>
      </span>
    </div>
  )
})

// ---------------------------------------------------------------------------
// SearchPanelFileGroup — collapsible file group with match count badge
// ---------------------------------------------------------------------------

const SearchPanelFileGroup = memo(function SearchPanelFileGroup({
  result,
  className,
  style,
  ...rest
}: SearchPanelFileGroupProps) {
  const { theme } = useSearchPanelContext()
  const [collapsed, setCollapsed] = useState(false)
  const fileName = result.path.split('/').pop() ?? result.path
  const dirPath = result.path.includes('/')
    ? result.path.substring(0, result.path.lastIndexOf('/'))
    : ''

  return (
    <div className={className} style={style} {...rest}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          cursor: 'pointer',
          fontFamily: theme.fonts.ui,
          fontSize: theme.fonts.uiSize,
          fontWeight: 500,
          userSelect: 'none',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = theme.colors.treeHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)',
            transition: 'transform 150ms',
            flexShrink: 0,
          }}
        >
          <path d="M2 3l3 3.5L8 3z" />
        </svg>
        <span>{fileName}</span>
        {dirPath && (
          <span style={{ opacity: 0.4, fontSize: theme.fonts.uiSize - 2 }}>{dirPath}</span>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 600,
            color: theme.colors.accent,
            background: `${theme.colors.accent}20`,
            borderRadius: 8,
            padding: '1px 6px',
            flexShrink: 0,
          }}
        >
          {result.matches.length}
        </span>
      </div>
      {!collapsed &&
        result.matches.map((match, i) => (
          <SearchPanelMatchRow
            key={`${match.line}-${match.column}-${i}`}
            match={match}
            filePath={result.path}
          />
        ))}
    </div>
  )
})

// ---------------------------------------------------------------------------
// SearchPanelResults — scrollable results list
// ---------------------------------------------------------------------------

function SearchPanelResults({ children, className, style, ...rest }: SearchPanelResultsProps) {
  const { results, query, isLoading, theme } = useSearchPanelContext()

  return (
    <div
      className={className}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 0',
        ...style,
      }}
      {...rest}
    >
      {results && results.length > 0 ? (
        results.map((result) =>
          children ? (
            <Fragment key={result.path}>{children(result)}</Fragment>
          ) : (
            <SearchPanelFileGroup key={result.path} result={result} />
          ),
        )
      ) : query.trim() && !isLoading ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            fontFamily: theme.fonts.ui,
            fontSize: theme.fonts.uiSize,
            color: theme.colors.editorGutter,
          }}
        >
          No results found
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Default retrocompatible component
// ---------------------------------------------------------------------------

function SearchPanelSimple({ onClose, showReplace, className, style }: SearchPanelProps) {
  return (
    <SearchPanelRoot onClose={onClose} showReplace={showReplace}>
      <SearchPanelOverlay />
      <SearchPanelContainer className={className} style={style}>
        <SearchPanelInputSection />
        <SearchPanelStats />
        <SearchPanelResults />
      </SearchPanelContainer>
    </SearchPanelRoot>
  )
}

/**
 * Internal component that composes Input + Toggles + ReplaceInput in the
 * top section with the border-bottom, matching the original layout exactly.
 */
function SearchPanelInputSection() {
  const { theme } = useSearchPanelContext()
  return (
    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${theme.colors.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SearchPanelInput style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }} />
        <SearchPanelToggles />
      </div>
      <SearchPanelReplaceInput />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Final export with namespace
// ---------------------------------------------------------------------------

export const SearchPanel = Object.assign(SearchPanelSimple, {
  Root: SearchPanelRoot,
  Overlay: SearchPanelOverlay,
  Container: SearchPanelContainer,
  Input: SearchPanelInput,
  Toggles: SearchPanelToggles,
  ReplaceInput: SearchPanelReplaceInput,
  Stats: SearchPanelStats,
  Results: SearchPanelResults,
  FileGroup: SearchPanelFileGroup,
  MatchRow: SearchPanelMatchRow,
})
