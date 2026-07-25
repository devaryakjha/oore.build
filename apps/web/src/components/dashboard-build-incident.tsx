import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRightIcon, ChevronsUpDown, TriangleAlertIcon } from 'lucide-react'

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
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'

export default function DashboardBuildIncident({
  builds,
}: {
  builds: Array<Build>
}) {
  const [open, setOpen] = useState(false)

  if (builds.length === 0) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex flex-col gap-2"
    >
      <h2 className="w-full">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Attention needed
            </span>
            <Badge variant="outline">{builds.length}</Badge>
          </span>
          <ChevronsUpDown />
          <span className="sr-only">
            {open ? 'Collapse alerts' : 'Expand alerts'}
          </span>
        </CollapsibleTrigger>
      </h2>

      <CollapsibleContent>
        <ItemGroup className="gap-2">
          {builds.map((build) => {
            const projectName = build.context?.project_name ?? build.project_id
            const issue = getRunnerPolicyBlockLabel(
              build.runner_policy_block_reason!,
            )
            const pipelineName =
              build.context?.pipeline_name ?? 'Build pipeline'
            const branch = build.branch ?? 'No branch'
            const blockedFor = formatDuration(
              Math.max(0, Math.floor(Date.now() / 1000) - build.queued_at),
            )

            return (
              <Item
                key={build.id}
                variant="outline"
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
                    {build.runner_policy_block_reason ===
                    'repository_unavailable'
                      ? "Oore couldn't check out this project's source."
                      : 'Direct runner execution is paused.'}{' '}
                    · {pipelineName} · {branch} · Blocked {blockedFor}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="outline">Warning</Badge>
                  <ArrowRightIcon />
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}
