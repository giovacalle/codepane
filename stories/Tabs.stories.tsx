import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Editor } from '../src'
import { createStoryAdapter, createStoryConfig } from './_helpers'

const meta: Meta = {
  title: 'Components/Tabs',
}

export default meta

const PanelColumn = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    {children}
  </div>
)

const ContentArea = ({ children }: { children: React.ReactNode }) => (
  <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
)

export const SingleTab: StoryObj = {
  render: () => {
    const adapter = createStoryAdapter()
    const config = createStoryConfig()

    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <Editor.Root
          adapter={adapter}
          config={config}
          defaultOpenFiles={['src/index.ts']}
        >
          <PanelColumn>
            <Editor.Tabs />
            <ContentArea>
              <Editor.Content />
            </ContentArea>
          </PanelColumn>
        </Editor.Root>
      </div>
    )
  },
}

export const MultipleTabs: StoryObj = {
  render: () => {
    const adapter = createStoryAdapter()
    const config = createStoryConfig()

    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <Editor.Root
          adapter={adapter}
          config={config}
          defaultOpenFiles={[
            'src/index.ts',
            'src/components/Button.tsx',
            'src/utils/math.ts',
            'src/hooks/useToggle.ts',
          ]}
        >
          <PanelColumn>
            <Editor.Tabs />
            <ContentArea>
              <Editor.Content />
            </ContentArea>
          </PanelColumn>
        </Editor.Root>
      </div>
    )
  },
}

export const NoTabs: StoryObj = {
  render: () => {
    const adapter = createStoryAdapter()
    const config = createStoryConfig()

    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <Editor.Root adapter={adapter} config={config} rootPath="">
          <PanelColumn>
            <Editor.Tabs />
            <ContentArea>
              <Editor.Content />
            </ContentArea>
          </PanelColumn>
        </Editor.Root>
      </div>
    )
  },
}
