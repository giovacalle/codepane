// ---------------------------------------------------------------------------
// codepane — Editor.SettingsPanel (Compound Components)
// ---------------------------------------------------------------------------
// A Zed-inspired theme/editor settings panel. Renders as a centered modal
// overlay with vertical tab navigation and grouped setting controls.
//
// Compound component architecture:
//   SettingsPanel.Root, .Overlay, .Container, .Tabs, .Content,
//   .Section, .Toggle, .Slider, .ColorPicker
//
// Zero external dependencies — inline styles + CSS vars from the editor theme.
// ---------------------------------------------------------------------------

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useEditorContext } from '../core/context'
import { useConfig } from '../hooks/use-config'
import { CONFIG_NAMESPACES } from '../core/config-types'
import type { DeepPartial, EditorTheme, ResolvedEditorTheme } from '../core/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Serializable snapshot of all settings managed by the panel. */
export interface SettingsData {
  fontSize: number
  tabSize: number
  wordWrap: boolean
  lineNumbers: boolean
  minimap: boolean
  themeOverrides: DeepPartial<EditorTheme>
  [key: string]: unknown
}

/** Default settings used when no `defaultSettings` prop is provided. */
const DEFAULT_SETTINGS: SettingsData = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: false,
  lineNumbers: true,
  minimap: true,
  themeOverrides: {},
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SettingsPanelContextValue {
  // Theme state
  themeOverrides: DeepPartial<EditorTheme>
  setColorOverride: (path: string, value: string) => void
  clearColorOverride: (path: string) => void
  resetTheme: () => void

  // Editor settings
  fontSize: number
  setFontSize: (v: number) => void
  tabSize: number
  setTabSize: (v: number) => void
  wordWrap: boolean
  setWordWrap: (v: boolean) => void
  lineNumbers: boolean
  setLineNumbers: (v: boolean) => void
  minimap: boolean
  setMinimap: (v: boolean) => void

  // Callbacks
  onClose: () => void
  onChange?: (settings: SettingsData) => void
  theme: ResolvedEditorTheme
  activeTab: string
  setActiveTab: (tab: string) => void

  // Animation
  isAnimating: boolean
}

const SettingsPanelContext = createContext<SettingsPanelContextValue | null>(null)

function useSettingsPanelContext(): SettingsPanelContextValue {
  const ctx = useContext(SettingsPanelContext)
  if (!ctx) {
    throw new Error(
      'SettingsPanel compound components must be rendered inside <SettingsPanel.Root>',
    )
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Sub-component prop types
// ---------------------------------------------------------------------------

export interface SettingsPanelProps {
  /** Callback invoked when the panel should close. */
  onClose: () => void
  /** Initial settings values. */
  defaultSettings?: Partial<SettingsData>
  /** Called whenever any setting changes. */
  onChange?: (settings: SettingsData) => void
  /** CSS class applied to the root wrapper. */
  className?: string
  /** Inline styles merged with the root wrapper. */
  style?: React.CSSProperties
}

export interface SettingsPanelRootProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  onClose: () => void
  defaultSettings?: Partial<SettingsData>
  onChange?: (settings: SettingsData) => void
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export interface SettingsPanelOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  style?: React.CSSProperties
}

export interface SettingsPanelContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  style?: React.CSSProperties
}

export interface SettingsPanelTabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs?: Array<{ id: string; label: string }>
  className?: string
  style?: React.CSSProperties
}

export interface SettingsPanelContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
}

export interface SettingsPanelSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export interface SettingsPanelToggleProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  className?: string
  style?: React.CSSProperties
}

export interface SettingsPanelSliderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  label: string
  description?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  className?: string
  style?: React.CSSProperties
}

export interface SettingsPanelColorPickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  label: string
  value: string
  defaultValue?: string
  onChange: (v: string) => void
  onClear?: () => void
  className?: string
  style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Default tabs
// ---------------------------------------------------------------------------

const DEFAULT_TABS: Array<{ id: string; label: string }> = [
  { id: 'editor', label: 'Editor' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'theme', label: 'Theme' },
]

// ---------------------------------------------------------------------------
// Helper: set a nested property via dot-path on a DeepPartial<EditorTheme>
// ---------------------------------------------------------------------------

