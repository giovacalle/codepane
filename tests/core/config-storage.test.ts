import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMemoryConfigAdapter,
  createLocalStorageAdapter,
} from '../../src/core/config-storage';

// ---------------------------------------------------------------------------
// createMemoryConfigAdapter
// ---------------------------------------------------------------------------

describe('createMemoryConfigAdapter', () => {
  it('load returns null for a non-existent namespace', async () => {
    const adapter = createMemoryConfigAdapter();
    const result = await adapter.load('unknown');
    expect(result).toBeNull();
  });

  it('save then load returns the saved data', async () => {
    const adapter = createMemoryConfigAdapter();
    const data = { fontSize: 14, theme: 'dark' };

    await adapter.save('settings', data);
    const result = await adapter.load('settings');

    expect(result).toEqual(data);
  });

  it('save overwrites previous data', async () => {
    const adapter = createMemoryConfigAdapter();

    await adapter.save('ns', { v: 1 });
    await adapter.save('ns', { v: 2 });

    const result = await adapter.load('ns');
    expect(result).toEqual({ v: 2 });
  });

  it('subscribe fires callback on save', async () => {
    const adapter = createMemoryConfigAdapter();
    const cb = vi.fn();

    adapter.subscribe!('ns', cb);
    await adapter.save('ns', { a: 1 });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ a: 1 });
  });

  it('subscribe does NOT fire for a different namespace', async () => {
    const adapter = createMemoryConfigAdapter();
    const cb = vi.fn();

    adapter.subscribe!('ns-a', cb);
    await adapter.save('ns-b', { x: 1 });

    expect(cb).not.toHaveBeenCalled();
  });

  it('dispose stops the callback from firing', async () => {
    const adapter = createMemoryConfigAdapter();
    const cb = vi.fn();

    const disposable = adapter.subscribe!('ns', cb);
    disposable.dispose();

    await adapter.save('ns', { a: 1 });

    expect(cb).not.toHaveBeenCalled();
  });

  it('multiple subscribers all receive updates', async () => {
    const adapter = createMemoryConfigAdapter();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    adapter.subscribe!('ns', cb1);
    adapter.subscribe!('ns', cb2);

    await adapter.save('ns', 'hello');

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledWith('hello');
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith('hello');
  });
});

// ---------------------------------------------------------------------------
// createLocalStorageAdapter
// ---------------------------------------------------------------------------

describe('createLocalStorageAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses "editor" as the default prefix', async () => {
    const adapter = createLocalStorageAdapter();
    await adapter.save('theme', { dark: true });

    expect(localStorage.getItem('editor:theme')).toBe(
      JSON.stringify({ dark: true }),
    );
  });

  it('supports a custom prefix', async () => {
    const adapter = createLocalStorageAdapter({ prefix: 'my-app' });
    await adapter.save('layout', { panel: 50 });

    expect(localStorage.getItem('my-app:layout')).toBe(
      JSON.stringify({ panel: 50 }),
    );
  });

  it('load returns null when localStorage has no data', async () => {
    const adapter = createLocalStorageAdapter();
    const result = await adapter.load('missing');
    expect(result).toBeNull();
  });

  it('save stores JSON in localStorage', async () => {
    const adapter = createLocalStorageAdapter();
    const data = { fontSize: 14, wrap: true };
    await adapter.save('content', data);

    const raw = localStorage.getItem('editor:content');
    expect(raw).toBe(JSON.stringify(data));
  });

  it('load parses JSON from localStorage', async () => {
    localStorage.setItem('editor:settings', JSON.stringify({ a: 1, b: 'two' }));

    const adapter = createLocalStorageAdapter();
    const result = await adapter.load('settings');

    expect(result).toEqual({ a: 1, b: 'two' });
  });

  it('returns null for corrupted JSON without throwing', async () => {
    localStorage.setItem('editor:broken', '{not valid json!!!');

    const adapter = createLocalStorageAdapter();
    const result = await adapter.load('broken');

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createLocalStorageAdapter subscribe
// ---------------------------------------------------------------------------

describe('createLocalStorageAdapter subscribe', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('fires callback on storage event for matching key', () => {
    const adapter = createLocalStorageAdapter();
    const cb = vi.fn();

    adapter.subscribe!('test', cb);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'editor:test',
        newValue: JSON.stringify({ foo: 'bar' }),
        storageArea: localStorage,
      })
    );

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('ignores storage events for non-matching keys', () => {
    const adapter = createLocalStorageAdapter();
    const cb = vi.fn();

    adapter.subscribe!('test', cb);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'editor:other',
        newValue: JSON.stringify({ foo: 'bar' }),
        storageArea: localStorage,
      })
    );

    expect(cb).not.toHaveBeenCalled();
  });

  it('dispose stops callback from firing', () => {
    const adapter = createLocalStorageAdapter();
    const cb = vi.fn();

    const disposable = adapter.subscribe!('test', cb);
    disposable.dispose();

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'editor:test',
        newValue: JSON.stringify({ value: 1 }),
        storageArea: localStorage,
      })
    );

    expect(cb).not.toHaveBeenCalled();
  });

  it('handles corrupted JSON in storage event gracefully', () => {
    const adapter = createLocalStorageAdapter();
    const cb = vi.fn();

    adapter.subscribe!('test', cb);

    // Should not throw, and should not call callback
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'editor:test',
        newValue: '{not valid json!!!',
        storageArea: localStorage,
      })
    );

    expect(cb).not.toHaveBeenCalled();
  });
});
