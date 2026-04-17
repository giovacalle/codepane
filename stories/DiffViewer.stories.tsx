import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Editor } from '../src'
import { createMemoryAdapter } from '../src/adapters/memory-adapter'
import { createStoryConfig } from './_helpers'

const meta: Meta = {
  title: 'Components/DiffViewer',
}

export default meta

const original = `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function farewell(name: string): string {
  return \`Goodbye, \${name}!\`
}
`

const modified = `export function greet(name: string, greeting = 'Hello'): string {
  return \`\${greeting}, \${name}!\`
}

export function farewell(name: string): string {
  return \`Goodbye, \${name}! See you soon.\`
}

export function wave(name: string): string {
  return \`*waves at \${name}*\`
}
`

export const Unified: StoryObj = {
  render: () => {
    const adapter = createMemoryAdapter({ files: { 'file.ts': original } })
    const config = createStoryConfig()

    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <Editor.Root adapter={adapter} config={config} rootPath="">
          <Editor.DiffViewer oldContent={original} newContent={modified} filePath="greet.ts" />
        </Editor.Root>
      </div>
    )
  },
}

export const SplitView: StoryObj = {
  render: () => {
    const adapter = createMemoryAdapter({ files: { 'file.ts': original } })
    const config = createStoryConfig()

    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <Editor.Root adapter={adapter} config={config} rootPath="">
          <Editor.DiffViewer
            oldContent={original}
            newContent={modified}
            filePath="greet.ts"
            mode="split"
          />
        </Editor.Root>
      </div>
    )
  },
}
