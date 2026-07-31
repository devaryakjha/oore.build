import { Link } from '@tanstack/react-router'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import {
  ChevronRightIcon,
  CircleCheckIcon,
  PlayCircleIcon as CirclePlayIcon,
  Clock03Icon as Clock3Icon,
  ServerStack01Icon as ServerIcon,
} from '@hugeicons/core-free-icons'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function MetricCard({
  action,
  description,
  footer,
  icon: Icon,
  isLoading,
  value,
}: {
  action: string
  description: string
  footer: string
  icon: IconSvgElement
  isLoading: boolean
  value: string
}) {
  return (
    <Card size="sm" className="@container/card h-full">
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle className="font-mono text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {isLoading ? <Skeleton className="h-8 w-12" /> : value}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">
            <HugeiconsIcon icon={Icon} data-icon="inline-start" />
            {action}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="justify-between gap-2 font-medium">
        <span>{footer}</span>
        <HugeiconsIcon icon={ChevronRightIcon} />
      </CardFooter>
    </Card>
  )
}

export default function DashboardSystemStatus({
  buildsError,
  buildsLoading,
  completedBuilds,
  onlineRunners,
  recentBuildsError,
  recentBuildsLoading,
  runnersError,
  runnersLoading,
  runningBuilds,
  successfulBuilds,
  totalRunners,
  waitingBuilds,
}: {
  buildsError: boolean
  buildsLoading: boolean
  completedBuilds: number
  onlineRunners: number
  recentBuildsError: boolean
  recentBuildsLoading: boolean
  runnersError: boolean
  runnersLoading: boolean
  runningBuilds: number
  successfulBuilds: number
  totalRunners: number
  waitingBuilds: number
}) {
  const runningValue = buildsError ? '—' : String(runningBuilds)
  const waitingValue = buildsError ? '—' : String(waitingBuilds)
  const runnersValue = runnersError ? '—' : String(onlineRunners)
  const successRate =
    recentBuildsError || completedBuilds === 0
      ? '—'
      : `${Math.round((successfulBuilds / completedBuilds) * 100)}%`

  return (
    <section className="flex flex-col gap-3" aria-labelledby="system-status">
      <h2
        id="system-status"
        className="text-sm font-medium text-muted-foreground"
      >
        System status
      </h2>
      <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Link
          to="/builds"
          search={{ status: 'running' }}
          aria-label={
            buildsError
              ? 'Open running builds'
              : `Open ${runningBuilds} running builds`
          }
          className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <MetricCard
            icon={CirclePlayIcon}
            description="Running"
            value={runningValue}
            action="Live"
            footer="View active builds"
            isLoading={buildsLoading && !buildsError}
          />
        </Link>

        <Link
          to="/builds"
          aria-label={
            buildsError
              ? 'Open build queue'
              : `Open build queue with ${waitingBuilds} waiting builds`
          }
          className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <MetricCard
            icon={Clock3Icon}
            description="Waiting"
            value={waitingValue}
            action="Queue"
            footer="Open build queue"
            isLoading={buildsLoading && !buildsError}
          />
        </Link>

        <Link
          to="/builds"
          aria-label={
            recentBuildsError || completedBuilds === 0
              ? 'Open builds'
              : `Open builds, ${successfulBuilds} of the most recent ${completedBuilds} completed builds succeeded`
          }
          className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <MetricCard
            icon={CircleCheckIcon}
            description="Recent success"
            value={successRate}
            action={
              completedBuilds === 0
                ? 'Recent'
                : `${successfulBuilds} / ${completedBuilds}`
            }
            footer="Completed builds"
            isLoading={recentBuildsLoading && !recentBuildsError}
          />
        </Link>

        <Link
          to="/settings/runners"
          aria-label={
            runnersError
              ? 'Open runners'
              : `Open runners, ${onlineRunners} of ${totalRunners} online`
          }
          className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <MetricCard
            icon={ServerIcon}
            description="Runners online"
            value={
              runnersError ? runnersValue : `${runnersValue} / ${totalRunners}`
            }
            action="Capacity"
            footer="Manage runners"
            isLoading={runnersLoading && !runnersError}
          />
        </Link>
      </div>
    </section>
  )
}
