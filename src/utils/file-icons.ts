// ---------------------------------------------------------------------------
// codepane — File Icon Mapping
// ---------------------------------------------------------------------------
// Maps file extensions and directory state to simple unicode characters and
// colors. Intentionally zero external dependencies — the consumer can
// override via the `renderIcon` prop on `Editor.FileTree`.
// ---------------------------------------------------------------------------

/** Icon descriptor returned by `getFileIcon`. */
export interface FileIconDescriptor {
  /** Unicode character or short string to render as the icon */
  icon: string
  /** CSS color value for the icon */
  color: string
}

// ---------------------------------------------------------------------------
// Extension -> icon/color mapping
// ---------------------------------------------------------------------------

const EXT_MAP: Record<string, FileIconDescriptor> = {
  // TypeScript
  ts: { icon: 'TS', color: '#3178c6' },
  tsx: { icon: 'TX', color: '#3178c6' },
  mts: { icon: 'TS', color: '#3178c6' },
  cts: { icon: 'TS', color: '#3178c6' },
  'd.ts': { icon: 'DT', color: '#3178c6' },

  // JavaScript
  js: { icon: 'JS', color: '#f7df1e' },
  jsx: { icon: 'JX', color: '#f7df1e' },
  mjs: { icon: 'JS', color: '#f7df1e' },
  cjs: { icon: 'JS', color: '#f7df1e' },

  // Python
  py: { icon: 'Py', color: '#3776ab' },
  pyw: { icon: 'Py', color: '#3776ab' },
  pyi: { icon: 'Py', color: '#3776ab' },

  // Rust
  rs: { icon: 'Rs', color: '#ce412b' },
  toml: { icon: '\u2699', color: '#9c9c9c' }, // ⚙

  // Go
  go: { icon: 'Go', color: '#00add8' },

  // Data / config
  json: { icon: '{}', color: '#f7df1e' },
  jsonc: { icon: '{}', color: '#f7df1e' },
  json5: { icon: '{}', color: '#f7df1e' },

  // Markdown / docs
  md: { icon: 'M\u2193', color: '#9e9e9e' }, // M↓
  mdx: { icon: 'MX', color: '#9e9e9e' },
  txt: { icon: '\u2261', color: '#9e9e9e' }, // ≡

  // Styles
  css: { icon: '#', color: '#ce679a' },
  scss: { icon: 'S#', color: '#ce679a' },
  sass: { icon: 'Sa', color: '#ce679a' },
  less: { icon: 'Le', color: '#ce679a' },
  styl: { icon: 'St', color: '#ce679a' },

  // HTML / templates
  html: { icon: '<>', color: '#e34c26' },
  htm: { icon: '<>', color: '#e34c26' },
  vue: { icon: 'V', color: '#41b883' },
  svelte: { icon: 'Sv', color: '#ff3e00' },

  // YAML
  yml: { icon: 'Y', color: '#9e9e9e' },
  yaml: { icon: 'Y', color: '#9e9e9e' },

  // Shell
  sh: { icon: '$', color: '#4eaa25' },
  bash: { icon: '$', color: '#4eaa25' },
  zsh: { icon: '$', color: '#4eaa25' },
  fish: { icon: '$', color: '#4eaa25' },

  // Images
  png: { icon: '\u25A3', color: '#a259ff' }, // ▣
  jpg: { icon: '\u25A3', color: '#a259ff' },
  jpeg: { icon: '\u25A3', color: '#a259ff' },
  gif: { icon: '\u25A3', color: '#a259ff' },
  svg: { icon: '\u25CA', color: '#a259ff' }, // ◊
  ico: { icon: '\u25A3', color: '#a259ff' },
  webp: { icon: '\u25A3', color: '#a259ff' },

  // Java / JVM
  java: { icon: 'Ja', color: '#b07219' },
  kt: { icon: 'Kt', color: '#a97bff' },
  scala: { icon: 'Sc', color: '#c22d40' },

  // C / C++
  c: { icon: 'C', color: '#555555' },
  h: { icon: 'H', color: '#555555' },
  cpp: { icon: 'C+', color: '#f34b7d' },
  hpp: { icon: 'H+', color: '#f34b7d' },

  // C#
  cs: { icon: 'C#', color: '#178600' },

  // Ruby
  rb: { icon: 'Rb', color: '#cc342d' },
  erb: { icon: 'Rb', color: '#cc342d' },

  // PHP
  php: { icon: 'Ph', color: '#777bb4' },

  // Swift
  swift: { icon: 'Sw', color: '#f05138' },

  // Dart
  dart: { icon: 'Da', color: '#00b4ab' },

  // SQL
  sql: { icon: 'SQ', color: '#e38c00' },

  // Docker
  dockerfile: { icon: '\u2693', color: '#2496ed' }, // ⚓

  // Lock files
  lock: { icon: '\u26BF', color: '#6c6c6c' }, // ⚿

  // XML
  xml: { icon: '<>', color: '#e37933' },

  // Env
  env: { icon: '\u2699', color: '#ecd53f' }, // ⚙

  // GraphQL
  graphql: { icon: 'Gq', color: '#e10098' },
  gql: { icon: 'Gq', color: '#e10098' },

  // Protobuf
  proto: { icon: 'Pb', color: '#6c6c6c' },

  // Wasm
  wasm: { icon: 'Wa', color: '#654ff0' },
}