function setNestedValue(
  obj: DeepPartial<EditorTheme>,
  path: string,
  value: string,
): DeepPartial<EditorTheme> {
  const clone = structuredClone(obj) as Record<string, unknown>
  const keys = path.split('.')
  let current: Record<string, unknown> = clone

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  current[keys[keys.length - 1]] = value
  return clone as DeepPartial<EditorTheme>
}

function deleteNestedValue(obj: DeepPartial<EditorTheme>, path: string): DeepPartial<EditorTheme> {
  const clone = structuredClone(obj) as Record<string, unknown>
  const keys = path.split('.')
  let current: Record<string, unknown> = clone

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!current[key] || typeof current[key] !== 'object') return clone as DeepPartial<EditorTheme>
    current = current[key] as Record<string, unknown>
  }

  delete current[keys[keys.length - 1]]
  return clone as DeepPartial<EditorTheme>
}

// ---------------------------------------------------------------------------
// Icons (inline SVG)
// ---------------------------------------------------------------------------

function CloseIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={color}>
      <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z" />
    </svg>
  )
}

function ChevronIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill={color}
      style={{
        transform: open ? 'rotate(0)' : 'rotate(-90deg)',
        transition: 'transform 150ms',
        flexShrink: 0,
      }}
    >
      <path d="M2 3l3 3.5L8 3z" />
    </svg>
  )
}

function SettingsIcon({ color }: { color: string }) {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// SettingsPanelRoot — context provider + state management
// ---------------------------------------------------------------------------

function SettingsPanelRoot({
  onClose,
  defaultSettings,
  onChange,
  children,
  className,
  style,
  ...rest
}: SettingsPanelRootProps) {
  const { theme } = useEditorContext()

  const defaults = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...defaultSettings }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Persist settings via useConfig (auto-debounced localStorage or custom adapter)
  const { config, setConfig, resetConfig } = useConfig<SettingsData>(CONFIG_NAMESPACES.CONTENT, {
    defaults,
  })

  const { fontSize, tabSize, wordWrap, lineNumbers, minimap, themeOverrides } = config

  const [activeTab, setActiveTab] = useState('editor')
  const [isAnimating, setIsAnimating] = useState(true)

  // Animate in
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsAnimating(false))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Notify parent on every change
  useEffect(() => {
    onChange?.(config)
  }, [config, onChange])

  const setFontSize = useCallback((v: number) => setConfig({ fontSize: v }), [setConfig])

  const setTabSize = useCallback((v: number) => setConfig({ tabSize: v }), [setConfig])

  const setWordWrap = useCallback((v: boolean) => setConfig({ wordWrap: v }), [setConfig])

  const setLineNumbers = useCallback((v: boolean) => setConfig({ lineNumbers: v }), [setConfig])

  const setMinimap = useCallback((v: boolean) => setConfig({ minimap: v }), [setConfig])

  const setColorOverride = useCallback(
    (path: string, value: string) => {
      const next = setNestedValue(themeOverrides, path, value)
      setConfig({ themeOverrides: next })
    },
    [setConfig, themeOverrides],
  )

  const clearColorOverride = useCallback(
    (path: string) => {
      const next = deleteNestedValue(themeOverrides, path)
      setConfig({ themeOverrides: next })
    },
    [setConfig, themeOverrides],
  )

  const resetTheme = useCallback(() => {
    resetConfig()
  }, [resetConfig])

  const contextValue = useMemo<SettingsPanelContextValue>(
    () => ({
      themeOverrides,
      setColorOverride,
      clearColorOverride,
      resetTheme,
      fontSize,
      setFontSize,
      tabSize,
      setTabSize,
      wordWrap,
      setWordWrap,
      lineNumbers,
      setLineNumbers,
      minimap,
      setMinimap,
      onClose,
      onChange,
      theme,
      activeTab,
      setActiveTab,
      isAnimating,
    }),
    [
      themeOverrides,
      setColorOverride,
      clearColorOverride,
      resetTheme,
      fontSize,
      setFontSize,
      tabSize,
      setTabSize,
      wordWrap,
      setWordWrap,
      lineNumbers,
      setLineNumbers,
      minimap,
      setMinimap,
      onClose,
      onChange,
      theme,
      activeTab,
      isAnimating,
    ],
  )

  return (
    <SettingsPanelContext.Provider value={contextValue}>
      <div className={className} style={style} {...rest}>
        {children}
      </div>
    </SettingsPanelContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// SettingsPanelOverlay — backdrop, click-to-close
// ---------------------------------------------------------------------------

function SettingsPanelOverlay({ className, style, ...rest }: SettingsPanelOverlayProps) {
  const { onClose, isAnimating } = useSettingsPanelContext()

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
// SettingsPanelContainer — modal card (max-width 650, max-height 70vh)
// ---------------------------------------------------------------------------

function SettingsPanelContainer({
  className,
  style,
  children,
  ...rest
}: SettingsPanelContainerProps) {
  const { theme, isAnimating, onClose } = useSettingsPanelContext()

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
          maxWidth: 650,
          maxHeight: '70vh',
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
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            flexShrink: 0,
          }}
        >
          <SettingsIcon color={theme.colors.editorGutter} />
          <span
            style={{
              fontFamily: theme.fonts.ui,
              fontSize: theme.fonts.uiSize,
              fontWeight: 600,
              color: theme.colors.foreground,
              flex: 1,
            }}
          >
            Settings
          </span>
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              border: 'none',
              borderRadius: theme.borderRadius - 2,
              background: 'transparent',
              cursor: 'pointer',
              color: theme.colors.foreground,
            }}
            title="Close"
          >
            <CloseIcon color={theme.colors.foreground} />
          </button>
        </div>

        {/* Body: tabs + content side by side */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsPanelTabs — vertical tab navigation sidebar
// ---------------------------------------------------------------------------

function SettingsPanelTabs({
  tabs = DEFAULT_TABS,
  className,
  style,
  ...rest
}: SettingsPanelTabsProps) {
  const { theme, activeTab, setActiveTab } = useSettingsPanelContext()

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px',
        borderRight: `1px solid ${theme.colors.border}`,
        flexShrink: 0,
        width: 140,
        ...style,
      }}
      {...rest}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px',
              border: 'none',
              borderRadius: theme.borderRadius,
              background: isActive ? theme.colors.treeSelected : 'transparent',
              color: isActive ? theme.colors.foreground : theme.colors.editorGutter,
              fontFamily: theme.fonts.ui,
              fontSize: theme.fonts.uiSize - 1,
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.1s ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = theme.colors.treeHover
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsPanelContent — content area for the active tab
// ---------------------------------------------------------------------------

