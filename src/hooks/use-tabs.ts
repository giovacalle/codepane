// ---------------------------------------------------------------------------
// codepane — useTabs hook
// ---------------------------------------------------------------------------
// Provides reactive access to the tab bar state and actions for opening,
// closing, pinning, and switching between tabs.
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { useEditorStore } from '../core/context';
import type { Tab } from '../core/types';

export interface UseTabsReturn {
  /** Ordered list of currently open tabs. */
  tabs: Tab[];
  /** The currently active tab, or `null` if no tabs are open. */
  activeTab: Tab | null;
  /** The ID of the active tab, or `null`. */
  activeTabId: string | null;
  /** Open a file in a new tab (or activate an existing tab for that file). */
  openFile: (path: string, options?: { preview?: boolean }) => Promise<void>;
  /** Close a tab by its ID. */
  closeTab: (tabId: string) => void;
  /** Close all tabs except the specified one. */
  closeOtherTabs: (tabId: string) => void;
  /** Set a tab as the active (focused) tab. */
  setActiveTab: (tabId: string) => void;
  /** Whether the file associated with a tab has unsaved changes. */
  isDirty: (tabId: string) => boolean;
  /** Save the cursor position for a file path. */
  saveCursorPosition: (path: string, position: { line: number; col: number; scrollTop?: number }) => void;
  /** Get the saved cursor position for a file path, or null if none saved. */
  getCursorPosition: (path: string) => { line: number; col: number; scrollTop?: number } | null;
}

/**
 * Hook for interacting with the editor tab bar.
 *
 * Returns the current tabs, active tab, and actions for managing tabs.
 * Uses granular store selectors to minimize re-renders.
 *
 * @example
 * ```tsx
 * function MyTabBar() {
 *   const { tabs, activeTab, setActiveTab, closeTab } = useTabs();
 *
 *   return (
 *     <div>
 *       {tabs.map(tab => (
 *         <button
 *           key={tab.id}
 *           onClick={() => setActiveTab(tab.id)}
 *           style={{ fontWeight: tab.id === activeTab?.id ? 'bold' : 'normal' }}
 *         >
 *           {tab.label}
 *           {tab.isDirty && ' *'}
 *           <span onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>x</span>
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTabs(): UseTabsReturn {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const openFile = useEditorStore((s) => s.openFile);
  const closeTab = useEditorStore((s) => s.closeTab);
  const closeOtherTabs = useEditorStore((s) => s.closeOtherTabs);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const saveCursorPosition = useEditorStore((s) => s.saveCursorPosition);
  const getCursorPosition = useEditorStore((s) => s.getCursorPosition);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );

  const isDirty = useMemo(
    () =>
      (tabId: string): boolean => {
        const tab = tabs.find((t) => t.id === tabId);
        return tab?.isDirty ?? false;
      },
    [tabs]
  );

  return {
    tabs,
    activeTab,
    activeTabId,
    openFile,
    closeTab,
    closeOtherTabs,
    setActiveTab,
    isDirty,
    saveCursorPosition,
    getCursorPosition,
  };
}
