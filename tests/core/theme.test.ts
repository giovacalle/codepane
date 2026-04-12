import { describe, it, expect, beforeEach } from 'vitest';
import {
  mergeTheme,
  defaultDarkTheme,
  defaultLightTheme,
  applyThemeToElement,
  removeThemeFromElement,
} from '../../src/core/theme';

// ---------------------------------------------------------------------------
// mergeTheme
// ---------------------------------------------------------------------------

describe('mergeTheme', () => {
  it('returns base unchanged when overrides are empty', () => {
    const result = mergeTheme(defaultDarkTheme, {});
    expect(result).toEqual(defaultDarkTheme);
  });

  it('overrides a single color', () => {
    const result = mergeTheme(defaultDarkTheme, {
      colors: { background: '#000' },
    });

    expect(result.colors.background).toBe('#000');
    // Other colors remain untouched
    expect(result.colors.foreground).toBe(defaultDarkTheme.colors.foreground);
    expect(result.colors.accent).toBe(defaultDarkTheme.colors.accent);
  });

  it('overrides a nested font property while preserving others', () => {
    const result = mergeTheme(defaultDarkTheme, {
      fonts: { monoSize: 16 },
    });

    expect(result.fonts.monoSize).toBe(16);
    expect(result.fonts.mono).toBe(defaultDarkTheme.fonts.mono);
    expect(result.fonts.ui).toBe(defaultDarkTheme.fonts.ui);
    expect(result.fonts.uiSize).toBe(defaultDarkTheme.fonts.uiSize);
  });

  it('overrides a primitive (borderRadius)', () => {
    const result = mergeTheme(defaultDarkTheme, { borderRadius: 10 });

    expect(result.borderRadius).toBe(10);
    // Rest unchanged
    expect(result.colors).toEqual(defaultDarkTheme.colors);
    expect(result.fonts).toEqual(defaultDarkTheme.fonts);
  });

  it('does NOT mutate the base object', () => {
    const originalBackground = defaultDarkTheme.colors.background;
    const originalRadius = defaultDarkTheme.borderRadius;

    mergeTheme(defaultDarkTheme, {
      colors: { background: '#fff' },
      borderRadius: 99,
    });

    expect(defaultDarkTheme.colors.background).toBe(originalBackground);
    expect(defaultDarkTheme.borderRadius).toBe(originalRadius);
  });

  it('applies multiple nested overrides at once', () => {
    const result = mergeTheme(defaultDarkTheme, {
      colors: { background: '#111', accent: '#222' },
      fonts: { monoSize: 18, uiSize: 15 },
      spacing: { treeIndent: 24 },
      borderRadius: 12,
    });

    expect(result.colors.background).toBe('#111');
    expect(result.colors.accent).toBe('#222');
    expect(result.colors.foreground).toBe(defaultDarkTheme.colors.foreground);
    expect(result.fonts.monoSize).toBe(18);
    expect(result.fonts.uiSize).toBe(15);
    expect(result.fonts.mono).toBe(defaultDarkTheme.fonts.mono);
    expect(result.spacing.treeIndent).toBe(24);
    expect(result.spacing.treeItemHeight).toBe(defaultDarkTheme.spacing.treeItemHeight);
    expect(result.borderRadius).toBe(12);
  });

  it('skips undefined values in overrides', () => {
    const result = mergeTheme(defaultDarkTheme, {
      colors: { background: undefined },
      borderRadius: undefined,
    });

    expect(result.colors.background).toBe(defaultDarkTheme.colors.background);
    expect(result.borderRadius).toBe(defaultDarkTheme.borderRadius);
  });
});

// ---------------------------------------------------------------------------
// applyThemeToElement / removeThemeFromElement
// ---------------------------------------------------------------------------

