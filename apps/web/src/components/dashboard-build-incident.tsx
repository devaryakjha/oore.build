import { Link } from '@tanstack/react-router'
import {
  ChevronRightIcon,
  CircleAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { formatDuration } from '@/lib/format-utils'
import { getRunnerPolicyBlockLabel } from '@/lib/status-variants'
import type { Build } from '@/lib/types'

export default function DashboardBuildIncident({
  builds,
  noOnlineRunners,
}: {
  builds: Array<Build>
  noOnlineRunners: boolean
}) {
  const issueCount = builds.length + (noOnlineRunners ? 1 : 0)
  if (issueCount === 0) return null

  const visibleBuilds = builds.slice(0, noOnlineRunners ? 2 : 3)
  const hasHiddenBuilds = visibleBuilds.length < builds.length

  return (
    <section className="flex flex-col gap-3" aria-labelledby="attention-needed">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2
            id="attention-needed"
            className="text-sm font-medium text-muted-foreground"
          >
            Needs attention
          </h2>
          <Badge variant="outline">{issueCount}</Badge>
        </div>
        {hasHiddenBuilds ? (
          <Button
            variant="ghost"
            size="sm"
            render={<Link to="/builds" />}
            nativeButton={false}
          >
            View all
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        ) : null}
      </div>

      <ItemGroup className="gap-2">
        {noOnlineRunners ? (
          <Item
            variant="muted"
            size="default"
            className="min-h-16"
            render={
              <Link
                to="/settings/runners"
                aria-label="Review runner availability"
              />
            }
          >
            <ItemMedia variant="icon">
              <CircleAlertIcon className="text-warning!" />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle>No runner is available</ItemTitle>
              <ItemDescription className="line-clamp-1">
                Builds will wait until a runner checks in.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRightIcon />
            </ItemActions>
          </Item>
        ) : null}

        {visibleBuilds.map((build) => {
          const projectName = build.context?.project_name ?? build.project_id
          const issue = getRunnerPolicyBlockLabel(
            build.runner_policy_block_reason!,
          )
          const pipelineName = build.context?.pipeline_name ?? 'Build pipeline'
          const branch = build.branch ?? 'No branch'
          const blockedFor = formatDuration(
            Math.max(0, Math.floor(Date.now() / 1000) - build.queued_at),
          )

          return (
            <Item
              key={build.id}
              variant="muted"
              size="default"
              className="min-h-16"
              render={
                <Link
                  to="/builds/$buildId"
                  params={{ buildId: build.id }}
                  aria-label={`Review ${projectName} build #${build.build_number}`}
                />
              }
            >
              <ItemMedia variant="icon">
                <TriangleAlertIcon className="text-warning!" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>
                  {issue} for {projectName} #{build.build_number}
                </ItemTitle>
                <ItemDescription className="line-clamp-1">
                  {build.runner_policy_block_reason === 'repository_unavailable'
                    ? "Oore couldn't check out this project's source."
                    : 'Direct runner execution is paused.'}{' '}
                  · {pipelineName} · {branch} · Blocked {blockedFor}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRightIcon />
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>
    </section>
  )
}
