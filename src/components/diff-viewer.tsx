// ---------------------------------------------------------------------------
// codepane — DiffViewer
// ---------------------------------------------------------------------------
// Side-by-side and unified diff viewer component. Fully self-contained with
// inline styles driven by the editor theme. No Tailwind, no external UI
// libraries, no external diff libraries.
//
// Features:
//   - Unified and split (side-by-side) display modes
//   - Collapsible unchanged sections
//   - Virtualized rendering for large diffs
//   - Synchronized scroll in split mode
//   - Inline theme-driven styling
// ---------------------------------------------------------------------------

import React, { useMemo, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useEditorContext } from '../core/context';
import type { ResolvedEditorTheme } from '../core/types';
import { computeDiff } from '../utils/diff';
import type { DiffLine, DiffResult } from '../utils/diff';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiffViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Original/old content. */
  oldContent: string;
  /** Modified/new content. */
  newContent: string;
  /** Display mode. Default: `'unified'`. */
  mode?: 'unified' | 'split';
  /** Optional file path displayed in the header. */
  filePath?: string;
  /** Optional old file path (for renames). */
  oldFilePath?: string;
  /** Show line numbers. Default: `true`. */
  lineNumbers?: boolean;
  /** Number of context lines around changes. Default: `3`. */
  contextLines?: number;
  /** Collapse unchanged sections longer than 2*contextLines. Default: `true`. */
  collapseUnchanged?: boolean;
  /** CSS class applied to the outermost container. */
  className?: string;
  /** Inline styles merged with the root element's default styles. */
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 20;
const BUFFER_ROWS = 10;
const COLLAPSE_THRESHOLD = 6; // collapse when unchanged run > this

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/**
 * Blend a semantic diff color with the editor background at a given alpha.
 * This ensures diff highlights look correct on any theme background.
 */
