// ---------------------------------------------------------------------------
// codepane — useKeybindings hook
// ---------------------------------------------------------------------------
// Registers keyboard shortcuts and cleans them up on unmount. Supports
// modifier keys (ctrl, cmd/meta, shift, alt) and standard key names.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';

/** Describes a single keyboard shortcut binding. */
export interface KeyBinding {
  /**
   * Key combination string.
   *
   * Modifiers and key name are joined by `+`. Order of modifiers does not
   * matter. Examples: `"ctrl+s"`, `"cmd+p"`, `"ctrl+shift+f"`, `"escape"`.
   *
   * Supported modifiers: `ctrl`, `cmd` (maps to Meta), `meta`, `shift`, `alt`.
   */
  key: string;
  /** Action to execute when the key combination is pressed. */
  action: () => void;
  /**
   * Optional context predicate. When provided, the binding only fires
   * if this string matches the currently focused panel or context.
   * Reserved for future use.
   */
  when?: string;
}

interface ParsedBinding {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
  action: () => void;
  when?: string;
}

/**
 * Parse a key string like "ctrl+shift+s" into its constituent parts.
 */
function parseKeyString(keyString: string): Omit<ParsedBinding, 'action' | 'when'> {
  const parts = keyString
    .toLowerCase()
    .split('+')
    .map((p) => p.trim());

  let ctrl = false;
  let meta = false;
  let shift = false;
  let alt = false;
  let key = '';

  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'control':
        ctrl = true;
        break;
      case 'cmd':
      case 'meta':
      case 'command':
        meta = true;
        break;
      case 'shift':
        shift = true;
        break;
      case 'alt':
      case 'option':
        alt = true;
        break;
      default:
        key = part;
        break;
    }
  }

  return { ctrl, meta, shift, alt, key };
}

/**
 * Check whether a keyboard event matches a parsed binding.
 */
function matchesEvent(event: KeyboardEvent, binding: ParsedBinding): boolean {
  // Modifier checks
  if (binding.ctrl !== event.ctrlKey) return false;
  if (binding.meta !== event.metaKey) return false;
  if (binding.shift !== event.shiftKey) return false;
  if (binding.alt !== event.altKey) return false;

  // Key check (case-insensitive)
  const eventKey = event.key.toLowerCase();

  // Handle special key aliases
  const keyAliases: Record<string, string> = {
    esc: 'escape',
    enter: 'enter',
    return: 'enter',
    space: ' ',
    spacebar: ' ',
    up: 'arrowup',
    down: 'arrowdown',
    left: 'arrowleft',
    right: 'arrowright',
    del: 'delete',
    backspace: 'backspace',
    tab: 'tab',
  };

  const normalizedBindingKey = keyAliases[binding.key] ?? binding.key;
  const normalizedEventKey = keyAliases[eventKey] ?? eventKey;

  return normalizedBindingKey === normalizedEventKey;
}

/**
 * Register keyboard shortcuts that are active while the component is mounted.
 *
 * Bindings are matched against `keydown` events on the document. When a
 * binding matches, its `action` is called and the event's default behavior
 * is prevented. All listeners are cleaned up on unmount.
 *
 * @example
 * ```tsx
 * function EditorShortcuts() {
 *   const { saveFile } = useTabs();
 *
 *   useKeybindings([
 *     { key: 'ctrl+s', action: () => saveFile() },
 *     { key: 'cmd+s', action: () => saveFile() },
 *     { key: 'ctrl+shift+f', action: () => openSearch() },
 *     { key: 'escape', action: () => closePanel() },
 *   ]);
 *
 *   return null;
 * }
 * ```
 */
export function useKeybindings(bindings: KeyBinding[]): void {
  // Use a ref to always have the latest bindings without re-registering
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const currentBindings = bindingsRef.current;

      for (const binding of currentBindings) {
        const parsed: ParsedBinding = {
          ...parseKeyString(binding.key),
          action: binding.action,
          when: binding.when,
        };

        if (matchesEvent(event, parsed)) {
          event.preventDefault();
          event.stopPropagation();
          parsed.action();
          return;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []); // Empty deps: the ref ensures we always read the latest bindings
}
