import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Editor } from '../src'
import { createStoryAdapter, createStoryConfig } from './_helpers'

const meta: Meta = {
  title: 'Components/FileTree',
}

export default meta

export const Default: StoryObj = {
  render: () => {
    const adapter = createStoryAdapter()
    const config = createStoryConfig()

    return (
      <div style={{ height: '100vh', width: 300, borderRight: '1px solid #333' }}>
        <Editor.Root adapter={adapter} config={config} rootPath="">
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Editor.FileTree />
          </div>
        </Editor.Root>
      </div>
    )
  },
}

export const WithContextMenu: StoryObj = {
  render: () => {
    const adapter = createStoryAdapter()
    const config = createStoryConfig()

    return (
      <div style={{ height: '100vh', width: 300, borderRight: '1px solid #333' }}>
        <Editor.Root adapter={adapter} config={config} rootPath="">
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Editor.FileTree />
          </div>
        </Editor.Root>
      </div>
    )
  },
}
