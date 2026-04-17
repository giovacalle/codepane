# codepane

Composable, performance-first file explorer & code editor for React.

[![npm version](https://img.shields.io/npm/v/codepane)](https://www.npmjs.com/package/codepane)
[![CI](https://img.shields.io/github/actions/workflow/status/giovannicallegari/codepane/ci.yml?branch=main&label=CI)](https://github.com/giovannicallegari/codepane/actions)
[![License: MIT](https://img.shields.io/github/license/giovannicallegari/codepane)](./LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/codepane)](https://bundlephobia.com/package/codepane)

## Features

- 13 composable compound components (`Editor.Root`, `Editor.FileTree`, `Editor.Tabs`, and more)
- 9 headless hooks for building fully custom UIs
- Pluggable filesystem adapters (HTTP, in-memory, custom)
- CodeMirror 6 with 15+ language grammars (lazy-loaded)
- Virtualized file tree that handles 10,000+ files
- CSS custom properties theme system with [Zed](https://zed.dev)-inspired presets
- Built-in diff viewer (unified + split)
- Command palette, minimap, and context menus
- Zero Tailwind dependency -- inline styles + CSS vars only
- TypeScript-first with 40+ exported types

## Install

```bash
bun add codepane
# or
npm install codepane
```

## Quick Start

```tsx
import { Editor, createMemoryAdapter } from 'codepane'

const adapter = createMemoryAdapter({
  files: {
    'src/index.ts': 'console.log("hello")',
    'src/utils.ts': 'export const add = (a: number, b: number) => a + b',
    'package.json': '{ "name": "my-project" }',
  },
})

function App() {
  return (
    <Editor.Root adapter={adapter}>
      <Editor.PanelGroup direction="horizontal">
        <Editor.Panel defaultSize={25}>
          <Editor.FileTree />
        </Editor.Panel>
        <Editor.PanelResizeHandle />
        <Editor.Panel defaultSize={75}>
          <Editor.Tabs />
          <Editor.Content />
          <Editor.StatusBar />
        </Editor.Panel>
      </Editor.PanelGroup>
    </Editor.Root>
  )
}
```

## Headless Usage

If you need full control over the UI, use the hooks directly:

```tsx
import { useEditor, useFileTree, useTabs } from 'codepane'

function CustomEditor() {
  const { adapter } = useEditor()
  const { tree, expandDir, collapseDir } = useFileTree()
  const { tabs, activeTabId, openFile, closeTab } = useTabs()
  // Build your own UI with full control
}
```

All 9 hooks (`useEditor`, `useFileTree`, `useTabs`, `useSearch`, `useTheme`, `useKeybindings`, `useConfig`, `useContextMenu`, `useCommandPalette`) are available for headless usage.

## Adapters

codepane uses filesystem adapters to read and write files. Two built-in adapters are included.

### In-Memory Adapter

Pass a plain object of file paths and contents. Useful for demos, playgrounds, and tests.

```tsx
import { createMemoryAdapter } from 'codepane'

const adapter = createMemoryAdapter({
  files: {
    'README.md': '# Hello',
    'src/index.ts': 'export default {}',
  },
})
```

### HTTP Adapter

Fetch files from a remote server. Provide a base URL and codepane handles the rest.

```tsx
import { createHttpAdapter } from 'codepane'

const adapter = createHttpAdapter({
  baseUrl: 'https://api.example.com/repos/my-repo',
  headers: { Authorization: 'Bearer token' },
})
```

You can also implement a custom adapter by conforming to the `FilesystemAdapter` interface.

## Theming

codepane ships with a CSS custom properties theme system and Zed-inspired presets.

```tsx
import { Editor, defaultDarkTheme, defaultLightTheme, mergeTheme } from 'codepane'

// Use a built-in theme
<Editor.Root theme={defaultDarkTheme}>
  {/* ... */}
</Editor.Root>

// Extend a theme with custom overrides
const customTheme = mergeTheme(defaultDarkTheme, {
  colors: {
    'editor.background': '#1a1a2e',
    'editor.foreground': '#e0e0e0',
  },
})

<Editor.Root theme={customTheme}>
  {/* ... */}
</Editor.Root>
```

All theme tokens are exposed as CSS custom properties, so you can also override them in plain CSS.

## Components

| Component                  | Description                                                |
| -------------------------- | ---------------------------------------------------------- |
| `Editor.Root`              | Top-level provider that accepts an adapter and theme       |
| `Editor.FileTree`          | Virtualized, collapsible file tree sidebar                 |
| `Editor.Tabs`              | Tab bar for open files with drag-to-reorder                |
| `Editor.Content`           | CodeMirror 6 editor pane for the active file               |
| `Editor.Breadcrumbs`       | Path breadcrumb navigation for the active file             |
| `Editor.StatusBar`         | Bottom bar showing cursor position, language, and encoding |
| `Editor.CommandPalette`    | Fuzzy-search command palette overlay                       |
| `Editor.Minimap`           | Scaled-down code overview in the editor gutter             |
| `Editor.DiffViewer`        | Side-by-side or unified diff view for two file versions    |
| `Editor.Panel`             | Resizable layout panel                                     |
| `Editor.PanelGroup`        | Container that arranges panels horizontally or vertically  |
| `Editor.PanelResizeHandle` | Draggable handle between panels                            |
| `Editor.ContextMenu`       | Right-click context menu with customizable actions         |

## Hooks

| Hook                | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `useEditor`         | Access the editor instance, adapter, and top-level state  |
| `useFileTree`       | Read the file tree and control expand/collapse state      |
| `useTabs`           | Manage open tabs, active tab, and tab ordering            |
| `useSearch`         | Trigger file and text search across the workspace         |
| `useTheme`          | Read and update the active theme at runtime               |
| `useKeybindings`    | Register and override keyboard shortcuts                  |
| `useConfig`         | Access and modify editor configuration                    |
| `useContextMenu`    | Control context menu visibility and register custom items |
| `useCommandPalette` | Open the command palette and register custom commands     |

## Contributing

Contributions are welcome! Please read the [Contributing Guide](./CONTRIBUTING.md) before opening a pull request.

## License

[MIT](./LICENSE)
