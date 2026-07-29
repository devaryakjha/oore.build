import { Link } from '@tanstack/react-router'
import {
  CircleCheck as CheckCircleIcon,
  Plus as Add01Icon,
  Link2 as Link04Icon,
  ChevronRightIcon,
} from 'lucide-react'

import type { Build, Project, RuntimeMode } from '@/lib/types'
import { getStatusVariant } from '@/lib/status-variants'
import { formatDuration, relativeTime } from '@/lib/format-utils'
import ActiveBuildBanner from '@/components/active-build-banner'
import DashboardBuildIncident from '@/components/dashboard-build-incident'
import DashboardRunningBuildCard from '@/components/dashboard-running-build-card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function DashboardGettingStarted({
  canWriteIntegrations,
  canWriteProjects,
  integrationConnectTo,
  noConnectedSources,
  runtimeMode,
}: {
  canWriteIntegrations: boolean
  canWriteProjects: boolean
  integrationConnectTo: '/settings/integrations'
  noConnectedSources: boolean
  runtimeMode: RuntimeMode
}) {
  const hasSourceStep = runtimeMode === 'remote' && noConnectedSources
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 text-sm">
          {hasSourceStep ? (
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 size-5 px-0">
                1
              </Badge>
              <div className="space-y-1.5">
                <p className="font-medium">Connect a source</p>
                <p className="text-xs text-muted-foreground">
                  Link GitHub or GitLab to import repositories and enable
                  webhook-triggered builds.
                </p>
                {canWriteIntegrations ? (
                  <Button
                    size="sm"
                    render={<Link to={integrationConnectTo} />}
                    nativeButton={false}
                  >
                    <Link04Icon />
                    Connect source
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Ask an admin to connect a source.
                  </p>
                )}
              </div>
            </li>
          ) : null}
          <li className="flex items-start gap-3">
            <Badge variant="outline" className="mt-0.5 size-5 px-0">
              {hasSourceStep ? '2' : '1'}
            </Badge>
            <div className="space-y-1.5">
              <p className="font-medium">Create a project</p>
              <p className="text-xs text-muted-foreground">
                {runtimeMode === 'local'
                  ? 'Point to a local Flutter repository to get started.'
                  : 'Pick a repository from a connected source.'}
              </p>
              {canWriteProjects && !noConnectedSources ? (
                <Button
                  size="sm"
                  render={<Link to="/projects" search={{ openCreate: '1' }} />}
                  nativeButton={false}
                >
                  <Add01Icon />
                  Create project
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ask an owner or admin to create a project.
                </p>
              )}
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Badge variant="outline" className="mt-0.5 size-5 px-0">
              {hasSourceStep ? '3' : '2'}
            </Badge>
            <div className="space-y-1.5">
              <p className="font-medium">Add a pipeline</p>
              <p className="text-xs text-muted-foreground">
                Configure which platforms to build (Android, iOS, macOS) and
                signing settings.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Badge variant="outline" className="mt-0.5 size-5 px-0">
              {hasSourceStep ? '4' : '3'}
            </Badge>
            <div className="space-y-1.5">
              <p className="font-medium">Run your first build</p>
              <p className="text-xs text-muted-foreground">
                Trigger a build manually or push to your repository to start
                automatically.
              </p>
            </div>
          </li>
        </ol>
      </CardContent>
    </Card>
  )
}

export function DashboardActiveBuilds({
  blockedBuilds,
  builds,
  error,
  isLoading,
  onRetry,
}: {
  blockedBuilds: Array<Build>
  builds: Array<Build>
  error?: Error | null
  isLoading: boolean
  onRetry: () => void
}) {
  const runningBuilds = builds.filter((build) => build.status === 'running')
  const upcomingBuilds = builds.filter((build) => build.status !== 'running')

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>Build activity could not be loaded.</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <section className="flex flex-col gap-4" aria-labelledby="running-builds">
        <div className="flex items-center gap-2">
          <h2
            id="running-builds"
            className="text-sm font-medium text-muted-foreground"
          >
            Running now
          </h2>
          {runningBuilds.length > 0 ? (
            <Badge variant="outline">{runningBuilds.length}</Badge>
          ) : null}
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : runningBuilds.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {runningBuilds.map((build) => (
              <DashboardRunningBuildCard key={build.id} build={build} />
            ))}
          </div>
        ) : builds.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircleIcon />
              </EmptyMedia>
              <EmptyTitle>No active builds</EmptyTitle>
              <EmptyDescription>
                Nothing is running or waiting in the queue.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card size="sm">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No builds are running. {upcomingBuilds.length}{' '}
                {upcomingBuilds.length === 1 ? 'build is' : 'builds are'}{' '}
                waiting.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {!isLoading ? <DashboardBuildIncident builds={blockedBuilds} /> : null}

      {isLoading || upcomingBuilds.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="up-next">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2
                id="up-next"
                className="text-sm font-medium text-muted-foreground"
              >
                Up next
              </h2>
              {!isLoading ? (
                <Badge variant="outline">{upcomingBuilds.length}</Badge>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              render={<Link to="/builds" />}
              nativeButton={false}
            >
              View all
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <ItemGroup className="gap-2">
              {upcomingBuilds.map((build) => (
                <ActiveBuildBanner key={build.id} build={build} />
              ))}
            </ItemGroup>
          )}
        </section>
      ) : null}
    </>
  )
}

export function DashboardRecentBuilds({
  builds,
  error,
  isLoading,
  projects,
  onRetry,
}: {
  builds: Array<Build>
  error?: Error | null
  isLoading: boolean
  projects: Array<Project>
  onRetry: () => void
}) {
  const projectNames = new Map(
    projects.map((project) => [project.id, project.name]),
  )

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recent builds
        </h2>
        <Button
          variant="ghost"
          size="sm"
          render={<Link to="/builds" />}
          nativeButton={false}
        >
          View all
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Build activity could not be loaded.</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ) : builds.length === 0 ? (
        <Card>
          <CardContent>
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">No builds yet.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card size="sm">
          <CardContent>
            <div className="divide-y sm:hidden">
              {builds.map((build) => (
                <Link
                  key={build.id}
                  to="/builds/$buildId"
                  params={{ buildId: build.id }}
                  className="flex min-h-16 items-center justify-between gap-3 py-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {projectNames.get(build.project_id) ??
                        build.context?.project_name ??
                        build.project_id.slice(0, 8)}{' '}
                      <span className="font-mono">#{build.build_number}</span>
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {build.context?.pipeline_name ?? 'Build pipeline'} ·{' '}
                      {build.branch ?? 'No branch'} ·{' '}
                      {relativeTime(build.created_at)}
                    </p>
                  </div>
                  <Badge variant={getStatusVariant(build.status)}>
                    {build.status}
                  </Badge>
                </Link>
              ))}
            </div>
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Build</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {builds.map((build) => (
                    <TableRow key={build.id}>
                      <TableCell className="font-mono text-sm">
                        <Link
                          to="/builds/$buildId"
                          params={{ buildId: build.id }}
                          className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          #{build.build_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {projectNames.get(build.project_id) ??
                          build.context?.project_name ??
                          build.project_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {build.context?.pipeline_name ?? 'Build pipeline'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(build.status)}>
                          {build.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs">
                            {build.branch ?? 'n/a'}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {build.commit_sha
                              ? build.commit_sha.slice(0, 8)
                              : 'No commit'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {build.started_at && build.finished_at
                          ? formatDuration(build.finished_at - build.started_at)
                          : 'n/a'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {relativeTime(build.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
