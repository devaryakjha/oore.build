'use client'

import { useEffect, useState } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import { Skeleton } from '@/components/ui/skeleton'
import type { ConfigFormat } from '@/lib/api/types'

interface PipelineEditorProps {
  value: string
  onChange: (value: string) => void
  format: ConfigFormat
  readOnly?: boolean
  height?: string
}

export function PipelineEditor({
  value,
  onChange,
  format,
  readOnly = false,
  height = '400px',
}: PipelineEditorProps) {
  const { resolvedTheme } = useTheme()
  const monaco = useMonaco()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Configure Monaco editor theme
  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('oore-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
          { token: 'keyword', foreground: 'f59e0b' },
          { token: 'string', foreground: '22c55e' },
          { token: 'number', foreground: '3b82f6' },
          { token: 'type', foreground: 'a855f7' },
        ],
        colors: {
          'editor.background': '#0a0a0a',
          'editor.foreground': '#f5f5f5',
          'editor.lineHighlightBackground': '#1a1a1a',
          'editor.selectionBackground': '#374151',
          'editorLineNumber.foreground': '#4b5563',
          'editorLineNumber.activeForeground': '#9ca3af',
          'editorCursor.foreground': '#f59e0b',
          'editor.inactiveSelectionBackground': '#1f2937',
        },
      })

      monaco.editor.defineTheme('oore-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
          { token: 'keyword', foreground: 'b45309' },
          { token: 'string', foreground: '16a34a' },
          { token: 'number', foreground: '2563eb' },
          { token: 'type', foreground: '9333ea' },
        ],
        colors: {
          'editor.background': '#fafafa',
          'editor.foreground': '#1f2937',
          'editor.lineHighlightBackground': '#f3f4f6',
          'editor.selectionBackground': '#d1d5db',
          'editorLineNumber.foreground': '#9ca3af',
          'editorLineNumber.activeForeground': '#4b5563',
          'editorCursor.foreground': '#b45309',
        },
      })
    }
  }, [monaco])

  if (!mounted) {
    return <Skeleton className="w-full" style={{ height }} />
  }

  // HUML uses YAML-like syntax for highlighting
  const language = format === 'huml' ? 'yaml' : 'yaml'
  const theme = resolvedTheme === 'dark' ? 'oore-dark' : 'oore-light'

  return (
    <div className="border border-border overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        theme={theme}
        onChange={(val) => onChange(val ?? '')}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: 'var(--font-geist-mono), JetBrains Mono, monospace',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 12, bottom: 12 },
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
        loading={<Skeleton className="w-full" style={{ height }} />}
      />
    </div>
  )
}
