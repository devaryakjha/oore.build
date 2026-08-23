import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Alert02Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Download04Icon,
  InformationCircleIcon,
  Share08Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Artifact, Build } from '@oore/client/models'

import { useProjectArtifacts } from '@/hooks/use-builds'
import { relativeTime } from '@/lib/format-utils'
import {
  BUILD_STATUS_FILTER_OPTIONS,
  getRunnerPolicyBlockLabel,
  getStatusVariant,
} from '@/lib/status-variants'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { TabsContent } from '@/components/ui/tabs'
import {
  deriveProjectHealth,
  newestProjectBuild,
  selectInstallableProjectArtifacts,
  selectProjectActivity,
  type ProjectHealth,
  type ProjectTab,
} from './-project-overview'

const ArtifactShareMenu = lazy(
  () => import('@/components/build-details/artifact-share-menu'),
)

const HEALTH_BADGE_VARIANT = {
  danger: 'destructive',
  info: 'secondary',
  neutral: 'outline',
  success: 'success',
  warning: 'outline',
} satisfies Record<ProjectHealth['tone'], BadgeVariant>

const HEALTH_ICON = {
  danger: Alert02Icon,
  info: Clock01Icon,
  neutral: InformationCircleIcon,
  success: CheckmarkCircle02Icon,
  warning: Clock01Icon,
} satisfies Record<ProjectHealth['tone'], typeof Alert02Icon>

function ProjectOverviewLane({
  children,
  count,
  description,
  title,
}: {
  children: ReactNode
  count: string
  description: string
  title: string
}) {
  return (
    <section className="min-w-0 rounded-2xl bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function ProjectHealthAction({
  canWriteInstanceSettings,
  canWritePipelines,
  canWriteProjects,
  health,
  latestBuild,
  onOpenTab,
  projectId,
}: {
  canWriteInstanceSettings: boolean
  canWritePipelines: boolean
  canWriteProjects: boolean
  health: ProjectHealth
  latestBuild?: Build
  onOpenTab: (tab: ProjectTab) => void
  projectId: string
}) {
  switch (health.action) {
    case 'build':
      return latestBuild ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <Link to="/builds/$buildId" params={{ buildId: latestBuild.id }} />
          }
        >
          Open build
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
        </Button>
      ) : null
    case 'pipelines':
      return canWritePipelines ? (
        <Button
          size="sm"
          nativeButton={false}
          render={
            <Link
              to="/projects/$projectId/pipelines/new"
              params={{ projectId }}
            />
          }
        >
          Create pipeline
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenTab('pipelines')}
        >
          Open pipelines
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
        </Button>
      )
    case 'runner-settings':
      return canWriteInstanceSettings ? (
        <Button
          size="sm"
          nativeButton={false}
          render={<Link to="/settings/preferences" />}
        >
          Open General settings
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
        </Button>
      ) : null
    case 'source-settings':
      return canWriteProjects ? (
        <Button size="sm" onClick={() => onOpenTab('settings')}>
          {health.title.startsWith('No source')
            ? 'Choose source'
            : 'Repair source'}
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
        </Button>
      ) : null
    default:
      return null
  }
}

