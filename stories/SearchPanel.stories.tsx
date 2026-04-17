import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Editor } from '../src'
import { createStoryAdapter, createStoryConfig } from './_helpers'

const meta: Meta = {
  title: 'Components/SearchPanel',
}

export default meta

const PanelColumn = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{children}</div>
)

const ContentArea = ({ children }: { children: React.ReactNode }) => (
  <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
)

export const Default: StoryObj = {
  render: function Render() {
    const adapter = createStoryAdapter()
    const config = createStoryConfig()
    const [open, setOpen] = useState(true)

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
                <ContentArea>
                  <Editor.Content />
                </ContentArea>
              </PanelColumn>
            </Editor.Panel>
          </Editor.PanelGroup>
          {!open && (
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
              Open Search (Cmd+Shift+F)
            </button>
          )}
          {open && <Editor.SearchPanel onClose={() => setOpen(false)} />}
        </Editor.Root>
      </div>
    )
  },
}
