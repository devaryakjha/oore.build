'use client'

import { useEffect, useState } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/error-boundary'
import { registerHumlLanguage, HUML_LANGUAGE_ID } from '@/lib/monaco/huml'
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

  // Register HUML language and configure Monaco editor theme
  useEffect(() => {
    if (monaco) {
      // Register HUML language support
      registerHumlLanguage(monaco)

      monaco.editor.defineTheme('oore-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
          { token: 'keyword', foreground: 'f59e0b' },
          { token: 'keyword.boolean', foreground: 'f59e0b' },
          { token: 'keyword.null', foreground: 'f59e0b' },
          { token: 'string', foreground: '22c55e' },
          { token: 'string.escape', foreground: '86efac' },
          { token: 'number', foreground: '3b82f6' },
          { token: 'number.hex', foreground: '60a5fa' },
          { token: 'number.special', foreground: 'f59e0b' },
          { token: 'type', foreground: 'a855f7' },
          { token: 'tag.vector', foreground: 'c084fc' },
          { token: 'tag.scalar', foreground: 'e879f9' },
          { token: 'tag.inline', foreground: 'e879f9' },
          { token: 'delimiter.vector', foreground: 'c084fc', fontStyle: 'bold' },
          { token: 'delimiter.scalar', foreground: '9ca3af' },
          { token: 'delimiter.list', foreground: 'f59e0b' },
          { token: 'meta.version', foreground: '6b7280', fontStyle: 'italic' },
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
          { token: 'keyword.boolean', foreground: 'b45309' },
          { token: 'keyword.null', foreground: 'b45309' },
          { token: 'string', foreground: '16a34a' },
          { token: 'string.escape', foreground: '15803d' },
          { token: 'number', foreground: '2563eb' },
          { token: 'number.hex', foreground: '1d4ed8' },
          { token: 'number.special', foreground: 'b45309' },
          { token: 'type', foreground: '9333ea' },
          { token: 'tag.vector', foreground: '7c3aed' },
          { token: 'tag.scalar', foreground: 'a855f7' },
          { token: 'tag.inline', foreground: 'a855f7' },
          { token: 'delimiter.vector', foreground: '7c3aed', fontStyle: 'bold' },
          { token: 'delimiter.scalar', foreground: '6b7280' },
          { token: 'delimiter.list', foreground: 'b45309' },
          { token: 'meta.version', foreground: '9ca3af', fontStyle: 'italic' },
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

  // Use proper language for each format
  const language = format === 'huml' ? HUML_LANGUAGE_ID : 'yaml'
  const theme = resolvedTheme === 'dark' ? 'oore-dark' : 'oore-light'

  const editorFallback = (
    <div
      className="flex flex-col items-center justify-center border border-border bg-muted/30 p-8"
      style={{ height }}
    >
      <p className="text-sm text-muted-foreground mb-4">
        Failed to load the code editor
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.location.reload()}
      >
        Reload page
      </Button>
    </div>
  )

  return (
    <ErrorBoundary fallback={editorFallback}>
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
    </ErrorBoundary>
  )
}
