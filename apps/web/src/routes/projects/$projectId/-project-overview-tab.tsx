import { lazy, Suspense, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Alert02Icon,
  ArrowRight01Icon,
  Download04Icon,
  GitBranchIcon,
  InformationCircleIcon,
  Share08Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Artifact, Build } from '@oore/client/models'

import { useProjectArtifacts } from '@/hooks/use-builds'
import { BUILD_PLATFORM_LABELS, getBuildPlatforms } from '@/lib/build-platforms'
import { relativeTime } from '@/lib/format-utils'
import {
  BUILD_STATUS_FILTER_OPTIONS,
  getRunnerPolicyBlockLabel,
  getStatusVariant,
} from '@/lib/status-variants'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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

function buildActivityLabel(build: Build): string {
  return relativeTime(build.finished_at ?? build.updated_at)
}

function artifactPlatformLabel(artifact: Artifact): string {
  return artifact.artifact_type === 'apk' ? 'Android' : 'iOS'
}

function ArtifactShareControl({ artifacts }: { artifacts: Array<Artifact> }) {
  const [requested, setRequested] = useState(false)
  const [open, setOpen] = useState(false)
  const artifact = artifacts[0]

  if (!artifact) return null

  const artifactSet: [Artifact, ...Array<Artifact>] = [
    artifact,
    ...artifacts.slice(1),
  ]
  const trigger = (
    <Button
      variant="outline"
      size="icon-xs"
      aria-label="Share build artifacts"
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
        artifacts={artifactSet}
        open={open}
        onOpenChange={setOpen}
      />
    </Suspense>
  )
}

function SetupAction({
  canWriteInstanceSettings,
  canWritePipelines,
  canWriteProjects,
  health,
  onOpenTab,
  projectId,
}: {
  canWriteInstanceSettings: boolean
  canWritePipelines: boolean
  canWriteProjects: boolean
  health: ProjectHealth
  onOpenTab: (tab: ProjectTab) => void
  projectId: string
}) {
  if (health.action === 'pipelines') {
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
      </Button>
    ) : (
      <Button
        size="sm"
        variant="outline"
        onClick={() => onOpenTab('pipelines')}
      >
        Open pipelines
      </Button>
    )
  }

  if (health.action === 'runner-settings' && canWriteInstanceSettings) {
    return (
      <Button
        size="sm"
        nativeButton={false}
        render={<Link to="/settings/preferences" />}
      >
        Open instance settings
      </Button>
    )
  }

  if (health.action === 'source-settings' && canWriteProjects) {
    return (
      <Button size="sm" onClick={() => onOpenTab('settings')}>
        {health.title.startsWith('No source')
          ? 'Choose source'
          : 'Repair source'}
      </Button>
    )
  }

  return null
}