function HealthLane({
  buildCount,
  buildsError,
  buildsLoading,
  canWriteInstanceSettings,
  canWritePipelines,
  canWriteProjects,
  hasSourceLink,
  latestBuild,
  onOpenTab,
  onRetryBuilds,
  onRetryRunnerStatus,
  pipelineCount,
  projectId,
  runnerPaused,
  runnerStatusError,
  runnerStatusLoading,
  sourceAvailable,
}: {
  buildCount: number
  buildsError?: Error | null
  buildsLoading: boolean
  canWriteInstanceSettings: boolean
  canWritePipelines: boolean
  canWriteProjects: boolean
  hasSourceLink: boolean
  latestBuild?: Build
  onOpenTab: (tab: ProjectTab) => void
  onRetryBuilds: () => void
  onRetryRunnerStatus: () => void
  pipelineCount: number
  projectId: string
  runnerPaused: boolean
  runnerStatusError?: Error | null
  runnerStatusLoading: boolean
  sourceAvailable: boolean
}) {
  const health = deriveProjectHealth({
    buildQueryFailed: !!buildsError,
    hasSourceLink,
    latestBuild,
    pipelineCount,
    runnerPaused,
    runnerStatusFailed: !!runnerStatusError,
    sourceAvailable,
  })
  const HealthIcon = HEALTH_ICON[health.tone]
  const retryHealth = buildsError
    ? onRetryBuilds
    : runnerStatusError
      ? onRetryRunnerStatus
      : undefined
  const healthLoading =
    hasSourceLink &&
    sourceAvailable &&
    pipelineCount > 0 &&
    (buildsLoading || runnerStatusLoading)

  return (
    <ProjectOverviewLane
      title="Health"
      count="1 signal"
      description="What needs attention now"
    >
      {healthLoading ? (
        <Card size="sm">
          <CardContent
            className="space-y-3"
            aria-label="Loading project health"
          >
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-28" />
          </CardContent>
        </Card>
      ) : (
        <Card size="sm">
          <CardContent>
            <div className="flex items-start justify-between gap-3">
              <HugeiconsIcon
                icon={HealthIcon}
                className={cn(
                  'mt-0.5 size-5 shrink-0',
                  health.tone === 'danger' && 'text-destructive',
                  health.tone === 'warning' && 'text-warning',
                  health.tone === 'info' && 'text-info',
                  health.tone === 'success' && 'text-success',
                  health.tone === 'neutral' && 'text-muted-foreground',
                )}
              />
              <Badge
                variant={HEALTH_BADGE_VARIANT[health.tone]}
                className={
                  health.tone === 'warning' ? 'text-warning' : undefined
                }
              >
                {health.label}
              </Badge>
            </div>
            <h3 className="mt-3 font-semibold">{health.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {health.detail}
            </p>
            <div className="mt-4">
              {retryHealth ? (
                <Button size="sm" variant="outline" onClick={retryHealth}>
                  Retry status
                </Button>
              ) : (
                <ProjectHealthAction
                  canWriteInstanceSettings={canWriteInstanceSettings}
                  canWritePipelines={canWritePipelines}
                  canWriteProjects={canWriteProjects}
                  health={health}
                  latestBuild={latestBuild}
                  onOpenTab={onOpenTab}
                  projectId={projectId}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card size="sm">
        <CardContent>
          <h3 className="text-sm font-semibold">Project setup</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-[11px] text-muted-foreground">Pipelines</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {pipelineCount}
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-[11px] text-muted-foreground">Builds</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {buildCount}
              </div>
            </div>
          </div>
          <Button
            className="mt-3 w-full"
            size="sm"
            variant="outline"
            onClick={() => onOpenTab('pipelines')}
          >
            Open pipelines
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    </ProjectOverviewLane>
  )
}

function BuildActivityLane({
  builds,
  error,
  isLoading,
  onOpenTab,
  onRetry,
}: {
  builds: Array<Build>
  error?: Error | null
  isLoading: boolean
  onOpenTab: (tab: ProjectTab) => void
  onRetry: () => void
}) {
  const activity = selectProjectActivity(builds)

  return (
    <ProjectOverviewLane
      title="Build activity"
      count={error || isLoading ? '—' : `${activity.length} shown`}
      description="Active first, then recent results"
    >
      {error ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription className="space-y-3">
            <span className="block">
              Failed to load build activity: {error.message}
            </span>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : activity.length === 0 ? (
        <Card size="sm" className="border border-dashed shadow-none ring-0">
          <CardContent>
            <h3 className="text-sm font-semibold">No build history</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Builds appear here after a project pipeline runs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div role="list" className="space-y-2">
          {activity.map((build) => (
            <Item
              key={build.id}
              role="listitem"
              variant="outline"
              size="sm"
              render={
                <Link
                  to="/builds/$buildId"
                  params={{ buildId: build.id }}
                  aria-label={`Open build #${build.build_number}`}
                />
              }
            >
              <ItemContent className="min-w-0">
                <ItemTitle>
                  Build #{build.build_number}
                  <Badge variant={getStatusVariant(build.status)}>
                    {BUILD_STATUS_FILTER_OPTIONS[build.status]}
                  </Badge>
                </ItemTitle>
                <ItemDescription>
                  {build.context?.pipeline_name ?? 'Build pipeline'} ·{' '}
                  {build.branch ?? 'No branch'} ·{' '}
                  {relativeTime(build.updated_at)}
                </ItemDescription>
                {build.runner_policy_block_reason ? (
                  <span className="text-xs text-warning">
                    {getRunnerPolicyBlockLabel(
                      build.runner_policy_block_reason,
                    )}
                  </span>
                ) : null}
              </ItemContent>
              <ItemActions>
                <HugeiconsIcon icon={ArrowRight01Icon} />
              </ItemActions>
            </Item>
          ))}
        </div>
      )}

      <Button
        className="w-full"
        size="sm"
        variant="outline"
        onClick={() => onOpenTab('builds')}
      >
        View all
        <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
      </Button>
    </ProjectOverviewLane>
  )
}

function ArtifactShareControl({ artifact }: { artifact: Artifact }) {
  const [requested, setRequested] = useState(false)
  const [open, setOpen] = useState(false)
  const trigger = (
    <Button
      variant="outline"
      size="icon-xs"
      aria-label={`Share options for ${artifact.name}`}
      title="Share options"
      onClick={() => {
        setRequested(true)
        setOpen(true)
      }}
    >
      <HugeiconsIcon icon={Share08Icon} />
    </Button>
  )

  if (!requested) return trigger

  return (
    <Suspense fallback={trigger}>
      <ArtifactShareMenu
        artifact={artifact}
        open={open}
        onOpenChange={setOpen}
      />
    </Suspense>
  )
}

function DeliveryLane({
  artifacts,
  builds,
  canManageShareLinks,
  error,
  isLoading,
  latestBuild,
  onRetry,
}: {
  artifacts: Array<Artifact>
  builds: Array<Build>
  canManageShareLinks: boolean
  error?: Error | null
  isLoading: boolean
  latestBuild?: Build
  onRetry: () => void
}) {
  const installable = selectInstallableProjectArtifacts(artifacts)
  const buildById = new Map(builds.map((build) => [build.id, build]))

  return (
    <ProjectOverviewLane
      title="Delivery"
      count={error || isLoading ? '—' : `${installable.length} ready`}
      description="Newest install-ready build by platform"
    >
      {error ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription className="space-y-3">
            <span className="block">
              Failed to load install-ready artifacts: {error.message}
            </span>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : installable.length === 0 ? (
        <Card size="sm" className="border border-dashed shadow-none ring-0">
          <CardContent>
            <h3 className="text-sm font-semibold">Nothing ready to install</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              A live APK or signed ad-hoc IPA will appear here after a
              successful build.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {installable.map((artifact) => {
            const build = buildById.get(artifact.build_id)
            const isPreviousBuild = latestBuild?.id !== artifact.build_id
            const expiry = artifact.expires_at
              ? ` · Expires ${relativeTime(artifact.expires_at)}`
              : ''

            return (
              <Card key={artifact.id} size="sm">
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">
                          {artifact.name}
                        </h3>
                        <Badge variant="success">Ready</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {artifact.artifact_type.toUpperCase()}
                        {build ? ` · Build #${build.build_number}` : ''}
                        {expiry}
                      </p>
                      {isPreviousBuild && latestBuild ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Previous install-ready build; latest is{' '}
                          {BUILD_STATUS_FILTER_OPTIONS[
                            latestBuild.status
                          ].toLowerCase()}
                          .
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link
                          to="/builds/$buildId"
                          params={{ buildId: artifact.build_id }}
                          search={{ install: artifact.id }}
                        />
                      }
                    >
                      <HugeiconsIcon
                        icon={Download04Icon}
                        data-icon="inline-start"
                      />
                      Install
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={
                        <Link
                          to="/builds/$buildId"
                          params={{ buildId: artifact.build_id }}
                        />
                      }
                    >
                      Open build
                    </Button>
                    {canManageShareLinks ? (
                      <ArtifactShareControl artifact={artifact} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </ProjectOverviewLane>
  )
}

export function ProjectOverviewTab({
  buildCount,
  builds,
  buildsError,
  buildsLoading,
  canManageShareLinks,
  canWriteInstanceSettings,
  canWritePipelines,
  canWriteProjects,
  hasSourceLink,
  onOpenTab,
  onRetryBuilds,
  onRetryRunnerStatus,
  pipelineCount,
  projectId,
  runnerPaused,
  runnerStatusError,
  runnerStatusLoading,
  sourceAvailable,
}: {
  buildCount: number
  builds: Array<Build>
  buildsError?: Error | null
  buildsLoading: boolean
  canManageShareLinks: boolean
  canWriteInstanceSettings: boolean
  canWritePipelines: boolean
  canWriteProjects: boolean
  hasSourceLink: boolean
  onOpenTab: (tab: ProjectTab) => void
  onRetryBuilds: () => void
  onRetryRunnerStatus: () => void
  pipelineCount: number
  projectId: string
  runnerPaused: boolean
  runnerStatusError?: Error | null
  runnerStatusLoading: boolean
  sourceAvailable: boolean
}) {
  const artifactsQuery = useProjectArtifacts(projectId, 50)
  const latestBuild = newestProjectBuild(builds)

  return (
    <TabsContent value="overview">
      <div className="grid gap-4 pt-2 xl:grid-cols-3">
        <HealthLane
          buildCount={buildCount}
          buildsError={buildsError}
          buildsLoading={buildsLoading}
          canWriteInstanceSettings={canWriteInstanceSettings}
          canWritePipelines={canWritePipelines}
          canWriteProjects={canWriteProjects}
          hasSourceLink={hasSourceLink}
          latestBuild={latestBuild}
          onOpenTab={onOpenTab}
          onRetryBuilds={onRetryBuilds}
          onRetryRunnerStatus={onRetryRunnerStatus}
          pipelineCount={pipelineCount}
          projectId={projectId}
          runnerPaused={runnerPaused}
          runnerStatusError={runnerStatusError}
          runnerStatusLoading={runnerStatusLoading}
          sourceAvailable={sourceAvailable}
        />
        <BuildActivityLane
          builds={builds}
          error={buildsError}
          isLoading={buildsLoading}
          onOpenTab={onOpenTab}
          onRetry={onRetryBuilds}
        />
        <DeliveryLane
          artifacts={artifactsQuery.data?.artifacts ?? []}
          builds={builds}
          canManageShareLinks={canManageShareLinks}
          error={artifactsQuery.error}
          isLoading={artifactsQuery.isLoading}
          latestBuild={latestBuild}
          onRetry={() => void artifactsQuery.refetch()}
        />
      </div>
    </TabsContent>
  )
}
