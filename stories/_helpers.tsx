import { createMemoryAdapter } from '../src/adapters/memory-adapter'
import { createMemoryConfigAdapter } from '../src/core/config-storage'

export const sampleFiles: Record<string, string> = {
  'src/index.ts': `import { greet } from './utils/greet'
import { Button } from './components/Button'

export { greet, Button }
`,
  'src/utils/greet.ts': `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function farewell(name: string): string {
  return \`Goodbye, \${name}!\`
}
`,
  'src/utils/math.ts': `export const add = (a: number, b: number) => a + b
export const subtract = (a: number, b: number) => a - b
export const multiply = (a: number, b: number) => a * b

export function fibonacci(n: number): number {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}
`,
  'src/components/Button.tsx': `import React from 'react'

interface ButtonProps {
  label: string
  variant?: 'primary' | 'secondary'
  onClick?: () => void
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  onClick,
}) => {
  return (
    <button
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
`,
  'src/components/Card.tsx': `import React from 'react'

interface CardProps {
  title: string
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ title, children }) => {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="card-body">{children}</div>
    </div>
  )
}
`,
  'src/hooks/useToggle.ts': `import { useState, useCallback } from 'react'

export function useToggle(initial = false) {
  const [value, setValue] = useState(initial)
  const toggle = useCallback(() => setValue((v) => !v), [])
  return [value, toggle] as const
}
`,
  'README.md': `# Sample Project

A demo project for codepane stories.

## Getting Started

\`\`\`bash
npm install
npm start
\`\`\`
`,
  'package.json': `{
  "name": "sample-project",
  "version": "1.0.0",
  "main": "src/index.ts"
}
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "strict": true,
    "jsx": "react-jsx"
  }
}
`,
}

export function createStoryAdapter() {
  return createMemoryAdapter({ files: sampleFiles })
}

export function createStoryConfig() {
  return {
    storage: createMemoryConfigAdapter(),
    disabled: false,
  }
}
