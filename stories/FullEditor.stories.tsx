import React, { useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Editor } from '../src'
import { createStoryAdapter, createStoryConfig } from './_helpers'

const meta: Meta = {
  title: 'Editor/Full Editor',
  parameters: { layout: 'fullscreen' },
}

export default meta

/**
 * Flex column wrapper for the right panel content.
 * Tabs/Breadcrumbs/StatusBar are fixed-height, Content fills the rest.
 */
const PanelColumn = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{children}</div>
)

const ContentArea = ({ children }: { children: React.ReactNode }) => (
  <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
)

export const Default: StoryObj = {
  render: () => {
    const adapter = createStoryAdapter()
    const config = createStoryConfig()

    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <Editor.Root
          adapter={adapter}
          config={config}
          rootPath=""
          defaultOpenFiles={['src/index.ts']}
        >
          <Editor.PanelGroup direction="horizontal">
            <Editor.Panel defaultSize={25} minSize={15}>
              <Editor.FileTree />
            </Editor.Panel>
            <Editor.PanelResizeHandle />
            <Editor.Panel defaultSize={75}>
              <PanelColumn>
                <Editor.Tabs />
                <Editor.Breadcrumbs />
                <ContentArea>
                  <Editor.Content />
                </ContentArea>
                <Editor.StatusBar />
              </PanelColumn>
            </Editor.Panel>
          </Editor.PanelGroup>
        </Editor.Root>
      </div>
    )
  },
}

export const WithCommandPalette: StoryObj = {
  render: function Render() {
    const adapter = createStoryAdapter()
    const config = createStoryConfig()
    const [open, setOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <Editor.Root
          adapter={adapter}
          config={config}
          rootPath=""
          defaultOpenFiles={['src/index.ts', 'src/utils/greet.ts']}
        >
          <Editor.PanelGroup direction="horizontal">
            <Editor.Panel defaultSize={25} minSize={15}>
              <Editor.FileTree />
            </Editor.Panel>
            <Editor.PanelResizeHandle />
            <Editor.Panel defaultSize={75}>
              <PanelColumn>
                <Editor.Tabs />
                <Editor.Breadcrumbs />
                <ContentArea>
                  <Editor.Content />
                </ContentArea>
                <Editor.StatusBar />
              </PanelColumn>
            </Editor.Panel>
          </Editor.PanelGroup>
          <button
            onClick={() => setOpen(true)}
            style={{
              position: 'fixed',
              top: 8,
              right: 8,
              zIndex: 100,
              padding: '6px 12px',
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Open Palette (Cmd+P)
          </button>
          {open && <Editor.CommandPalette onClose={() => setOpen(false)} inputRef={inputRef} />}
        </Editor.Root>
      </div>
    )
  },
}

export const MultipleFilesOpen: StoryObj = {
  render: () => {
    const adapter = createStoryAdapter()
    const config = createStoryConfig()

    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <Editor.Root
          adapter={adapter}
          config={config}
          rootPath=""
          defaultOpenFiles={[
            'src/index.ts',
            'src/components/Button.tsx',
            'src/utils/math.ts',
            'README.md',
          ]}
        >
          <Editor.PanelGroup direction="horizontal">
            <Editor.Panel defaultSize={25} minSize={15}>
              <Editor.FileTree />
            </Editor.Panel>
            <Editor.PanelResizeHandle />
            <Editor.Panel defaultSize={75}>
              <PanelColumn>
                <Editor.Tabs />
                <Editor.Breadcrumbs />
                <ContentArea>
                  <Editor.Content />
                </ContentArea>
                <Editor.StatusBar />
              </PanelColumn>
            </Editor.Panel>
          </Editor.PanelGroup>
        </Editor.Root>
      </div>
    )
  },
}
