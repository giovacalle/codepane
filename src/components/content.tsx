// ---------------------------------------------------------------------------
// codepane — Editor.Content
// ---------------------------------------------------------------------------
// CodeMirror wrapper component that renders the active file's content.
// Lazy-loads language grammars, applies theme as a CodeMirror extension,
// and dispatches changes back to the store.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useEditorStore, useEditorContext } from '../core/context'
import type { Tab, EditorTheme } from '../core/types'
import { getLanguageExtension } from '../utils/language-map'
import { useConfig } from '../hooks/use-config'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorContentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Additional CodeMirror extensions to inject */
  extensions?: Extension[]
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Show line numbers gutter. Defaults to `true`. */
  lineNumbers?: boolean
  /** Enable word wrap. Defaults to `false`. */
  wordWrap?: boolean
  /** Tab size in spaces. Defaults to `2`. */
  tabSize?: number
  /** Called on every content change */
  onChange?: (content: string) => void
  /** Called when the user triggers save (Cmd/Ctrl+S) */
  onSave?: (content: string) => void
  /** CSS class applied to the outermost wrapper */
  className?: string
  /** Inline styles merged with the wrapper element's default styles. */
  style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Content config defaults
// ---------------------------------------------------------------------------

const CONTENT_CONFIG_DEFAULTS = {
  fontSize: 14,
  fontFamily: '',
  tabSize: 2,
  wordWrap: false,
  lineNumbers: true,
}

type ContentConfig = typeof CONTENT_CONFIG_DEFAULTS

// ---------------------------------------------------------------------------
// Theme extension builder
// ---------------------------------------------------------------------------

interface ThemeFontOverrides {
  fontSize?: number
  fontFamily?: string
}

/**
 * Build a CodeMirror theme extension from the editor's resolved theme.
 * Uses `EditorView.theme` so colors react to theme changes without
 * remounting the entire CodeMirror instance.
 *
 * Optional font overrides allow config/prop values to take precedence
 * over the theme's default mono font settings.
 */
function buildCodeMirrorTheme(theme: EditorTheme, fontOverrides?: ThemeFontOverrides): Extension {
  const effectiveFont = fontOverrides?.fontFamily || theme.fonts.mono
  const effectiveSize = fontOverrides?.fontSize || theme.fonts.monoSize

  return EditorView.theme({
    '&': {
      backgroundColor: theme.colors.editorBackground,
      color: theme.colors.foreground,
      fontFamily: effectiveFont,
      fontSize: `${effectiveSize}px`,
    },
    '.cm-content': {
      caretColor: theme.colors.cursor,
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: theme.colors.cursor,
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: theme.colors.selection,
    },
    '.cm-activeLine': {
      backgroundColor: theme.colors.editorLineHighlight,
    },
    '.cm-gutters': {
      backgroundColor: theme.colors.editorBackground,
      color: theme.colors.editorGutter,
      borderRight: 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: theme.colors.editorLineHighlight,
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      border: 'none',
      color: theme.colors.editorGutter,
    },
    // Scrollbar styling
    '.cm-scroller::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '.cm-scroller::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      backgroundColor: theme.colors.border,
      borderRadius: '4px',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
      backgroundColor: theme.colors.editorGutter,
    },
  })
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState: React.FC<{ theme: EditorTheme }> = ({ theme }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      backgroundColor: theme.colors.editorBackground,
      color: theme.colors.editorGutter,
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.fonts.uiSize}px`,
      userSelect: 'none',
    }}
  >
    No file open
  </div>
)

// ---------------------------------------------------------------------------
// Loading overlay
// ---------------------------------------------------------------------------

const LoadingOverlay: React.FC<{ theme: EditorTheme }> = ({ theme }) => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.editorBackground,
      color: theme.colors.editorGutter,
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.fonts.uiSize}px`,
      opacity: 0.7,
      zIndex: 10,
      pointerEvents: 'none',
    }}
  >
    Loading...
  </div>
)

// ---------------------------------------------------------------------------
// EditorContent component
// ---------------------------------------------------------------------------