// ---------------------------------------------------------------------------
// Special file names (full match, case-insensitive)
// ---------------------------------------------------------------------------

const NAME_MAP: Record<string, FileIconDescriptor> = {
  dockerfile: { icon: '\u2693', color: '#2496ed' },
  'docker-compose.yml': { icon: '\u2693', color: '#2496ed' },
  'docker-compose.yaml': { icon: '\u2693', color: '#2496ed' },
  makefile: { icon: 'Mk', color: '#6c6c6c' },
  license: { icon: '\u00A9', color: '#9e9e9e' }, // ©
  '.gitignore': { icon: 'G', color: '#f05032' },
  '.gitattributes': { icon: 'G', color: '#f05032' },
  '.env': { icon: '\u2699', color: '#ecd53f' },
  '.env.local': { icon: '\u2699', color: '#ecd53f' },
  '.eslintrc': { icon: 'Es', color: '#4b32c3' },
  '.prettierrc': { icon: 'Pr', color: '#56b3b4' },
  'tsconfig.json': { icon: 'TS', color: '#3178c6' },
  'package.json': { icon: 'Np', color: '#cb3837' },
  'vite.config.ts': { icon: '\u26A1', color: '#bd34fe' }, // ⚡
  'vite.config.js': { icon: '\u26A1', color: '#bd34fe' },
}

/** Default icon for files with unknown extensions. */
const DEFAULT_ICON: FileIconDescriptor = { icon: '\u2758', color: '#9e9e9e' } // ❘

/** Directory icons. */
const DIR_CLOSED: FileIconDescriptor = { icon: '\uD83D\uDCC1', color: '#89b4fa' } // 📁
const DIR_OPEN: FileIconDescriptor = { icon: '\uD83D\uDCC2', color: '#89b4fa' } // 📂

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get an icon descriptor for a file or directory based on its name and state.
 *
 * @param name - File or directory name (e.g. "Button.tsx")
 * @param isDirectory - Whether the entry is a directory
 * @param isExpanded - Whether the directory is currently expanded (ignored for files)
 */
export function getFileIcon(
  name: string,
  isDirectory: boolean,
  isExpanded?: boolean,
): FileIconDescriptor {
  if (isDirectory) {
    return isExpanded ? DIR_OPEN : DIR_CLOSED
  }

  // Check special file names first (case-insensitive)
  const lowerName = name.toLowerCase()
  const nameMatch = NAME_MAP[lowerName]
  if (nameMatch) return nameMatch

  // Check compound extensions (e.g. ".d.ts")
  const dotParts = name.split('.')
  if (dotParts.length >= 3) {
    const compoundExt = dotParts.slice(-2).join('.')
    const compoundMatch = EXT_MAP[compoundExt]
    if (compoundMatch) return compoundMatch
  }

  // Check simple extension
  const lastDot = name.lastIndexOf('.')
  if (lastDot !== -1) {
    const ext = name.slice(lastDot + 1).toLowerCase()
    const extMatch = EXT_MAP[ext]
    if (extMatch) return extMatch
  }

  return DEFAULT_ICON
}