function SettingsPanelContent({ children, className, style, ...rest }: SettingsPanelContentProps) {
  const ctx = useSettingsPanelContext()

  return (
    <div
      className={className}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        ...style,
      }}
      {...rest}
    >
      {children || <DefaultTabContent ctx={ctx} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsPanelSection — collapsible section header
// ---------------------------------------------------------------------------

function SettingsPanelSection({
  title,
  defaultOpen = true,
  children,
  className,
  style,
  ...rest
}: SettingsPanelSectionProps) {
  const { theme } = useSettingsPanelContext()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={className}
      style={{
        marginBottom: 8,
        ...style,
      }}
      {...rest}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '6px 0',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: theme.fonts.ui,
          fontSize: theme.fonts.uiSize - 1,
          fontWeight: 600,
          color: theme.colors.foreground,
          userSelect: 'none',
          textAlign: 'left',
        }}
      >
        <ChevronIcon open={open} color={theme.colors.editorGutter} />
        {title}
      </button>
      {open && <div style={{ paddingLeft: 4, paddingTop: 4 }}>{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsPanelToggle — a setting row with a toggle switch
// ---------------------------------------------------------------------------

function SettingsPanelToggle({
  label,
  description,
  checked,
  onChange,
  className,
  style,
  ...rest
}: SettingsPanelToggleProps) {
  const { theme } = useSettingsPanelContext()

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        gap: 12,
        ...style,
      }}
      {...rest}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.fonts.ui,
            fontSize: theme.fonts.uiSize - 1,
            color: theme.colors.foreground,
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontFamily: theme.fonts.ui,
              fontSize: theme.fonts.uiSize - 3,
              color: theme.colors.editorGutter,
              marginTop: 2,
            }}
          >
            {description}
          </div>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: 10,
          border: `1px solid ${checked ? theme.colors.accent : theme.colors.border}`,
          background: checked ? theme.colors.accent : theme.colors.panelBackground,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          padding: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: checked ? '#fff' : theme.colors.editorGutter,
            transition: 'left 0.15s ease, background-color 0.15s ease',
          }}
        />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsPanelSlider — a setting row with a range slider