export const EditorContent = React.memo<EditorContentProps>(function EditorContent({
  extensions: externalExtensions,
  readOnly: readOnlyProp,
  lineNumbers,
  wordWrap,
  tabSize,
  onChange,
  onSave,
  className,
  style,
  ...rest
}) {
  const { adapter, theme } = useEditorContext()

  // Persisted content config
  const { config } = useConfig<ContentConfig>('content', {
    defaults: CONTENT_CONFIG_DEFAULTS,
  })

  // Props override persisted config
  const effectiveLineNumbers = lineNumbers ?? config.lineNumbers
  const effectiveWordWrap = wordWrap ?? config.wordWrap
  const effectiveTabSize = tabSize ?? config.tabSize
  const effectiveFontSize = config.fontSize || 0
  const effectiveFontFamily = config.fontFamily || ''

  // Store selectors
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const tabs = useEditorStore((s) => s.tabs)
  const fileContents = useEditorStore((s) => s.fileContents)
  const dirtyFiles = useEditorStore((s) => s.dirtyFiles)
  const updateFileContent = useEditorStore((s) => s.updateFileContent)
  const saveFile = useEditorStore((s) => s.saveFile)
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition)

  // Derived state
  const activeTab: Tab | undefined = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId],
  )

  const filePath = activeTab?.path ?? null

  // Get content: dirty version takes precedence over saved version
  const content = useMemo(() => {
    if (!filePath) return ''
    const dirty = dirtyFiles.get(filePath)
    if (dirty !== undefined) return dirty
    return fileContents.get(filePath) ?? ''
  }, [filePath, dirtyFiles, fileContents])

  // Language loading
  const [langExtension, setLangExtension] = useState<Extension | null>(null)
  const [langLoading, setLangLoading] = useState(false)

  useEffect(() => {
    if (!filePath) {
      setLangExtension(null)
      return
    }

    let cancelled = false
    setLangLoading(true)

    getLanguageExtension(filePath)
      .then((ext) => {
        if (!cancelled) {
          setLangExtension(ext)
          setLangLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLangExtension(null)
          setLangLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [filePath])

  // Resolve readOnly: prop takes precedence, then check adapter capabilities
  const isReadOnly = readOnlyProp ?? !adapter.capabilities.write

  // Ref for accessing current content in save handler
  const contentRef = useRef(content)
  contentRef.current = content

  // Build the save keymap
  const saveKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            if (filePath) {
              saveFile(filePath)
              onSave?.(contentRef.current)
            }
            return true
          },
        },
      ]),
    [filePath, saveFile, onSave],
  )

  // Cursor tracking extension
  const cursorListener = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet) return
        const pos = update.state.selection.main.head
        const line = update.state.doc.lineAt(pos)
        const newLine = line.number
        const newCol = pos - line.from + 1
        const { from, to } = update.state.selection.main
        const sel = from !== to ? { from, to } : null
        setCursorPosition(newLine, newCol, sel)
      }),
    [setCursorPosition],
  )

  // Assemble extensions
  const allExtensions = useMemo(() => {
    const exts: Extension[] = []

    // Theme (with optional config font overrides)
    exts.push(
      buildCodeMirrorTheme(theme, {
        fontSize: effectiveFontSize || undefined,
        fontFamily: effectiveFontFamily || undefined,
      }),
    )

    // Language
    if (langExtension) {
      exts.push(langExtension)
    }

    // Word wrap
    if (effectiveWordWrap) {
      exts.push(EditorView.lineWrapping)
    }

    // (Tab size is handled by basicSetup.tabSize)

    // Cursor tracking
    exts.push(cursorListener)

    // Save keymap
    exts.push(saveKeymap)

    // External extensions
    if (externalExtensions) {
      exts.push(...externalExtensions)
    }

    return exts
  }, [
    theme,
    langExtension,
    effectiveWordWrap,
    effectiveFontSize,
    effectiveFontFamily,
    cursorListener,
    saveKeymap,
    externalExtensions,
  ])

  // Change handler
  const handleChange = useCallback(
    (value: string) => {
      if (filePath) {
        updateFileContent(filePath, value)
        onChange?.(value)
      }
    },
    [filePath, updateFileContent, onChange],
  )

  // CodeMirror ref
  const editorRef = useRef<ReactCodeMirrorRef>(null)

  // No active tab -- show empty state
  if (!activeTab) {
    return (
      <div
        className={className}
        style={{
          position: 'relative',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          ...style,
        }}
        {...rest}
      >
        <EmptyState theme={theme} />
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {langLoading && <LoadingOverlay theme={theme} />}
      <CodeMirror
        ref={editorRef}
        value={content}
        height="100%"
        width="100%"
        theme="none"
        readOnly={isReadOnly}
        editable={!isReadOnly}
        basicSetup={{
          lineNumbers: effectiveLineNumbers,
          foldGutter: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          indentOnInput: true,
          tabSize: effectiveTabSize,
        }}
        extensions={allExtensions}
        onChange={handleChange}
        style={{
          height: '100%',
          width: '100%',
          fontSize: `${effectiveFontSize || theme.fonts.monoSize}px`,
        }}
      />
    </div>
  )
})