describe('applyThemeToElement', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
  });

  it('sets CSS custom properties on the element', () => {
    applyThemeToElement(el, defaultDarkTheme);

    expect(el.style.getPropertyValue('--editor-color-background')).toBe(
      defaultDarkTheme.colors.background,
    );
    expect(el.style.getPropertyValue('--editor-font-mono')).toBe(
      defaultDarkTheme.fonts.mono,
    );
    expect(el.style.getPropertyValue('--editor-spacing-tree-indent')).toBe(
      `${defaultDarkTheme.spacing.treeIndent}px`,
    );
    expect(el.style.getPropertyValue('--editor-border-radius')).toBe(
      `${defaultDarkTheme.borderRadius}px`,
    );
  });

  it('sets the data-editor-themed attribute', () => {
    applyThemeToElement(el, defaultDarkTheme);
    expect(el.hasAttribute('data-editor-themed')).toBe(true);
  });

  it('converts camelCase color keys to kebab-case CSS vars', () => {
    applyThemeToElement(el, defaultDarkTheme);

    expect(el.style.getPropertyValue('--editor-color-editor-background')).toBe(
      defaultDarkTheme.colors.editorBackground,
    );
    expect(el.style.getPropertyValue('--editor-color-tree-hover')).toBe(
      defaultDarkTheme.colors.treeHover,
    );
    expect(el.style.getPropertyValue('--editor-color-status-bar-background')).toBe(
      defaultDarkTheme.colors.statusBarBackground,
    );
  });
});

describe('removeThemeFromElement', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
  });

  it('clears all CSS custom properties that were set', () => {
    applyThemeToElement(el, defaultDarkTheme);
    removeThemeFromElement(el);

    expect(el.style.getPropertyValue('--editor-color-background')).toBe('');
    expect(el.style.getPropertyValue('--editor-font-mono')).toBe('');
    expect(el.style.getPropertyValue('--editor-border-radius')).toBe('');
  });

  it('clears the data-editor-themed attribute', () => {
    applyThemeToElement(el, defaultDarkTheme);
    removeThemeFromElement(el);

    expect(el.hasAttribute('data-editor-themed')).toBe(false);
  });

  it('leaves no editor CSS vars after apply -> remove', () => {
    applyThemeToElement(el, defaultDarkTheme);
    removeThemeFromElement(el);

    // The style attribute should be empty (or contain nothing meaningful)
    const styleText = el.getAttribute('style') ?? '';
    expect(styleText).not.toContain('--editor');
  });

  it('is a no-op on an element that was never themed', () => {
    // Should not throw
    expect(() => removeThemeFromElement(el)).not.toThrow();
    expect(el.hasAttribute('data-editor-themed')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Default themes
// ---------------------------------------------------------------------------

describe('defaultDarkTheme', () => {
  it('has all required top-level properties', () => {
    expect(defaultDarkTheme).toHaveProperty('colors');
    expect(defaultDarkTheme).toHaveProperty('fonts');
    expect(defaultDarkTheme).toHaveProperty('spacing');
    expect(defaultDarkTheme).toHaveProperty('borderRadius');
  });

  it('has colors, fonts, and spacing as objects with keys', () => {
    expect(Object.keys(defaultDarkTheme.colors).length).toBeGreaterThan(0);
    expect(Object.keys(defaultDarkTheme.fonts).length).toBeGreaterThan(0);
    expect(Object.keys(defaultDarkTheme.spacing).length).toBeGreaterThan(0);
  });
});

describe('defaultLightTheme', () => {
  it('has all required top-level properties', () => {
    expect(defaultLightTheme).toHaveProperty('colors');
    expect(defaultLightTheme).toHaveProperty('fonts');
    expect(defaultLightTheme).toHaveProperty('spacing');
    expect(defaultLightTheme).toHaveProperty('borderRadius');
  });

  it('has colors, fonts, and spacing as objects with keys', () => {
    expect(Object.keys(defaultLightTheme.colors).length).toBeGreaterThan(0);
    expect(Object.keys(defaultLightTheme.fonts).length).toBeGreaterThan(0);
    expect(Object.keys(defaultLightTheme.spacing).length).toBeGreaterThan(0);
  });
});
