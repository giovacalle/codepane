# codepane

## Language

All code, comments, docs, and commit messages MUST be in English.

## Architecture

Compound component library — every UI component MUST be rendered inside `<Editor.Root>` which creates an isolated Zustand store. Multiple `<Editor.Root>` instances can coexist on the same page.

**State flow**: components read/write state via `useEditorStore` (Zustand). Never pass state between sibling components via props — always go through the store.

**Filesystem abstraction**: all file I/O goes through a `FileSystemAdapter`. Never access files directly. Two built-in adapters: `createMemoryAdapter` (tests/stories) and `createHttpAdapter` (production).

## Conventions

- Components live in `src/components/`, hooks in `src/hooks/`, one per file
- Component files export a named component (not default export) and its props interface
- Hooks follow `use-{name}.ts` naming and export `use{Name}` + `Use{Name}Return` type
- All components use `React.memo` and inline styles (no Tailwind, no CSS modules)
- Theme is applied via CSS custom properties on the root element + passed through context

## Language support

Language grammars (`@codemirror/lang-*`) are optional peer dependencies, lazy-loaded via `import()` in `src/utils/language-map.ts`. Consumers install only what they need. Custom languages can be registered via `registerLanguage()`.

## Testing

- `bun run test` — Vitest + happy-dom
- Tests in `tests/` mirror src structure
- Integration tests for components go in `tests/components/`
- CodeMirror cannot be tested in happy-dom (no DOM measurement APIs) — stub `Editor.Content` in component tests

## Build & publish

- `bun run build` — tsup (ESM + CJS + DTS)
- `bun run storybook` — Storybook 10 (dev only, not published)
- Release via changesets: `bunx changeset` → PR → merge → auto-publish

## What NOT to do

- Don't add Tailwind or any CSS framework
- Don't add dependencies without checking bundle impact — this library ships to consumers
- Don't make components work outside of `<Editor.Root>` — compound pattern is intentional
- Don't import `@codemirror/lang-*` packages at top level — always dynamic `import()`
