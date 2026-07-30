import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import { LogOutput } from './log-output'
import { LogToolbar } from './log-toolbar'
import { defaultSelectedStep, groupLogs } from './log-model'
import { StepNavigation } from './step-navigation'
import type { SelectedStepMeta, TerminalLogViewerProps } from './types'
import { useWindowEvent } from '@/hooks/use-window-event'
import { useMountEffect } from '@/hooks/use-mount-effect'
import { useAutoScroll } from '@/hooks/use-auto-scroll'
import {
  isPerformanceCaptureEnabled,
  markPerformance,
  PERFORMANCE_MARKS,
  usePerformanceSurface,
} from '@/lib/performance-marks'
import { cn } from '@/lib/utils'

export default function TerminalLogViewer({
  logs,
  stepResults,
  isStreaming,
  fillAvailableHeight = false,
  isLoading = false,
  logsUnavailable = false,
  isTerminal = false,
}: TerminalLogViewerProps) {
  const [userSelectedStep, setUserSelectedStep] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [wrapLines, setWrapLines] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const firstRowsMarkedRef = useRef(false)
  const previousLogCountRef = useRef(logs.length)

  const { stepGroups, stepGroupsByName, allVisibleLogs, runningStepName } =
    useMemo(() => groupLogs(logs, stepResults), [logs, stepResults])

  const selectedStep = useMemo(() => {
    if (
      userSelectedStep === 'all' ||
      (userSelectedStep !== null && stepGroupsByName.has(userSelectedStep))
    ) {
      return userSelectedStep
    }
    return defaultSelectedStep(stepGroups, runningStepName)
  }, [userSelectedStep, stepGroups, stepGroupsByName, runningStepName])

  const selectedLogs = useMemo(
    () =>
      selectedStep === 'all'
        ? allVisibleLogs
        : (stepGroupsByName.get(selectedStep)?.logs ?? []),
    [selectedStep, allVisibleLogs, stepGroupsByName],
  )
  const filteredLogs = useMemo(() => {
    if (!deferredSearchQuery.trim()) return selectedLogs
    const query = deferredSearchQuery.toLowerCase()
    return selectedLogs.filter((chunk) =>
      chunk.content.toLowerCase().includes(query),
    )
  }, [selectedLogs, deferredSearchQuery])
  const selectedStepMeta: SelectedStepMeta | null = useMemo(() => {
    if (selectedStep === 'all') return null
    const group = stepGroupsByName.get(selectedStep)
    if (!group) return null
    return {
      command: group.command,
    }
  }, [selectedStep, stepGroupsByName])

  const virtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 20,
    overscan: 50,
  })
  useAutoScroll(virtualizer, filteredLogs.length, autoScroll)
  usePerformanceSurface('build-log-workbench', !isLoading && !logsUnavailable)

  const handleScroll = useCallback(() => {
    const element = scrollContainerRef.current
    if (!element) return
    setAutoScroll(
      element.scrollHeight - element.scrollTop - element.clientHeight < 40,
    )
  }, [])

  useMountEffect(() => {
    markPerformance(PERFORMANCE_MARKS.logViewerOpen, {
      surface: 'build-log-workbench',
    })

    const element = scrollContainerRef.current
    if (!element) return
    element.addEventListener('scroll', handleScroll)
    return () => element.removeEventListener('scroll', handleScroll)
  })

  useEffect(() => {
    const previousLogCount = previousLogCountRef.current
    previousLogCountRef.current = logs.length
    if (logs.length === 0 || !isPerformanceCaptureEnabled()) return

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const visibleRowCount = virtualizer.getVirtualItems().length
        if (!firstRowsMarkedRef.current && visibleRowCount > 0) {
          firstRowsMarkedRef.current = true
          markPerformance(PERFORMANCE_MARKS.firstVisibleLogRows, {
            surface: 'build-log-workbench',
            totalRowCount: logs.length,
            visibleRowCount,
          })
        }
        if (previousLogCount > 0 && logs.length > previousLogCount) {
          markPerformance(PERFORMANCE_MARKS.streamUpdateComplete, {
            surface: 'build-log-workbench',
            previousRowCount: previousLogCount,
            totalRowCount: logs.length,
            visibleRowCount,
          })
        }
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) window.cancelAnimationFrame(secondFrame)
    }
  }, [logs.length, virtualizer])

  useEffect(() => {
    if (!deferredSearchQuery || !isPerformanceCaptureEnabled()) return

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        markPerformance(PERFORMANCE_MARKS.logFilterReady, {
          surface: 'build-log-workbench',
          queryLength: deferredSearchQuery.length,
          resultCount: filteredLogs.length,
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) window.cancelAnimationFrame(secondFrame)
    }
  }, [deferredSearchQuery, filteredLogs.length])

  useWindowEvent('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const element = scrollContainerRef.current
      if (!element) return
      const rect = element.getBoundingClientRect()
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    if (event.key === 'Escape' && searchQuery) {
      setSearchQuery('')
      searchInputRef.current?.focus()
    }
  })

  const logStepGroups = stepGroups.filter((group) => group.logs.length > 0)
  const hasSteps = logStepGroups.length > 0
  function downloadRawLogs() {
    const blob = new Blob(
      [selectedLogs.map((chunk) => chunk.content).join('\n')],
      {
        type: 'text/plain',
      },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'build-logs.txt'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const lineCountLabel = deferredSearchQuery
    ? `${filteredLogs.length} of ${selectedLogs.length} lines`
    : `${selectedLogs.length} lines`

  return (
    <section
      aria-labelledby="build-logs-heading"
      className={cn(
        'flex flex-col overflow-hidden border bg-card',
        fillAvailableHeight
          ? 'h-full min-h-80'
          : 'h-[clamp(28rem,62dvh,50rem)]',
      )}
    >
      <div className="flex shrink-0 flex-col gap-2 border-b bg-muted/20 px-3 py-2 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-baseline gap-2">
          <h2 id="build-logs-heading" className="text-sm font-medium">
            Build logs
          </h2>
          {isStreaming ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full bg-success opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2 bg-success" />
              </span>
              Live
            </span>
          ) : (
            <span className="text-xs text-muted-foreground tabular-nums">
              {lineCountLabel}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 sm:ml-auto">
          <LogToolbar
            searchQuery={searchQuery}
            searchInputRef={searchInputRef}
            wrapLines={wrapLines}
            onSearchQueryChange={setSearchQuery}
            onSearchClear={() => setSearchQuery('')}
            onToggleWrap={() => setWrapLines((value) => !value)}
            onDownload={downloadRawLogs}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {hasSteps ? (
          <StepNavigation
            groups={logStepGroups}
            selectedStep={selectedStep}
            allLogCount={allVisibleLogs.length}
            onSelect={setUserSelectedStep}
          />
        ) : null}

        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <LogOutput
            logs={filteredLogs}
            selectedStep={selectedStep}
            selectedStepMeta={selectedStepMeta}
            searchQuery={deferredSearchQuery}
            isLoading={isLoading}
            logsUnavailable={logsUnavailable}
            isTerminal={isTerminal}
            wrapLines={wrapLines}
            scrollContainerRef={scrollContainerRef}
            virtualizer={virtualizer}
          />
        </div>
      </div>
    </section>
  )
}
