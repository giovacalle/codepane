import { getFileIcon } from '../../src/utils/file-icons';

describe('getFileIcon', () => {
  // -------------------------------------------------------------------------
  // Known extensions
  // -------------------------------------------------------------------------

  it.each([
    ['app.ts', 'TS'],
    ['app.js', 'JS'],
    ['main.py', 'Py'],
    ['lib.rs', 'Rs'],
    ['config.json', '{}'],
    ['style.css', '#'],
    ['index.html', '<>'],
  ])('returns the correct icon for %s', (name, expectedIcon) => {
    const result = getFileIcon(name, false);
    expect(result.icon).toBe(expectedIcon);
  });

  // -------------------------------------------------------------------------
  // Special file names override extension
  // -------------------------------------------------------------------------

  it.each([
    ['Dockerfile', '\u2693'],
    ['package.json', 'Np'],
    ['tsconfig.json', 'TS'],
    ['.gitignore', 'G'],
    ['Makefile', 'Mk'],
    ['LICENSE', '\u00A9'],
  ])('returns the special icon for %s', (name, expectedIcon) => {
    const result = getFileIcon(name, false);
    expect(result.icon).toBe(expectedIcon);
  });

  // -------------------------------------------------------------------------
  // Compound extensions
  // -------------------------------------------------------------------------

  it('returns DT for compound extension .d.ts', () => {
    const result = getFileIcon('types.d.ts', false);
    expect(result.icon).toBe('DT');
  });

  // -------------------------------------------------------------------------
  // Unknown extension
  // -------------------------------------------------------------------------

  it('returns the default icon for an unknown extension', () => {
    const result = getFileIcon('something.xyz', false);
    expect(result.icon).toBe('\u2758');
  });

  // -------------------------------------------------------------------------
  // Directories
  // -------------------------------------------------------------------------

  it('returns the closed folder icon for a non-expanded directory', () => {
    const result = getFileIcon('src', true, false);
    expect(result.icon).toBe('\uD83D\uDCC1');
  });

  it('returns the open folder icon for an expanded directory', () => {
    const result = getFileIcon('src', true, true);
    expect(result.icon).toBe('\uD83D\uDCC2');
  });

  // -------------------------------------------------------------------------
  // Case insensitivity for special names
  // -------------------------------------------------------------------------

  it.each(['Dockerfile', 'dockerfile', 'DOCKERFILE'])(
    'matches special name %s case-insensitively',
    (name) => {
      const result = getFileIcon(name, false);
      expect(result.icon).toBe('\u2693');
    }
  );
});
