import { Link } from '@tanstack/react-router'
import {
  CirclePlayIcon,
  Clock3Icon,
  ServerIcon,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function MetricValue({
  detail,
  isLoading,
  value,
}: {
  detail: string
  isLoading: boolean
  value: string
}) {
  return isLoading ? (
    <Skeleton className="h-6 w-10" />
  ) : (
    <span className="flex items-baseline gap-1.5">
      <span className="font-mono text-xl leading-none font-semibold tabular-nums">
        {value}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {detail}
      </span>
    </span>
  )
}

function MetricLink({
  detail,
  icon: Icon,
  isLoading,
  label,
  link,
  value,
}: {
  detail: string
  icon: LucideIcon
  isLoading: boolean
  label: string
  link: React.ReactElement
  value: string
}) {
  return (
    <Button
      variant="ghost"
      className="h-auto min-w-0 flex-col items-start justify-start gap-2 p-2 text-left sm:flex-row sm:items-center sm:gap-3 sm:p-3"
      render={link}
      nativeButton={false}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-8">
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <MetricValue detail={detail} isLoading={isLoading} value={value} />
      </span>
    </Button>
  )
}

export default function DashboardSystemStatus({
  buildsError,
  buildsLoading,
  onlineRunners,
  runnersError,
  runnersLoading,
  runningBuilds,
  totalRunners,
  waitingBuilds,
}: {
  buildsError: boolean
  buildsLoading: boolean
  onlineRunners: number
  runnersError: boolean
  runnersLoading: boolean
  runningBuilds: number
  totalRunners: number
  waitingBuilds: number
}) {
  const runningValue = buildsError ? '—' : String(runningBuilds)
  const waitingValue = buildsError ? '—' : String(waitingBuilds)
  const runnersValue = runnersError ? '—' : String(onlineRunners)

  return (
    <section aria-labelledby="system-status">
      <Card size="sm">
        <CardHeader>
          <CardTitle id="system-status">System status</CardTitle>
          <CardDescription>Live build and runner capacity</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-1">
          <MetricLink
            icon={CirclePlayIcon}
            label="Running"
            value={runningValue}
            detail={runningBuilds === 1 ? 'build' : 'builds'}
            isLoading={buildsLoading && !buildsError}
            link={
              <Link
                to="/builds"
                search={{ status: 'running' }}
                aria-label={
                  buildsError
                    ? 'Open running builds'
                    : `Open ${runningBuilds} running builds`
                }
              />
            }
          />

          <MetricLink
            icon={Clock3Icon}
            label="Waiting"
            value={waitingValue}
            detail="in queue"
            isLoading={buildsLoading && !buildsError}
            link={
              <Link
                to="/builds"
                aria-label={
                  buildsError
                    ? 'Open build queue'
                    : `Open build queue with ${waitingBuilds} waiting builds`
                }
              />
            }
          />

          <MetricLink
            icon={ServerIcon}
            label="Runners"
            value={runnersValue}
            detail={runnersError ? 'online' : `of ${totalRunners} online`}
            isLoading={runnersLoading && !runnersError}
            link={
              <Link
                to="/settings/runners"
                aria-label={
                  runnersError
                    ? 'Open runners'
                    : `Open runners, ${onlineRunners} of ${totalRunners} online`
                }
              />
            }
          />
        </CardContent>
      </Card>
    </section>
  )
}
