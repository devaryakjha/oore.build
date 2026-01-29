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
    <Card>
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
            <Badge variant="secondary" className="gap-1">
              <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" />
              Live
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/30">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
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
              title={isBuilding ? 'Waiting for steps...' : 'No steps'}
              description={
                isBuilding
                  ? 'Build steps will appear here once execution begins.'
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