// ---------------------------------------------------------------------------

function SettingsPanelSlider({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
  style,
  ...rest
}: SettingsPanelSliderProps) {
  const { theme } = useSettingsPanelContext()

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        gap: 12,
        ...style,
      }}
      {...rest}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.fonts.ui,
            fontSize: theme.fonts.uiSize - 1,
            color: theme.colors.foreground,
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontFamily: theme.fonts.ui,
              fontSize: theme.fonts.uiSize - 3,
              color: theme.colors.editorGutter,
              marginTop: 2,
            }}
          >
            {description}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: 100,
            accentColor: theme.colors.accent,
            cursor: 'pointer',
          }}
        />
        <span
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: theme.fonts.uiSize - 2,
            color: theme.colors.editorGutter,
            minWidth: 24,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsPanelColorPicker — a color setting with native color input + clear
// ---------------------------------------------------------------------------

const COLOR_DEBOUNCE_MS = 80

function SettingsPanelColorPicker({
  label,
  value,
  defaultValue,
  onChange,
  onClear,
  className,
  style,
  ...rest
}: SettingsPanelColorPickerProps) {
  const { theme } = useSettingsPanelContext()
  const isOverridden = defaultValue !== undefined && value !== defaultValue

  // Debounce color picker to avoid firing on every pixel of mouse drag
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onChange(newValue), COLOR_DEBOUNCE_MS)
    },
    [onChange],
  )
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 0',
        gap: 12,
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          fontFamily: theme.fonts.ui,
          fontSize: theme.fonts.uiSize - 2,
          color: theme.colors.foreground,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {/* Color swatch preview */}
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            border: `1px solid ${theme.colors.border}`,
            background: value,
            flexShrink: 0,
          }}
        />
        <input
          type="color"
          value={toHex6(value)}
          onChange={handleColorChange}
          style={{
            width: 28,
            height: 22,
            padding: 0,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 3,
            background: theme.colors.panelBackground,
            cursor: 'pointer',
          }}
        />
        <span
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 10,
            color: theme.colors.editorGutter,
            minWidth: 58,
          }}
        >
          {toHex6(value)}
        </span>
        {onClear && isOverridden && (
          <button
            onClick={onClear}
            title="Reset to default"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              border: 'none',
              borderRadius: 3,
              background: 'transparent',
              cursor: 'pointer',
              color: theme.colors.editorGutter,
              fontSize: 12,
              padding: 0,
            }}
          >
            <CloseIcon color={theme.colors.editorGutter} />
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: convert CSS color to #rrggbb for <input type="color">
// ---------------------------------------------------------------------------

function toHex6(color: string): string {
  // Already a 7-char hex
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color
  // Short hex (#rgb)
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const [, r, g, b] = color
    return `#${r}${r}${g}${g}${b}${b}`
  }
  // For rgba / named colors etc., fall back to a canvas-based approach
  if (typeof document !== 'undefined') {
    const ctx = document.createElement('canvas').getContext('2d')
    if (ctx) {
      ctx.fillStyle = color
      const resolved = ctx.fillStyle
      if (/^#[0-9a-fA-F]{6}$/.test(resolved)) return resolved
    }
  }
  return '#000000'
}

// ---------------------------------------------------------------------------
// Default tab content
// ---------------------------------------------------------------------------