function blendWithBackground(
  r: number,
  g: number,
  b: number,
  alpha: number,
  theme: ResolvedEditorTheme
): string {
  // Parse the editor background to blend against it.
  const bg = theme.colors.editorBackground;
  const bgMatch = bg.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (bgMatch) {
    const bgR = parseInt(bgMatch[1], 16);
    const bgG = parseInt(bgMatch[2], 16);
    const bgB = parseInt(bgMatch[3], 16);
    const blendR = Math.round(r * alpha + bgR * (1 - alpha));
    const blendG = Math.round(g * alpha + bgG * (1 - alpha));
    const blendB = Math.round(b * alpha + bgB * (1 - alpha));
    return `rgb(${blendR}, ${blendG}, ${blendB})`;
  }
  // Fallback: use rgba over whatever background is set.
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function addedBg(theme: ResolvedEditorTheme): string {
  return blendWithBackground(34, 197, 94, 0.1, theme);
}

function removedBg(theme: ResolvedEditorTheme): string {
  return blendWithBackground(239, 68, 68, 0.1, theme);
}

function addedGutterBg(theme: ResolvedEditorTheme): string {
  return blendWithBackground(34, 197, 94, 0.18, theme);
}

function removedGutterBg(theme: ResolvedEditorTheme): string {
  return blendWithBackground(239, 68, 68, 0.18, theme);
}

// ---------------------------------------------------------------------------
// Display row types — produced by collapsing unchanged sections
// ---------------------------------------------------------------------------

interface ContentRow {
  kind: 'content';
  line: DiffLine;
  /** Index into the original DiffResult.lines array. */
  index: number;
}

interface CollapseRow {
  kind: 'collapse';
  /** Number of hidden unchanged lines. */
  count: number;
  /** Start index (inclusive) in DiffResult.lines. */
  startIndex: number;
  /** End index (exclusive). */
  endIndex: number;
  /** The key used to track expanded state (matches the outer run range). */
  sectionKey: string;
}

type DisplayRow = ContentRow | CollapseRow;

// ---------------------------------------------------------------------------
// Split-mode row: pairs old (left) and new (right) lines
// ---------------------------------------------------------------------------

interface SplitPair {
  kind: 'content';
  left: DiffLine | null;
  right: DiffLine | null;
  index: number;
}

interface SplitCollapseRow {
  kind: 'collapse';
  count: number;
  startIndex: number;
  endIndex: number;
  /** The key used to track expanded state (matches the outer run range). */
  sectionKey: string;
}

type SplitRow = SplitPair | SplitCollapseRow;

// ---------------------------------------------------------------------------
// Collapse logic — unified
// ---------------------------------------------------------------------------

function buildUnifiedRows(
  diff: DiffResult,
  contextLines: number,
  collapse: boolean,
  expandedSections: Set<string>
): DisplayRow[] {
  if (!collapse) {
    return diff.lines.map((line, index) => ({ kind: 'content', line, index }));
  }

  const rows: DisplayRow[] = [];
  const lines = diff.lines;
  const threshold = Math.max(COLLAPSE_THRESHOLD, contextLines * 2 + 1);

  let i = 0;
  while (i < lines.length) {
    if (lines[i].type !== 'unchanged') {
      rows.push({ kind: 'content', line: lines[i], index: i });
      i++;
      continue;
    }

    // Scan the run of unchanged lines.
    const runStart = i;
    while (i < lines.length && lines[i].type === 'unchanged') {
      i++;
    }
    const runEnd = i;
    const runLength = runEnd - runStart;

    const sectionKey = `${runStart}-${runEnd}`;

    if (runLength <= threshold || expandedSections.has(sectionKey)) {
      // Show all unchanged lines.
      for (let k = runStart; k < runEnd; k++) {
        rows.push({ kind: 'content', line: lines[k], index: k });
      }
    } else {
      // Show contextLines at start, collapse middle, show contextLines at end.
      for (let k = runStart; k < runStart + contextLines; k++) {
        rows.push({ kind: 'content', line: lines[k], index: k });
      }
      const collapseStart = runStart + contextLines;
      const collapseEnd = runEnd - contextLines;
      rows.push({
        kind: 'collapse',
        count: collapseEnd - collapseStart,
        startIndex: collapseStart,
        endIndex: collapseEnd,
        sectionKey,
      });
      for (let k = runEnd - contextLines; k < runEnd; k++) {
        rows.push({ kind: 'content', line: lines[k], index: k });
      }
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Collapse logic — split
// ---------------------------------------------------------------------------

function buildSplitRows(
  diff: DiffResult,
  contextLines: number,
  collapse: boolean,
  expandedSections: Set<string>
): SplitRow[] {
  // First pair up lines for side-by-side display.
  const pairs: SplitPair[] = [];
  const lines = diff.lines;
  let pairIdx = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.type === 'unchanged') {
      pairs.push({ kind: 'content', left: line, right: line, index: pairIdx++ });
      i++;
    } else if (line.type === 'removed') {
      // Collect contiguous removed, then contiguous added, and pair them.
      const removed: DiffLine[] = [];
      while (i < lines.length && lines[i].type === 'removed') {
        removed.push(lines[i]);
        i++;
      }
      const added: DiffLine[] = [];
      while (i < lines.length && lines[i].type === 'added') {
        added.push(lines[i]);
        i++;
      }
      const maxLen = Math.max(removed.length, added.length);
      for (let k = 0; k < maxLen; k++) {
        pairs.push({
          kind: 'content',
          left: k < removed.length ? removed[k] : null,
          right: k < added.length ? added[k] : null,
          index: pairIdx++,
        });
      }
    } else {
      // Added without preceding removed.
      pairs.push({ kind: 'content', left: null, right: line, index: pairIdx++ });
      i++;
    }
  }

  if (!collapse) return pairs;

  // Now collapse long unchanged runs.
  const rows: SplitRow[] = [];
  const threshold = Math.max(COLLAPSE_THRESHOLD, contextLines * 2 + 1);
  let j = 0;

  while (j < pairs.length) {
    const p = pairs[j];
    if (p.kind !== 'content' || !p.left || !p.right || p.left.type !== 'unchanged') {
      rows.push(p);
      j++;
      continue;
    }

    const runStart = j;
    while (
      j < pairs.length &&
      pairs[j].kind === 'content' &&
      (pairs[j] as SplitPair).left?.type === 'unchanged' &&
      (pairs[j] as SplitPair).right?.type === 'unchanged'
    ) {
      j++;
    }
    const runEnd = j;
    const runLength = runEnd - runStart;
    const sectionKey = `s${runStart}-${runEnd}`;

    if (runLength <= threshold || expandedSections.has(sectionKey)) {
      for (let k = runStart; k < runEnd; k++) {
        rows.push(pairs[k]);
      }
    } else {
      for (let k = runStart; k < runStart + contextLines; k++) {
        rows.push(pairs[k]);
      }
      const cs = runStart + contextLines;
      const ce = runEnd - contextLines;
      rows.push({ kind: 'collapse', count: ce - cs, startIndex: cs, endIndex: ce, sectionKey });
      for (let k = runEnd - contextLines; k < runEnd; k++) {
        rows.push(pairs[k]);
      }
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// SVG icons (inline, no external deps)
// ---------------------------------------------------------------------------

function ChevronIcon({ direction }: { direction: 'down' | 'right' }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: direction === 'down' ? 'rotate(90deg)' : undefined,
        transition: 'transform 150ms ease',
      }}
    >
      <polyline points="4.5 2.5 8 6 4.5 9.5" />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <rect x="1" y="2" width="5" height="10" rx="1" />
      <rect x="8" y="2" width="5" height="10" rx="1" />
    </svg>
  );
}

function RowsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <rect x="1" y="2" width="12" height="10" rx="1" />
      <line x1="1" y1="7" x2="13" y2="7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Memoized row components
// ---------------------------------------------------------------------------

interface UnifiedRowProps {
  row: ContentRow;
  theme: ResolvedEditorTheme;
  showLineNumbers: boolean;
  lineNumWidth: number;
}

const UnifiedContentRow = React.memo<UnifiedRowProps>(function UnifiedContentRow({
  row,
  theme,
  showLineNumbers,
  lineNumWidth,
}) {
  const { line } = row;
  const isAdded = line.type === 'added';
  const isRemoved = line.type === 'removed';

  const bgColor = isAdded ? addedBg(theme) : isRemoved ? removedBg(theme) : undefined;

  const gutterBg = isAdded ? addedGutterBg(theme) : isRemoved ? removedGutterBg(theme) : undefined;

  const prefix = isAdded ? '+' : isRemoved ? '-' : ' ';

  return (
    <div
      style={{
        display: 'flex',
        height: ROW_HEIGHT,
        lineHeight: `${ROW_HEIGHT}px`,
        fontFamily: theme.fonts.mono,
        fontSize: theme.fonts.monoSize,
        background: bgColor,
        whiteSpace: 'pre',
        overflow: 'hidden',
      }}
    >
      {showLineNumbers && (
        <>
          <span
            style={{
              display: 'inline-block',
              width: lineNumWidth,
              minWidth: lineNumWidth,
              textAlign: 'right',
              paddingRight: 4,
              color: theme.colors.editorGutter,
              background: gutterBg,
              fontVariantNumeric: 'tabular-nums',
              userSelect: 'none',
              opacity: 0.7,
            }}
          >
            {line.oldLineNumber ?? ''}
          </span>
          <span
            style={{
              display: 'inline-block',
              width: lineNumWidth,
              minWidth: lineNumWidth,
              textAlign: 'right',
              paddingRight: 8,
              color: theme.colors.editorGutter,
              background: gutterBg,
              fontVariantNumeric: 'tabular-nums',
              userSelect: 'none',
              opacity: 0.7,
            }}
          >
            {line.newLineNumber ?? ''}
          </span>
        </>
      )}
      <span
        style={{
          display: 'inline-block',
          width: 16,
          minWidth: 16,
          textAlign: 'center',
          color: isAdded ? '#22c55e' : isRemoved ? '#ef4444' : theme.colors.editorGutter,
          userSelect: 'none',
          fontWeight: 600,
        }}
      >
        {prefix}
      </span>
      <span style={{ flex: 1, paddingRight: 8 }}>{line.content}</span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Split-mode row component
// ---------------------------------------------------------------------------

interface SplitContentRowProps {
  row: SplitPair;
  theme: ResolvedEditorTheme;
  showLineNumbers: boolean;
  lineNumWidth: number;
}

const SplitContentRow = React.memo<SplitContentRowProps>(function SplitContentRow({
  row,
  theme,
  showLineNumbers,
  lineNumWidth,
}) {
  const { left, right } = row;

  const renderSide = (line: DiffLine | null, side: 'left' | 'right') => {
    if (!line) {
      // Empty placeholder.
      return (
        <div
          style={{
            flex: 1,
            height: ROW_HEIGHT,
            background: `${theme.colors.border}22`,
          }}
        />
      );
    }

    const isAdded = line.type === 'added';
    const isRemoved = line.type === 'removed';
    const bgColor = isAdded ? addedBg(theme) : isRemoved ? removedBg(theme) : undefined;
    const gutterBg = isAdded
      ? addedGutterBg(theme)
      : isRemoved
        ? removedGutterBg(theme)
        : undefined;
    const lineNum = side === 'left' ? line.oldLineNumber : line.newLineNumber;

    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          height: ROW_HEIGHT,
          lineHeight: `${ROW_HEIGHT}px`,
          fontFamily: theme.fonts.mono,
          fontSize: theme.fonts.monoSize,
          background: bgColor,
          whiteSpace: 'pre',
          overflow: 'hidden',
        }}
      >
        {showLineNumbers && (
          <span
            style={{
              display: 'inline-block',
              width: lineNumWidth,
              minWidth: lineNumWidth,
              textAlign: 'right',
              paddingRight: 8,
              color: theme.colors.editorGutter,
              background: gutterBg,
              fontVariantNumeric: 'tabular-nums',
              userSelect: 'none',
              opacity: 0.7,
            }}
          >
            {lineNum ?? ''}
          </span>
        )}
        <span style={{ flex: 1, paddingRight: 8 }}>{line.content}</span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: ROW_HEIGHT }}>
      {renderSide(left, 'left')}
      <div
        style={{
          width: 1,
          background: theme.colors.border,
          flexShrink: 0,
        }}
      />
      {renderSide(right, 'right')}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Collapse expander row
// ---------------------------------------------------------------------------

interface CollapseExpanderProps {
  count: number;
  sectionKey: string;
  theme: ResolvedEditorTheme;
  onExpand: (key: string) => void;
}

const CollapseExpander = React.memo<CollapseExpanderProps>(function CollapseExpander({
  count,
  sectionKey,
  theme,
  onExpand,
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onExpand(sectionKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onExpand(sectionKey);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: ROW_HEIGHT,
        lineHeight: `${ROW_HEIGHT}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontFamily: theme.fonts.ui,
        fontSize: theme.fonts.uiSize - 1,
        color: theme.colors.accent,
        background: hovered ? `${theme.colors.accent}10` : `${theme.colors.border}15`,
        cursor: 'pointer',
        userSelect: 'none',
        borderTop: `1px solid ${theme.colors.border}40`,
        borderBottom: `1px solid ${theme.colors.border}40`,
      }}
    >
      <ChevronIcon direction="right" />
      Show {count} hidden lines
    </div>
  );
});

// ---------------------------------------------------------------------------
// Header component
// ---------------------------------------------------------------------------

interface DiffHeaderProps {
  filePath?: string;
  oldFilePath?: string;
  stats: DiffResult['stats'];
  mode: 'unified' | 'split';
  onToggleMode: () => void;
  allExpanded: boolean;
  onToggleCollapse: () => void;
  hasCollapsible: boolean;
  theme: ResolvedEditorTheme;
}

const DiffHeader = React.memo<DiffHeaderProps>(function DiffHeader({
  filePath,
  oldFilePath,
  stats,
  mode,
  onToggleMode,
  allExpanded,
  onToggleCollapse,
  hasCollapsible,
  theme,
}) {
  const isRename = oldFilePath && oldFilePath !== filePath;

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius,
    background: theme.colors.background,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.ui,
    fontSize: theme.fonts.uiSize - 1,
    cursor: 'pointer',
    lineHeight: '20px',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        background: `${theme.colors.background}`,
        borderBottom: `1px solid ${theme.colors.border}`,
        fontFamily: theme.fonts.ui,
        fontSize: theme.fonts.uiSize,
        color: theme.colors.foreground,
        flexWrap: 'wrap',
        minHeight: 34,
      }}
    >
      {/* File path */}
      <div
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: theme.fonts.monoSize,
          fontWeight: 500,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {isRename ? (
          <>
            <span style={{ opacity: 0.6 }}>{oldFilePath}</span>
            <span style={{ margin: '0 6px', opacity: 0.4 }}>{'\u2192'}</span>
            <span>{filePath}</span>
          </>
        ) : (
          (filePath ?? 'Diff')
        )}
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          fontSize: theme.fonts.uiSize - 1,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {stats.added > 0 && <span style={{ color: '#22c55e' }}>+{stats.added}</span>}
        {stats.removed > 0 && <span style={{ color: '#ef4444' }}>-{stats.removed}</span>}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {hasCollapsible && (
          <button
            type="button"
            onClick={onToggleCollapse}
            style={buttonStyle}
            title={allExpanded ? 'Collapse all' : 'Expand all'}
          >
            <ChevronIcon direction={allExpanded ? 'right' : 'down'} />
            {allExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleMode}
          style={buttonStyle}
          title={mode === 'unified' ? 'Switch to split view' : 'Switch to unified view'}
        >
          {mode === 'unified' ? <ColumnsIcon /> : <RowsIcon />}
          {mode === 'unified' ? 'Split' : 'Unified'}
        </button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// DiffViewer — main component
// ---------------------------------------------------------------------------

export const DiffViewer = React.memo<DiffViewerProps>(function DiffViewer({
  oldContent,
  newContent,
  mode: initialMode = 'unified',
  filePath,
  oldFilePath,
  lineNumbers = true,
  contextLines = 3,
  collapseUnchanged = true,
  className,
  style,
  ...rest
}) {
  const { theme } = useEditorContext();

  // ---- State ----
  const [mode, setMode] = useState(initialMode);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Diff computation ----
  const diff = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);

  // ---- Line number gutter width ----
  const lineNumWidth = useMemo(() => {
    const maxLine = Math.max(
      diff.stats.unchanged + diff.stats.removed,
      diff.stats.unchanged + diff.stats.added
    );
    const digits = Math.max(String(maxLine).length, 2);
    return digits * 8 + 8;
  }, [diff.stats]);

  // ---- Rows ----
  const unifiedRows = useMemo(
    () => buildUnifiedRows(diff, contextLines, collapseUnchanged, expandedSections),
    [diff, contextLines, collapseUnchanged, expandedSections]
  );

  const splitRows = useMemo(
    () => buildSplitRows(diff, contextLines, collapseUnchanged, expandedSections),
    [diff, contextLines, collapseUnchanged, expandedSections]
  );

  const activeRowCount = mode === 'unified' ? unifiedRows.length : splitRows.length;
  const totalHeight = activeRowCount * ROW_HEIGHT;

  const hasCollapsible = useMemo(() => {
    const rows = mode === 'unified' ? unifiedRows : splitRows;
    return rows.some((r) => r.kind === 'collapse');
  }, [mode, unifiedRows, splitRows]);

  // ---- Callbacks ----
  const handleExpand = useCallback((key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const handleToggleCollapse = useCallback(() => {
    if (allExpanded) {
      setExpandedSections(new Set());
      setAllExpanded(false);
    } else {
      // Expand everything by collecting all collapse section keys.
      const keys = new Set<string>();
      const activeRows = mode === 'unified' ? unifiedRows : splitRows;
      for (const r of activeRows) {
        if (r.kind === 'collapse') {
          keys.add(r.sectionKey);
        }
      }
      // Merge with existing.
      setExpandedSections((prev) => {
        const next = new Set(prev);
        for (const k of keys) next.add(k);
        return next;
      });
      setAllExpanded(true);
    }
  }, [allExpanded, unifiedRows, splitRows, mode]);

  const handleToggleMode = useCallback(() => {
    setMode((prev) => (prev === 'unified' ? 'split' : 'unified'));
  }, []);

  // ---- Scroll handling ----
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Reset scroll on mode change.
  useEffect(() => {
    setScrollTop(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [mode]);

  // ---- Container height tracking ----
  const [containerHeight, setContainerHeight] = useState(600);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Set initial height if container is already laid out.
    if (el.clientHeight > 0) {
      setContainerHeight(el.clientHeight);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) {
          setContainerHeight(h);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]); // re-attach when mode changes since containerRef target changes

  // ---- Virtualization ----
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endIdx = Math.min(
    activeRowCount,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_ROWS
  );

  // ---- Render ----
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius,
        overflow: 'hidden',
        color: theme.colors.foreground,
        background: theme.colors.editorBackground,
        ...style,
      }}
      {...rest}
    >
      <DiffHeader
        filePath={filePath}
        oldFilePath={oldFilePath}
        stats={diff.stats}
        mode={mode}
        onToggleMode={handleToggleMode}
        allExpanded={allExpanded}
        onToggleCollapse={handleToggleCollapse}
        hasCollapsible={hasCollapsible}
        theme={theme}
      />

      {mode === 'unified' ? (
        /* ---- Unified mode ---- */
        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
          }}
        >
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: startIdx * ROW_HEIGHT,
                left: 0,
                right: 0,
              }}
            >
              {unifiedRows.slice(startIdx, endIdx).map((row) => {
                if (row.kind === 'collapse') {
                  return (
                    <CollapseExpander
                      key={`c-${row.startIndex}`}
                      count={row.count}
                      sectionKey={row.sectionKey}
                      theme={theme}
                      onExpand={handleExpand}
                    />
                  );
                }
                return (
                  <UnifiedContentRow
                    key={`u-${row.index}`}
                    row={row}
                    theme={theme}
                    showLineNumbers={lineNumbers}
                    lineNumWidth={lineNumWidth}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ---- Split mode ---- */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* We use a single scrollable container for split mode to keep
              virtualization simple and scroll sync automatic. */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflow: 'auto',
              position: 'relative',
            }}
          >
            <div style={{ height: totalHeight, position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: startIdx * ROW_HEIGHT,
                  left: 0,
                  right: 0,
                }}
              >
                {splitRows.slice(startIdx, endIdx).map((row) => {
                  if (row.kind === 'collapse') {
                    return (
                      <CollapseExpander
                        key={`sc-${row.startIndex}`}
                        count={row.count}
                        sectionKey={row.sectionKey}
                        theme={theme}
                        onExpand={handleExpand}
                      />
                    );
                  }
                  return (
                    <SplitContentRow
                      key={`s-${row.index}`}
                      row={row}
                      theme={theme}
                      showLineNumbers={lineNumbers}
                      lineNumWidth={lineNumWidth}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {diff.lines.length === 0 && (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            fontFamily: theme.fonts.ui,
            fontSize: theme.fonts.uiSize,
            color: theme.colors.editorGutter,
          }}
        >
          No differences found
        </div>
      )}
    </div>
  );
});
