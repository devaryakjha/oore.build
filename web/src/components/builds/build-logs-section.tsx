'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { BuildStepItem } from './build-step-item'
import { useBuildSteps } from '@/lib/api/builds'
import type { BuildStatus } from '@/lib/api/types'
import {
  ComputerTerminal01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

interface BuildLogsSectionProps {
  buildId: string
  buildStatus: BuildStatus
}

export function BuildLogsSection({ buildId, buildStatus }: BuildLogsSectionProps) {
  // Poll steps while build is running or pending
  const shouldPoll = buildStatus === 'running' || buildStatus === 'pending'
  const { data: steps, isLoading, error } = useBuildSteps(buildId, shouldPoll)

  const isBuilding = buildStatus === 'running' || buildStatus === 'pending'

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={ComputerTerminal01Icon} className="h-4 w-4" />
              Build Steps
            </CardTitle>
            <CardDescription>
              {steps?.length
                ? `${steps.length} step${steps.length === 1 ? '' : 's'}`
                : 'Output from the build process'}
            </CardDescription>
          </div>
          {isBuilding && (
            <Badge variant="secondary" className="gap-1" aria-label="Build is running, logs updating live">
              <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" aria-hidden="true" />
              Live
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0" aria-live="polite" aria-atomic="false">
        {isLoading ? (
          <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading build steps">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/30" aria-hidden="true">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
            <span className="sr-only">Loading build steps...</span>
          </div>
        ) : error ? (
          <div className="p-4">
            <EmptyState
              icon={<HugeiconsIcon icon={ComputerTerminal01Icon} className="h-10 w-10" />}
              title="Failed to load steps"
              description="There was an error loading build steps. Please try refreshing."
            />
          </div>
        ) : !steps || steps.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<HugeiconsIcon icon={ComputerTerminal01Icon} className="h-10 w-10" />}
              title={isBuilding ? 'Starting build...' : 'No steps'}
              description={
                isBuilding
                  ? 'Build is initializing. Steps will appear shortly.'
                  : 'This build has no recorded steps.'
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {steps.map((step, index) => (
              <BuildStepItem
                key={step.id}
                buildId={buildId}
                step={step}
                // Auto-expand the first failed step or the running step
                defaultExpanded={
                  (step.status === 'failure' && !steps.slice(0, index).some(s => s.status === 'failure')) ||
                  step.status === 'running'
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
