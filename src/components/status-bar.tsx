// ---------------------------------------------------------------------------
// codepane — Editor.StatusBar
// ---------------------------------------------------------------------------
// Bottom bar displaying file metadata (language, encoding, file size, etc.)
// for the currently active file.
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useEditorStore, useEditorContext } from '../core/context';
import { useConfig } from '../hooks/use-config';

export interface EditorStatusBarProps {
  /** Show the detected file language. Defaults to `true`. */
  showLanguage?: boolean;
  /** Show the line and column position. Defaults to `true`. */
  showLineCol?: boolean;
  /** Show the file size. Defaults to `true`. */
  showFileSize?: boolean;
  /** Show the file encoding. Defaults to `true`. */
  showEncoding?: boolean;
  /**
   * Custom content rendered on the right side of the status bar.
   * Use this for application-specific indicators (e.g. git branch, lint status).
   */
  children?: ReactNode;
  /** Additional CSS class name. */
  className?: string;
  /** Additional inline styles. */
  style?: React.CSSProperties;
}

/** Map of file extensions to display language names. */
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript React',
  js: 'JavaScript',
  jsx: 'JavaScript React',
  json: 'JSON',
  md: 'Markdown',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  py: 'Python',
  rs: 'Rust',
  go: 'Go',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  h: 'C Header',
  hpp: 'C++ Header',
  php: 'PHP',
  rb: 'Ruby',
  sql: 'SQL',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  txt: 'Plain Text',
  svg: 'SVG',
  gitignore: 'Git Ignore',
  env: 'Environment',
  dockerfile: 'Dockerfile',
};

function getLanguageFromPath(path: string): string {
  const fileName = path.split('/').pop() ?? '';
  const lowerName = fileName.toLowerCase();

  // Check full file names first (e.g. Dockerfile, Makefile)
  if (lowerName === 'dockerfile') return 'Dockerfile';
  if (lowerName === 'makefile') return 'Makefile';

  const ext = fileName.includes('.') ? (fileName.split('.').pop()?.toLowerCase() ?? '') : '';
  return EXTENSION_LANGUAGE_MAP[ext] ?? (ext ? ext.toUpperCase() : 'Plain Text');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A bottom status bar that displays metadata about the active file.
 *
 * Automatically reads the active tab and file content from the store
 * to display language, file size, and encoding information. Custom
 * content can be provided via `children` for the right-side slot.
 *
 * @example
 * ```tsx
 * <Editor.StatusBar showLanguage showFileSize>
 *   <span>main</span>
 * </Editor.StatusBar>
 * ```
 */
export function EditorStatusBar({
  showLanguage,
  showLineCol,
  showFileSize,
  showEncoding,
  children,
  className,
  style,
}: EditorStatusBarProps) {
  const { config } = useConfig('statusBar', {
    defaults: {
      showLanguage: true,
      showLineCol: true,
      showFileSize: true,
      showEncoding: true,
    },
  });

  // Props override persisted config; config overrides defaults
  const resolvedShowLanguage = showLanguage ?? config.showLanguage;
  const resolvedShowLineCol = showLineCol ?? config.showLineCol;
  const resolvedShowFileSize = showFileSize ?? config.showFileSize;
  const resolvedShowEncoding = showEncoding ?? config.showEncoding;

  const { theme } = useEditorContext();
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const fileContents = useEditorStore((s) => s.fileContents);
  const cursorLine = useEditorStore((s) => s.cursorLine);
  const cursorCol = useEditorStore((s) => s.cursorCol);
  const cursorSelection = useEditorStore((s) => s.cursorSelection);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );

  const content = activeTab ? fileContents.get(activeTab.path) : undefined;
  const language = activeTab ? getLanguageFromPath(activeTab.path) : null;
  // Use TextEncoder for accurate byte count (content.length gives UTF-16 code units)
  const fileSize = useMemo(
    () => (content !== undefined ? new TextEncoder().encode(content).byteLength : null),
    [content]
  );

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '24px',
    minHeight: '24px',
    padding: '0 12px',
    fontFamily: 'var(--editor-font-ui)',
    fontSize: '11px',
    color: 'var(--editor-color-foreground)',
    background: 'var(--editor-color-tab-inactive)',
    borderTop: '1px solid var(--editor-color-border)',
    opacity: 0.8,
    userSelect: 'none',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    ...style,
  };

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const itemStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
  };

  if (!activeTab) {
    return (
      <div className={className} style={containerStyle} role="status" aria-label="Status bar">
        <div style={sectionStyle} />
        {children && <div style={sectionStyle}>{children}</div>}
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle} role="status" aria-label="Status bar">
      <div style={sectionStyle}>
        {resolvedShowLanguage && language && <span style={itemStyle}>{language}</span>}
        {resolvedShowLineCol && (
          <span style={itemStyle}>
            <span>Ln</span>{' '}
            <span style={{ fontFamily: theme.fonts.mono, fontVariantNumeric: 'tabular-nums' }}>
              {cursorLine}
            </span>
            <span>,</span> <span>Col</span>{' '}
            <span style={{ fontFamily: theme.fonts.mono, fontVariantNumeric: 'tabular-nums' }}>
              {cursorCol}
            </span>
            {cursorSelection && (
              <>
                {' '}
                <span style={{ opacity: 0.7 }}>
                  ({cursorSelection.to - cursorSelection.from} selected)
                </span>
              </>
            )}
          </span>
        )}
        {resolvedShowEncoding && <span style={itemStyle}>UTF-8</span>}
        {resolvedShowFileSize && fileSize !== null && (
          <span style={itemStyle}>{formatFileSize(fileSize)}</span>
        )}
      </div>
      {children && <div style={sectionStyle}>{children}</div>}
    </div>
  );
}
