'use client'

import { useState, useEffect } from 'react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { StepStatusBadge } from './step-status-badge'
import { AnsiLogViewer } from './ansi-log-viewer'
import { useBuildStepLogs } from '@/lib/api/builds'
import { calculateDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BuildStep, StepStatus } from '@/lib/api/types'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ComputerTerminal01Icon,
  Download01Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

interface BuildStepItemProps {
  buildId: string
  step: BuildStep
  defaultExpanded?: boolean
}

// System step constants (must match backend)
const CLONE_STEP_INDEX = -2
const CLEANUP_STEP_INDEX = 2147483646 // i32::MAX - 1

function isSystemStep(stepIndex: number): boolean {
  return stepIndex === CLONE_STEP_INDEX || stepIndex === CLEANUP_STEP_INDEX
}

function getStepIcon(stepIndex: number) {
  if (stepIndex === CLONE_STEP_INDEX) return Download01Icon
  if (stepIndex === CLEANUP_STEP_INDEX) return Delete02Icon
  return ComputerTerminal01Icon
}

export function BuildStepItem({ buildId, step, defaultExpanded = false }: BuildStepItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const isSystem = isSystemStep(step.step_index)
  const StepIcon = getStepIcon(step.step_index)
  const isStepRunning = step.status === 'running'

  // Auto-expand when step starts running
  useEffect(() => {
    if (isStepRunning) {
      setExpanded(true)
    }
  }, [isStepRunning])

  // Only fetch logs when expanded
  const { data: logs, isLoading: logsLoading } = useBuildStepLogs(
    expanded ? buildId : null,
    expanded ? step.step_index : null,
    isStepRunning
  )

  // Calculate duration
  const getDuration = () => {
    if (step.finished_at && step.started_at) {
      return calculateDuration(step.started_at, step.finished_at)
    }
    if (step.started_at && step.status === 'running') {
      return calculateDuration(step.started_at, new Date().toISOString())
    }
    return null
  }

  const duration = getDuration()

  // Combine stdout and stderr
  const stdout = logs?.find(l => l.stream === 'stdout')?.content ?? ''
  const stderr = logs?.find(l => l.stream === 'stderr')?.content ?? ''
  const combinedLogs = [stdout, stderr].filter(Boolean).join('\n')

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="w-full" aria-label={`${expanded ? 'Collapse' : 'Expand'} step: ${step.name}`}>
        <div
          className={cn(
            'flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer border-l-2',
            step.status === 'success' && 'border-l-green-500',
            step.status === 'failure' && 'border-l-destructive',
            step.status === 'running' && 'border-l-chart-2',
            step.status === 'pending' && 'border-l-chart-1',
            step.status === 'skipped' && 'border-l-muted-foreground',
            step.status === 'cancelled' && 'border-l-muted-foreground'
          )}
        >
          <div className="flex items-center gap-3">
            <HugeiconsIcon
              icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
              className="h-4 w-4 text-muted-foreground"
            />
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={StepIcon} className={cn(
                "h-4 w-4",
                isSystem ? "text-chart-2" : "text-muted-foreground"
              )} />
              <span className={cn(
                "font-medium text-sm",
                isSystem && "text-muted-foreground italic"
              )}>
                {step.name}
              </span>
              {isSystem && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 font-medium">
                  System
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {duration && (
              <span className="text-xs text-muted-foreground font-mono">
                {duration}
              </span>
            )}
            {step.exit_code !== null && step.exit_code !== undefined && (
              <span className={cn(
                'text-xs font-mono px-1.5 py-0.5 rounded',
                step.exit_code === 0 ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'
              )}>
                exit {step.exit_code}
              </span>
            )}
            <StepStatusBadge status={step.status as StepStatus} size="sm" />
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-l-2 border-muted ml-px">
          {logsLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : combinedLogs ? (
            <AnsiLogViewer
              content={combinedLogs}
              maxHeight="500px"
              autoScroll={step.status === 'running'}
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground bg-black/20">
              No logs available for this step.
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
