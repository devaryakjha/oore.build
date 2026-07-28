import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ChevronRightIcon, ChevronsUpDown, TriangleAlertIcon } from 'lucide-react'

import type { Build } from '@/lib/types'
import { formatDuration } from '@/lib/format-utils'
import { getRunnerPolicyBlockLabel } from '@/lib/status-variants'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Button } from './ui/button'

export default function DashboardBuildIncident({
  builds,
}: {
  builds: Array<Build>
}) {
  const buildsWithProjects = useMemo(() => {
    return builds.map((build) => {
      const projectName = build.context?.project_name ?? build.project_id
      const issue = getRunnerPolicyBlockLabel(build.runner_policy_block_reason!)
      const pipelineName = build.context?.pipeline_name ?? 'Build pipeline'
      const branch = build.branch ?? 'No branch'
      const blockedFor = formatDuration(
        Math.max(0, Math.floor(Date.now() / 1000) - build.queued_at),
      )
      return { ...build, projectName, issue, pipelineName, branch, blockedFor }
    })
  }, [builds])

  if (builds.length === 0) return null

  return (
    <Collapsible className="flex flex-col gap-2 transition-all">
      <h2 className="w-full">
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              className="flex w-full cursor-pointer justify-between bg-transparent! px-0 aria-expanded:bg-transparent aria-expanded:text-foreground"
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Attention needed
                </span>
                <Badge variant="outline">{builds.length}</Badge>
              </span>
              <ChevronsUpDown className="size-4" />
            </Button>
          }
        />
      </h2>
      <CollapsibleContent>
        {buildsWithProjects.map(
          ({
            id,
            runner_policy_block_reason,
            projectName,
            issue,
            pipelineName,
            branch,
            blockedFor,
            build_number,
          }) => {
            return (
              <Item
                key={id}
                variant="muted"
                size="default"
                className='border-border'
                render={
                  <Link
                    to="/builds/$buildId"
                    params={{ buildId: id }}
                    aria-label={`Review ${projectName} build #${build_number}`}
                  />
                }
              >
                <ItemMedia variant="icon">
                  <TriangleAlertIcon className="text-warning!" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {issue} for {projectName} #{build_number}
                  </ItemTitle>
                  <ItemDescription className="line-clamp-1">
                    {runner_policy_block_reason === 'repository_unavailable'
                      ? "Oore couldn't check out this project's source."
                      : 'Direct runner execution is paused.'}{' '}
                    · {pipelineName} · {branch} · Blocked {blockedFor}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon className='size-4' />
                </ItemActions>
              </Item>
            )
          },
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
