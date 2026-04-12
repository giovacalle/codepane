// ---------------------------------------------------------------------------
// codepane — Editor.Breadcrumbs
// ---------------------------------------------------------------------------
// Displays a breadcrumb trail for the active file's path. Each segment is
// clickable to navigate the file tree to that directory.
// ---------------------------------------------------------------------------

import { useMemo, useCallback } from 'react';
import { useEditorStore } from '../core/context';

export interface EditorBreadcrumbsProps {
  /** Separator between path segments. Defaults to "/". */
  separator?: React.ReactNode;
  /** Additional CSS class name. */
  className?: string;
  /** Additional inline styles. */
  style?: React.CSSProperties;
}

interface BreadcrumbSegment {
  /** Display label for this segment. */
  label: string;
  /** Full path up to and including this segment. */
  path: string;
  /** Whether this segment represents a directory. */
  isDirectory: boolean;
}

/**
 * Renders a breadcrumb trail for the currently active file.
 *
 * Each path segment is a clickable button that navigates the file tree
 * to the corresponding directory. The final segment (the file name)
 * is rendered as plain text.
 *
 * @example
 * ```tsx
 * <Editor.Breadcrumbs separator={<ChevronRight />} />
 * ```
 */
export function EditorBreadcrumbs({ separator = '/', className, style }: EditorBreadcrumbsProps) {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const selectFile = useEditorStore((s) => s.selectFile);
  const expandDir = useEditorStore((s) => s.expandDir);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );

  const segments = useMemo((): BreadcrumbSegment[] => {
    if (!activeTab) return [];

    const parts = activeTab.path.split('/').filter(Boolean);
    const result: BreadcrumbSegment[] = [];

    for (let i = 0; i < parts.length; i++) {
      const path = parts.slice(0, i + 1).join('/');
      const isLast = i === parts.length - 1;

      result.push({
        label: parts[i],
        path,
        isDirectory: !isLast,
      });
    }

    return result;
  }, [activeTab]);

  const handleSegmentClick = useCallback(
    (segment: BreadcrumbSegment) => {
      if (segment.isDirectory) {
        // Expand the directory in the tree and select it
        expandDir(segment.path);
        selectFile(segment.path);
      }
    },
    [expandDir, selectFile]
  );

  if (segments.length === 0) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '0 12px',
    height: '28px',
    minHeight: '28px',
    fontFamily: 'var(--editor-font-ui)',
    fontSize: 'calc(var(--editor-font-ui-size) - 1px)',
    color: 'var(--editor-color-foreground)',
    background: 'var(--editor-color-background)',
    borderBottom: '1px solid var(--editor-color-border)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    ...style,
  };

  const separatorStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    opacity: 0.4,
    margin: '0 2px',
    userSelect: 'none',
    flexShrink: 0,
  };

  return (
    <nav className={className} style={containerStyle} aria-label="Breadcrumb">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;

        return (
          <span
            key={segment.path}
            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
          >
            {index > 0 && (
              <span style={separatorStyle} aria-hidden>
                {separator}
              </span>
            )}

            {isLast ? (
              <span
                style={{
                  opacity: 0.9,
                  fontWeight: 500,
                }}
                aria-current="page"
              >
                {segment.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleSegmentClick(segment)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px 4px',
                  margin: 0,
                  cursor: 'pointer',
                  color: 'inherit',
                  opacity: 0.6,
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  borderRadius: 'var(--editor-border-radius)',
                  transition: 'opacity 150ms ease, background 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.background = 'var(--editor-color-tree-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.6';
                  e.currentTarget.style.background = 'none';
                }}
              >
                {segment.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