function DefaultTabContent({ ctx }: { ctx: SettingsPanelContextValue }) {
  switch (ctx.activeTab) {
    case 'editor':
      return <EditorTabContent />
    case 'appearance':
      return <AppearanceTabContent />
    case 'theme':
      return <ThemeTabContent />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Editor tab
// ---------------------------------------------------------------------------

function EditorTabContent() {
  const ctx = useSettingsPanelContext()

  return (
    <>
      <SettingsPanelSlider
        label="Font Size"
        description="Editor font size in pixels"
        value={ctx.fontSize}
        min={10}
        max={24}
        step={1}
        onChange={ctx.setFontSize}
      />

      <TabSizeControl />

      <SettingsPanelToggle
        label="Word Wrap"
        description="Wrap long lines to fit the editor width"
        checked={ctx.wordWrap}
        onChange={ctx.setWordWrap}
      />

      <SettingsPanelToggle
        label="Line Numbers"
        description="Show line numbers in the gutter"
        checked={ctx.lineNumbers}
        onChange={ctx.setLineNumbers}
      />

      <SettingsPanelToggle
        label="Minimap"
        description="Show a minimap overview of the file"
        checked={ctx.minimap}
        onChange={ctx.setMinimap}
      />
    </>
  )
}

/** Tab size as 2 or 4 button group */
function TabSizeControl() {
  const { theme, tabSize, setTabSize } = useSettingsPanelContext()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: theme.fonts.ui,
            fontSize: theme.fonts.uiSize - 1,
            color: theme.colors.foreground,
          }}
        >
          Tab Size
        </div>
        <div
          style={{
            fontFamily: theme.fonts.ui,
            fontSize: theme.fonts.uiSize - 3,
            color: theme.colors.editorGutter,
            marginTop: 2,
          }}
        >
          Number of spaces per tab
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {[2, 4].map((size) => {
          const isActive = tabSize === size
          return (
            <button
              key={size}
              onClick={() => setTabSize(size)}
              style={{
                padding: '4px 12px',
                border: `1px solid ${isActive ? theme.colors.accent : theme.colors.border}`,
                borderRadius: theme.borderRadius - 2,
                background: isActive ? `${theme.colors.accent}20` : 'transparent',
                color: isActive ? theme.colors.accent : theme.colors.foreground,
                fontFamily: theme.fonts.mono,
                fontSize: theme.fonts.uiSize - 2,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {size}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Appearance tab
// ---------------------------------------------------------------------------

function AppearanceTabContent() {
  const ctx = useSettingsPanelContext()

  const treeIndent =
    (ctx.themeOverrides.spacing?.treeIndent as number) ?? ctx.theme.spacing.treeIndent
  const treeItemHeight =
    (ctx.themeOverrides.spacing?.treeItemHeight as number) ?? ctx.theme.spacing.treeItemHeight
  const tabHeight = (ctx.themeOverrides.spacing?.tabHeight as number) ?? ctx.theme.spacing.tabHeight
  const borderRadius = (ctx.themeOverrides.borderRadius as number) ?? ctx.theme.borderRadius

  return (
    <>
      <SettingsPanelSlider
        label="Tree Indent"
        description="Indentation width per depth level in the file tree"
        value={treeIndent}
        min={8}
        max={32}
        step={1}
        onChange={(v) => ctx.setColorOverride('spacing.treeIndent', String(v))}
      />
      <SettingsPanelSlider
        label="Tree Item Height"
        description="Height of each row in the file tree"
        value={treeItemHeight}
        min={20}
        max={40}
        step={1}
        onChange={(v) => ctx.setColorOverride('spacing.treeItemHeight', String(v))}
      />
      <SettingsPanelSlider
        label="Tab Height"
        description="Height of the tab bar"
        value={tabHeight}
        min={28}
        max={48}
        step={1}
        onChange={(v) => ctx.setColorOverride('spacing.tabHeight', String(v))}
      />
      <SettingsPanelSlider
        label="Border Radius"
        description="Rounding applied to panels, tabs, and inputs"
        value={borderRadius}
        min={0}
        max={12}
        step={1}
        onChange={(v) => ctx.setColorOverride('borderRadius', String(v))}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Theme tab — color pickers grouped in collapsible sections
// ---------------------------------------------------------------------------

interface ColorGroup {
  title: string
  colors: Array<{ key: string; label: string }>
}

const THEME_COLOR_GROUPS: ColorGroup[] = [
  {
    title: 'Backgrounds',
    colors: [
      { key: 'background', label: 'Background' },
      { key: 'editorBackground', label: 'Editor Background' },
      { key: 'panelBackground', label: 'Panel Background' },
      { key: 'statusBarBackground', label: 'Status Bar Background' },
      { key: 'elevatedSurface', label: 'Elevated Surface' },
    ],
  },
  {
    title: 'Text & Borders',
    colors: [
      { key: 'foreground', label: 'Foreground' },
      { key: 'border', label: 'Border' },
      { key: 'accent', label: 'Accent' },
      { key: 'cursor', label: 'Cursor' },
    ],
  },
  {
    title: 'Editor',
    colors: [
      { key: 'editorLineHighlight', label: 'Line Highlight' },
      { key: 'editorGutter', label: 'Gutter' },
      { key: 'selection', label: 'Selection' },
    ],
  },
  {
    title: 'Tabs',
    colors: [
      { key: 'tabActive', label: 'Tab Active' },
      { key: 'tabInactive', label: 'Tab Inactive' },
      { key: 'tabDirtyIndicator', label: 'Dirty Indicator' },
    ],
  },
  {
    title: 'Tree',
    colors: [
      { key: 'treeHover', label: 'Hover' },
      { key: 'treeSelected', label: 'Selected' },
      { key: 'treeIndentGuide', label: 'Indent Guide' },
    ],
  },
  {
    title: 'Syntax',
    colors: [
      { key: 'keyword', label: 'Keyword' },
      { key: 'string', label: 'String' },
      { key: 'comment', label: 'Comment' },
      { key: 'number', label: 'Number' },
      { key: 'function', label: 'Function' },
      { key: 'type', label: 'Type' },
      { key: 'variable', label: 'Variable' },
      { key: 'operator', label: 'Operator' },
    ],
  },
  {
    title: 'Status',
    colors: [
      { key: 'error', label: 'Error' },
      { key: 'warning', label: 'Warning' },
      { key: 'success', label: 'Success' },
      { key: 'info', label: 'Info' },
      { key: 'added', label: 'Added' },
      { key: 'modified', label: 'Modified' },
      { key: 'deleted', label: 'Deleted' },
    ],
  },
]

function ThemeTabContent() {
  const ctx = useSettingsPanelContext()
  const overrideColors = (ctx.themeOverrides.colors ?? {}) as Record<string, string | undefined>

  return (
    <>
      {/* Reset button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={ctx.resetTheme}
          style={{
            padding: '4px 10px',
            border: `1px solid ${ctx.theme.colors.border}`,
            borderRadius: ctx.theme.borderRadius - 2,
            background: 'transparent',
            color: ctx.theme.colors.editorGutter,
            fontFamily: ctx.theme.fonts.ui,
            fontSize: ctx.theme.fonts.uiSize - 2,
            cursor: 'pointer',
          }}
        >
          Reset All Colors
        </button>
      </div>

      {THEME_COLOR_GROUPS.map((group) => (
        <SettingsPanelSection key={group.title} title={group.title} defaultOpen={false}>
          {group.colors.map(({ key, label }) => {
            const themeColors = ctx.theme.colors as unknown as Record<string, string>
            const defaultColor = themeColors[key] ?? '#000000'
            const currentColor = overrideColors[key] ?? defaultColor

            return (
              <SettingsPanelColorPicker
                key={key}
                label={label}
                value={currentColor}
                defaultValue={defaultColor}
                onChange={(v) => ctx.setColorOverride(`colors.${key}`, v)}
                onClear={() => ctx.clearColorOverride(`colors.${key}`)}
              />
            )
          })}
        </SettingsPanelSection>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Default simple export
// ---------------------------------------------------------------------------

function SettingsPanelSimple({ onClose, ...props }: SettingsPanelProps) {
  return (
    <SettingsPanelRoot onClose={onClose} {...props}>
      <SettingsPanelOverlay />
      <SettingsPanelContainer>
        <SettingsPanelTabs />
        <SettingsPanelContent />
      </SettingsPanelContainer>
    </SettingsPanelRoot>
  )
}

// ---------------------------------------------------------------------------
// Final export with namespace
// ---------------------------------------------------------------------------

export const SettingsPanel = Object.assign(SettingsPanelSimple, {
  Root: SettingsPanelRoot,
  Overlay: SettingsPanelOverlay,
  Container: SettingsPanelContainer,
  Tabs: SettingsPanelTabs,
  Content: SettingsPanelContent,
  Section: SettingsPanelSection,
  Toggle: SettingsPanelToggle,
  Slider: SettingsPanelSlider,
  ColorPicker: SettingsPanelColorPicker,
})
