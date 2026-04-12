// ---------------------------------------------------------------------------
// codepane — React Context & Hooks
// ---------------------------------------------------------------------------
// Provides the React context that bridges the Zustand store instance, the
// filesystem adapter, and the resolved theme to all Editor.* components.
//
// Public hooks:
//   - useEditorStore(selector)  — select slices of store state
//   - useEditorContext()        — access adapter, theme, and rootPath
// ---------------------------------------------------------------------------

import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';

import type { FileSystemAdapter } from '../adapters/types';
import type { ResolvedEditorTheme } from './types';
import type { EditorStore, EditorStoreState } from './store';
import type { ConfigStorageAdapter } from './config-types';

// ---------------------------------------------------------------------------
// Context Shape
// ---------------------------------------------------------------------------

export interface EditorContextValue {
  /** The Zustand store instance backing this editor. */
  store: EditorStore;
  /** The filesystem adapter provided to Editor.Root. */
  adapter: FileSystemAdapter;
  /** Fully resolved theme (defaults merged with user overrides). */
  theme: ResolvedEditorTheme;
  /** Root directory path for this editor instance. */
  rootPath: string;
  /** Config storage adapter (null if persistence is disabled). */
  configStorage: ConfigStorageAdapter | null;
  /** Namespace prefix for config keys. */
  configPrefix: string;
  /** Debounce delay for config persistence (ms). */
  configDebounceMs: number;
  /** Whether config persistence is disabled. */
  configDisabled: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const EditorContext = createContext<EditorContextValue | null>(null);
EditorContext.displayName = 'EditorContext';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface EditorProviderProps {
  value: EditorContextValue;
  children: ReactNode;
}

/**
 * Provides the editor context to all descendant Editor.* components.
 *
 * This is an internal component — consumers use `<Editor.Root>` which
 * creates the provider automatically.
 */
export function EditorProvider({ value, children }: EditorProviderProps) {
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Access a slice of the editor store state with a selector.
 *
 * Uses Zustand's `useStore` for optimal re-render behavior — the component
 * only re-renders when the selected slice changes (shallow equality).
 *
 * @example
 * ```tsx
 * const tree = useEditorStore(s => s.tree);
 * const openFile = useEditorStore(s => s.openFile);
 * ```
 */
export function useEditorStore<T>(selector: (state: EditorStoreState) => T): T {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorStore must be used within an <Editor.Root> component.');
  }
  return useStore(context.store, selector);
}

/**
 * Access the editor context directly (adapter, theme, rootPath).
 *
 * Use this when you need the adapter or theme outside of store state,
 * e.g. to check adapter capabilities or read theme tokens.
 *
 * @example
 * ```tsx
 * const { adapter, theme, rootPath } = useEditorContext();
 * const canSearch = adapter.capabilities.search;
 * ```
 */
export function useEditorContext(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within an <Editor.Root> component.');
  }
  return context;
}
