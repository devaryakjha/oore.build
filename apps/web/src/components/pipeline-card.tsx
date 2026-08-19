import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Edit02Icon, PlayIcon } from '@hugeicons/core-free-icons'
import { toast } from '@/lib/toast'

import type { Pipeline } from '@/lib/types'
import { useUpdatePipeline } from '@/hooks/use-pipelines'
import { relativeTime } from '@/lib/format-utils'
import { getPipelineStatusVariant } from '@/lib/status-variants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface PipelineCardProps {
  pipeline: Pipeline
  projectId: string
  canWrite: boolean
  canTriggerBuild: boolean
  onTriggerBuild: (pipelineId: string) => void
  lastBuildStatus?: string
  lastBuildTime?: number
}

export default function PipelineCard({
  pipeline,
  projectId,
  canWrite,
  canTriggerBuild,
  onTriggerBuild,
  lastBuildStatus,
  lastBuildTime,
}: PipelineCardProps) {
  const updateMutation = useUpdatePipeline()

  function handleToggle() {
    updateMutation.mutate(
      { pipelineId: pipeline.id, data: { enabled: !pipeline.enabled } },
      {
        onSuccess: () =>
          toast.success(
            pipeline.enabled ? 'Pipeline disabled' : 'Pipeline enabled',
          ),
        onError: (err) => toast.error(`Failed: ${err.message}`),
      },
    )
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2.5">
              <Link
                to="/projects/$projectId/pipelines/$pipelineId"
                params={{ projectId, pipelineId: pipeline.id }}
                className="text-sm font-semibold hover:underline"
              >
                {pipeline.name}
              </Link>
              <Badge variant={getPipelineStatusVariant(pipeline.enabled)}>
                {pipeline.enabled ? 'enabled' : 'disabled'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {pipeline.execution_config.platforms.map((p) => (
                <Badge key={p} variant="outline" className="text-[11px]">
                  {p}
                </Badge>
              ))}
              {pipeline.trigger_config.events.length > 0
                ? pipeline.trigger_config.events.map((e) => (
                    <Badge key={e} variant="secondary" className="text-[11px]">
                      {e}
                    </Badge>
                  ))
                : null}
            </div>
          </div>
          <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
            {lastBuildStatus ? (
              <>
                Last build:{' '}
                <span className="font-medium">{lastBuildStatus}</span>
                {lastBuildTime ? ` ${relativeTime(lastBuildTime)}` : ''}
              </>
            ) : (
              'No builds'
            )}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          {canTriggerBuild ? (
            <Button size="sm" onClick={() => onTriggerBuild(pipeline.id)}>
              <HugeiconsIcon icon={PlayIcon} />
              Run build
            </Button>
          ) : null}
          {canWrite ? (
            <Button
              size="sm"
              variant="outline"
              render={
                <Link
                  to="/projects/$projectId/pipelines/$pipelineId/edit"
                  params={{ projectId, pipelineId: pipeline.id }}
                  search={{}}
                />
              }
              nativeButton={false}
            >
              <HugeiconsIcon icon={Edit02Icon} />
              Edit
            </Button>
          ) : null}
          {canWrite ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggle}
              disabled={updateMutation.isPending}
            >
              {pipeline.enabled ? 'Disable' : 'Enable'}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
