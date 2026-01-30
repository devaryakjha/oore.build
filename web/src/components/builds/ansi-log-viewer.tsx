'use client'

import { useEffect, useRef, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ansiToHtml } from '@/lib/utils/ansi'
import { cn } from '@/lib/utils'
import {
  ArrowDown01Icon,
  Copy01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { toast } from 'sonner'

interface AnsiLogViewerProps {
  content: string
  className?: string
  maxHeight?: string
  autoScroll?: boolean
}

export function AnsiLogViewer({
  content,
  className,
  maxHeight = '400px',
  autoScroll: initialAutoScroll = true,
}: AnsiLogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLPreElement>(null)
  const [autoScroll, setAutoScroll] = useState(initialAutoScroll)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Convert ANSI to HTML - content is sanitized via escapeXML in the converter
  const htmlContent = ansiToHtml(content)

  // Auto-scroll when content changes
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]')
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [content, autoScroll])

  // Detect manual scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const isBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50
    setIsAtBottom(isBottom)
    if (!isBottom) {
      setAutoScroll(false)
    }
  }

  const scrollToBottom = () => {
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
      setAutoScroll(true)
      setIsAtBottom(true)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content)
    toast.success('Logs copied to clipboard')
  }

  if (!content) {
    return (
      <div className={cn('bg-black/50 p-4 font-mono text-xs text-muted-foreground', className)}>
        No output
      </div>
    )
  }

  return (
    <div className={cn('relative group', className)}>
      <ScrollArea
        ref={scrollRef}
        className="bg-black/50"
        style={{ maxHeight }}
        onScrollCapture={handleScroll}
      >
        <pre
          ref={contentRef}
          className="p-4 font-mono text-xs leading-relaxed text-gray-100 whitespace-pre-wrap break-all"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </ScrollArea>

      {/* Action buttons */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="secondary"
          size="icon"
          className="h-6 w-6 bg-black/80 hover:bg-black/90 border-0"
          onClick={copyToClipboard}
          aria-label="Copy logs"
        >
          <HugeiconsIcon icon={Copy01Icon} className="h-3 w-3" />
        </Button>
      </div>

      {/* Scroll to bottom indicator */}
      {!isAtBottom && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-2 right-2 h-7 bg-black/80 hover:bg-black/90 border-0 gap-1"
          onClick={scrollToBottom}
        >
          <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3" />
          <span className="text-xs">Scroll to bottom</span>
        </Button>
      )}
    </div>
  )
}