function SetupNotice({
  canWriteInstanceSettings,
  canWritePipelines,
  canWriteProjects,
  health,
  onOpenTab,
  projectId,
}: {
  canWriteInstanceSettings: boolean
  canWritePipelines: boolean
  canWriteProjects: boolean
  health: ProjectHealth
  onOpenTab: (tab: ProjectTab) => void
  projectId: string
}) {
  return (
    <Alert variant={health.tone === 'danger' ? 'destructive' : 'default'}>
      <HugeiconsIcon
        icon={health.tone === 'danger' ? Alert02Icon : InformationCircleIcon}
      />
      <AlertTitle>{health.title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <span>{health.detail}</span>
        <SetupAction
          canWriteInstanceSettings={canWriteInstanceSettings}
          canWritePipelines={canWritePipelines}
          canWriteProjects={canWriteProjects}
          health={health}
          onOpenTab={onOpenTab}
          projectId={projectId}
        />
      </AlertDescription>
    </Alert>
  )
}

function LatestBuildSurface({
  artifacts,
  artifactsLoading,
  build,
  canManageShareLinks,
  health,
}: {
  artifacts: Array<Artifact>
  artifactsLoading: boolean
  build: Build
  canManageShareLinks: boolean
  health: ProjectHealth
}) {
  const platforms = getBuildPlatforms(build)
  const installArtifact = artifacts[0]
  const commit = build.commit_sha ? `#${build.commit_sha.slice(0, 8)}` : null
  const summary =
    build.status === 'succeeded' && build.changelog
      ? build.changelog
      : health.detail

  return (
    <Card className="border shadow-none ring-0">
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getStatusVariant(build.status)}>
              {BUILD_STATUS_FILTER_OPTIONS[build.status]}
            </Badge>
            <Link
              to="/builds/$buildId"
              params={{ buildId: build.id }}
              className="font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              Build #{build.build_number}
            </Link>
            <span className="text-xs text-muted-foreground">
              {buildActivityLabel(build)}
            </span>
          </div>

          <h3 className="mt-4 truncate text-xl font-semibold">
            {build.context?.pipeline_name ?? 'Build pipeline'}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {summary}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <HugeiconsIcon icon={GitBranchIcon} className="size-3.5" />
              {build.branch ?? 'No branch'}
            </span>
            {commit ? <span className="font-mono">{commit}</span> : null}
            {build.runner_policy_block_reason ? (
              <span className="text-warning">
                {getRunnerPolicyBlockLabel(build.runner_policy_block_reason)}
              </span>
            ) : null}
          </div>

          {platforms.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {platforms.map((platform) => (
                <Badge key={platform} variant="secondary">
                  {BUILD_PLATFORM_LABELS[platform]}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {artifactsLoading && build.status === 'succeeded' ? (
            <Skeleton className="h-7 w-20" />
          ) : null}
          {installArtifact ? (
            <Button
              size="sm"
              nativeButton={false}
              render={
                <Link
                  to="/builds/$buildId"
                  params={{ buildId: build.id }}
                  search={{ install: installArtifact.id }}
                />
              }
            >
              <HugeiconsIcon icon={Download04Icon} data-icon="inline-start" />
              Install
            </Button>
          ) : null}
          {installArtifact && canManageShareLinks ? (
            <ArtifactShareControl artifacts={artifacts} />
          ) : null}
          <Button
            size="sm"
            variant={installArtifact ? 'outline' : 'default'}
            nativeButton={false}
            render={
              <Link to="/builds/$buildId" params={{ buildId: build.id }} />
            }
          >
            Open build
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function LatestInstallableBuild({
  artifacts,
  build,
  canManageShareLinks,
}: {
  artifacts: Array<Artifact>
  build: Build
  canManageShareLinks: boolean
}) {
  const installArtifact = artifacts[0]
  if (!installArtifact) return null

  return (
    <section className="space-y-3" aria-labelledby="latest-installable">
      <h2 id="latest-installable" className="text-sm font-medium">
        Ready to install
      </h2>
      <Item variant="outline" size="default">
        <ItemContent className="min-w-0">
          <ItemTitle>
            <Link
              to="/builds/$buildId"
              params={{ buildId: build.id }}
              className="hover:underline"
            >
              Build #{build.build_number}
            </Link>
          </ItemTitle>
          <ItemDescription>
            Built {relativeTime(build.finished_at ?? build.updated_at)}
          </ItemDescription>
          <div className="flex flex-wrap gap-1.5">
            {artifacts.map((artifact) => (
              <Badge key={artifact.id} variant="secondary">
                {artifactPlatformLabel(artifact)}
              </Badge>
            ))}
          </div>
        </ItemContent>
        <ItemActions className="ml-auto flex-wrap justify-end max-sm:basis-full">
          <Button
            size="sm"
            nativeButton={false}
            render={
              <Link
                to="/builds/$buildId"
                params={{ buildId: build.id }}
                search={{ install: installArtifact.id }}
              />
            }
          >
            Install
          </Button>
          {canManageShareLinks ? (
            <ArtifactShareControl artifacts={artifacts} />
          ) : null}
        </ItemActions>
      </Item>
    </section>
  )
}

function RecentBuilds({
  builds,
  latestBuild,
  onOpenTab,
}: {
  builds: Array<Build>
  latestBuild?: Build
  onOpenTab: (tab: ProjectTab) => void
}) {
  const recentBuilds = selectProjectActivity(builds, 6)
    .filter((build) => build.id !== latestBuild?.id)
    .slice(0, 5)

  return (
    <section className="space-y-3" aria-labelledby="recent-builds">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-builds" className="text-sm font-medium">
          Recent builds
        </h2>
        <Button variant="ghost" size="sm" onClick={() => onOpenTab('builds')}>
          View all
          <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
        </Button>
      </div>

      {recentBuilds.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No earlier builds yet.
        </div>
      ) : (
        <div role="list" className="divide-y overflow-hidden rounded-lg border">
          {recentBuilds.map((build) => {
            const platforms = getBuildPlatforms(build)
            const commit = build.commit_sha
              ? `#${build.commit_sha.slice(0, 8)}`
              : null

            return (
              <Item
                key={build.id}
                role="listitem"
                size="sm"
                className="rounded-none border-0"
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
                    {build.context?.pipeline_name ?? 'Build pipeline'}
                    <span className="font-mono text-xs text-muted-foreground">
                      #{build.build_number}
                    </span>
                    <Badge variant={getStatusVariant(build.status)}>
                      {BUILD_STATUS_FILTER_OPTIONS[build.status]}
                    </Badge>
                  </ItemTitle>
                  <ItemDescription className="line-clamp-1">
                    {build.branch ?? 'No branch'}
                    {commit ? ` · ${commit}` : ''} · {buildActivityLabel(build)}
                  </ItemDescription>
                  {platforms.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {platforms.map((platform) => (
                        <Badge key={platform} variant="secondary">
                          {BUILD_PLATFORM_LABELS[platform]}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </ItemContent>
                <ItemActions>
                  <HugeiconsIcon icon={ArrowRight01Icon} />
                </ItemActions>
              </Item>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function ProjectOverviewTab({
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
  sourceAvailable,
}: {
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
  sourceAvailable: boolean
}) {
  const artifactsQuery = useProjectArtifacts(projectId, 50)
  const latestBuild = newestProjectBuild(builds)
  const health = deriveProjectHealth({
    buildQueryFailed: !!buildsError,
    hasSourceLink,
    latestBuild,
    pipelineCount,
    runnerPaused,
    runnerStatusFailed: !!runnerStatusError,
    sourceAvailable,
  })
  const setupBlocked =
    !hasSourceLink || !sourceAvailable || pipelineCount === 0 || runnerPaused
  const installable = selectInstallableProjectArtifacts(
    artifactsQuery.data?.artifacts ?? [],
  )
  const installableBuildId = installable[0]?.build_id
  const installableArtifacts = installableBuildId
    ? installable.filter((artifact) => artifact.build_id === installableBuildId)
    : []
  installableArtifacts.sort((left, right) =>
    left.artifact_type === right.artifact_type
      ? 0
      : left.artifact_type === 'apk'
        ? -1
        : 1,
  )
  const installableBuild = builds.find(
    (build) => build.id === installableBuildId,
  )
  const latestBuildArtifacts = latestBuild
    ? installableArtifacts.filter(
        (artifact) => artifact.build_id === latestBuild.id,
      )
    : []

  return (
    <TabsContent value="overview">
      <div className="flex flex-col gap-8 pt-5">
        {setupBlocked ? (
          <SetupNotice
            canWriteInstanceSettings={canWriteInstanceSettings}
            canWritePipelines={canWritePipelines}
            canWriteProjects={canWriteProjects}
            health={health}
            onOpenTab={onOpenTab}
            projectId={projectId}
          />
        ) : null}

        {runnerStatusError && !setupBlocked ? (
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} />
            <AlertTitle>Runner status unavailable</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{runnerStatusError.message}</span>
              <Button size="sm" variant="outline" onClick={onRetryRunnerStatus}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {latestBuild || buildsLoading || buildsError || !setupBlocked ? (
          <section className="space-y-3" aria-labelledby="latest-build">
            <h2 id="latest-build" className="text-sm font-medium">
              Latest build
            </h2>

            {buildsError ? (
              <Alert variant="destructive">
                <HugeiconsIcon icon={InformationCircleIcon} />
                <AlertTitle>Build status unavailable</AlertTitle>
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{buildsError.message}</span>
                  <Button size="sm" variant="outline" onClick={onRetryBuilds}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            {buildsLoading && !latestBuild ? (
              <Skeleton className="h-52 w-full" />
            ) : latestBuild ? (
              <LatestBuildSurface
                artifacts={latestBuildArtifacts}
                artifactsLoading={artifactsQuery.isLoading}
                build={latestBuild}
                canManageShareLinks={canManageShareLinks}
                health={health}
              />
            ) : !buildsError && !setupBlocked ? (
              <Card className="border border-dashed shadow-none ring-0">
                <CardContent className="py-8 text-center">
                  <h3 className="font-medium">Ready for the first build</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use Run build above to start this project.
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </section>
        ) : null}

        {artifactsQuery.isLoading &&
        latestBuild &&
        latestBuild.status !== 'succeeded' ? (
          <Skeleton className="h-20 w-full" />
        ) : latestBuild && artifactsQuery.error ? (
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} />
            <AlertTitle>Installable build unavailable</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{artifactsQuery.error.message}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void artifactsQuery.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : installableBuild && installableBuild.id !== latestBuild?.id ? (
          <LatestInstallableBuild
            artifacts={installableArtifacts}
            build={installableBuild}
            canManageShareLinks={canManageShareLinks}
          />
        ) : null}

        {!buildsLoading && builds.length > 0 ? (
          <RecentBuilds
            builds={builds}
            latestBuild={latestBuild}
            onOpenTab={onOpenTab}
          />
        ) : null}
      </div>
    </TabsContent>
  )
}
