import { lazy, Suspense, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon as TriangleAlertIcon,
  AlertCircleIcon as CircleAlertIcon,
  AndroidIcon,
  AppleIcon,
  ChevronRightIcon,
  CheckmarkCircle02Icon as CheckCircleIcon,
  Clock01Icon,
  Link04Icon,
  Add01Icon,
  ServerStack01Icon as ServerIcon,
  SmartPhone01Icon,
} from '@hugeicons/core-free-icons'

import { BuildItem } from '@/components/build-item'
import { OperatorIncidentAlert } from '@/components/operator-incident-alert'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/lib/format-utils'
import {
  groupInstallableBuildArtifacts,
  type InstallableBuildArtifact,
} from '@/lib/operator-overview'
import { getRunnerPolicyBlockLabel } from '@/lib/status-variants'
import type {
  Artifact,
  Build,
  OperatorIncident,
  RuntimeMode,
} from '@oore/client/models'

const loadArtifactShareMenu = () =>
  import('@/components/build-details/artifact-share-menu')
const ArtifactShareMenu = lazy(loadArtifactShareMenu)

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
        <ol className="flex flex-col gap-3 text-sm">
          {hasSourceStep ? (
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 size-5 px-0">
                1
              </Badge>
              <div className="flex flex-col gap-1.5">
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
                    <HugeiconsIcon icon={Link04Icon} />
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
            <div className="flex flex-col gap-1.5">
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
                  <HugeiconsIcon icon={Add01Icon} />
                  Create project
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {canWriteProjects
                    ? 'Connect a source before you create a project.'
                    : 'Ask an owner or admin to create a project.'}
                </p>
              )}
            </div>
          </li>

          <li className="flex items-start gap-3">
            <Badge variant="outline" className="mt-0.5 size-5 px-0">
              {hasSourceStep ? '3' : '2'}
            </Badge>
            <div className="flex flex-col gap-1.5">
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
            <div className="flex flex-col gap-1.5">
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

interface SectionState {
  error: boolean
  isLoading: boolean
  onRetry: () => void
}

function SectionHeading({
  action,
  count,
  id,
  title,
}: {
  action?: ReactNode
  count?: number
  id: string
  title: string
}) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 id={id} className="text-sm font-medium">
          {title}
        </h2>
        {count != null ? <Badge variant="outline">{count}</Badge> : null}
      </div>
      {action}
    </div>
  )
}

function SectionLoading() {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading section">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

function SectionError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function SectionEmpty({
  description,
  icon,
  title,
}: {
  description: string
  icon: typeof CheckCircleIcon
  title: string
}) {
  return (
    <Empty className="min-h-32 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={icon} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function NeedsAttentionSection({
  blockedBuilds,
  incidents,
  onIncidentRead,
  noOnlineRunners,
  state,
}: {
  blockedBuilds: Array<Build>
  incidents: Array<OperatorIncident>
  onIncidentRead: (incidentId: string) => void
  noOnlineRunners: boolean
  state: SectionState
}) {
  const issueCount =
    incidents.length + blockedBuilds.length + (noOnlineRunners ? 1 : 0)

  return (
    <section className="flex flex-col gap-3" aria-labelledby="needs-attention">
      <SectionHeading
        id="needs-attention"
        title="Needs attention"
        count={state.isLoading ? undefined : issueCount}
      />
      {state.error ? (
        <SectionError
          message="Issues needing attention could not be loaded."
          onRetry={state.onRetry}
        />
      ) : state.isLoading ? (
        <SectionLoading />
      ) : issueCount === 0 ? (
        <SectionEmpty
          description="Sources, runners, and queued builds are ready."
          icon={CheckCircleIcon}
          title="Nothing needs action"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {incidents.map((incident) => (
            <OperatorIncidentAlert
              incident={incident}
              key={incident.id}
              onRead={() => onIncidentRead(incident.id)}
            />
          ))}
          <ItemGroup className="gap-2">
            {noOnlineRunners ? (
              <Item
                variant="outline"
                size="default"
                render={
                  <Link
                    to="/settings/runners"
                    aria-label="Review runner availability"
                  />
                }
              >
                <ItemMedia variant="icon">
                  <HugeiconsIcon
                    icon={CircleAlertIcon}
                    className="text-warning!"
                  />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>No runner can take waiting builds</ItemTitle>
                  <ItemDescription>
                    Bring a runner online to start the queued work.
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <HugeiconsIcon icon={ChevronRightIcon} />
                </ItemActions>
              </Item>
            ) : null}
            {blockedBuilds.map((build) => {
              const blockReason = build.runner_policy_block_reason
              if (!blockReason) return null
              const projectName =
                build.context?.project_name ?? build.project_id
              return (
                <Item
                  key={build.id}
                  variant="outline"
                  size="default"
                  render={
                    <Link
                      to="/builds/$buildId"
                      params={{ buildId: build.id }}
                      aria-label={`Review ${projectName} build #${build.build_number}`}
                    />
                  }
                >
                  <ItemMedia variant="icon">
                    <HugeiconsIcon
                      icon={TriangleAlertIcon}
                      className="text-warning!"
                    />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {getRunnerPolicyBlockLabel(blockReason)} · {projectName} #
                      {build.build_number}
                    </ItemTitle>
                    <ItemDescription>
                      {blockReason === 'repository_unavailable'
                        ? 'Open the build to repair its source checkout.'
                        : 'Open the build to review paused runner execution.'}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <HugeiconsIcon icon={ChevronRightIcon} />
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        </div>
      )}
    </section>
  )
}

function RunningNowSection({
  builds,
  runningTotal,
  state,
  waitingTotal,
}: {
  builds: Array<Build>
  runningTotal: number
  state: SectionState
  waitingTotal: number
}) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="running-now">
      <SectionHeading
        id="running-now"
        title="Running now"
        count={state.isLoading ? undefined : runningTotal}
        action={
          waitingTotal > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              render={<Link to="/builds" />}
              nativeButton={false}
            >
              <HugeiconsIcon icon={Clock01Icon} />
              {waitingTotal} waiting
              <HugeiconsIcon icon={ChevronRightIcon} data-icon="inline-end" />
            </Button>
          ) : undefined
        }
      />
      {state.error ? (
        <SectionError
          message="Running builds could not be loaded."
          onRetry={state.onRetry}
        />
      ) : state.isLoading ? (
        <SectionLoading />
      ) : builds.length === 0 ? (
        <SectionEmpty
          description={
            waitingTotal > 0
              ? 'Builds are waiting for a runner.'
              : 'Run a build to see live work here.'
          }
          icon={ServerIcon}
          title="No builds are running"
        />
      ) : (
        <ItemGroup className="gap-2">
          {builds.map((build) => (
            <BuildItem build={build} key={build.id} />
          ))}
        </ItemGroup>
      )}
    </section>
  )
}

function artifactPlatformLabel(artifact: Artifact): string {
  return artifact.artifact_type === 'apk' ? 'Android' : 'iOS'
}

function ReadyToInstallSection({
  items,
  shareableProjectIds,
  state,
}: {
  items: Array<InstallableBuildArtifact>
  shareableProjectIds: Set<string>
  state: SectionState
}) {
  const [shareBuildId, setShareBuildId] = useState<string | null>(null)
  const installableBuilds = groupInstallableBuildArtifacts(items)

  return (
    <section className="flex flex-col gap-3" aria-labelledby="ready-to-install">
      <SectionHeading
        id="ready-to-install"
        title="Ready to install/share"
        count={state.isLoading ? undefined : installableBuilds.length}
      />
      {state.error ? (
        <SectionError
          message="Installable apps could not be loaded."
          onRetry={state.onRetry}
        />
      ) : state.isLoading ? (
        <SectionLoading />
      ) : items.length === 0 ? (
        <SectionEmpty
          description="A successful APK or signed ad-hoc IPA will appear here."
          icon={CheckCircleIcon}
          title="No apps are ready yet"
        />
      ) : (
        <ItemGroup className="gap-2">
          {installableBuilds.map(({ artifacts, build }) => {
            const projectName = build.context?.project_name ?? build.project_id
            const isMultiPlatform = artifacts.length > 1
            const installArtifact = artifacts[0]
            return (
              <Item key={build.id} variant="outline" size="default">
                <ItemMedia variant="icon">
                  <HugeiconsIcon
                    icon={
                      isMultiPlatform
                        ? SmartPhone01Icon
                        : installArtifact.artifact_type === 'apk'
                          ? AndroidIcon
                          : AppleIcon
                    }
                  />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>
                    <Link
                      to="/builds/$buildId"
                      params={{ buildId: build.id }}
                      className="hover:underline"
                    >
                      {projectName} #{build.build_number}
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
                    render={
                      <Link
                        to="/builds/$buildId"
                        params={{ buildId: build.id }}
                        search={{ install: installArtifact.id }}
                        aria-label={`Install ${projectName} build #${build.build_number}`}
                      />
                    }
                    nativeButton={false}
                  >
                    Install
                  </Button>
                  {shareableProjectIds.has(build.project_id) ? (
                    <Suspense fallback={null}>
                      <ArtifactShareMenu
                        artifact={installArtifact}
                        artifacts={artifacts}
                        open={shareBuildId === build.id}
                        onOpenChange={(open) =>
                          setShareBuildId(open ? build.id : null)
                        }
                      />
                    </Suspense>
                  ) : null}
                  {!shareableProjectIds.has(build.project_id) ? (
                    <Button
                      variant="outline"
                      size="icon-xs"
                      render={
                        <Link
                          to="/builds/$buildId"
                          params={{ buildId: build.id }}
                          aria-label={`Open ${projectName} build #${build.build_number}`}
                        />
                      }
                      nativeButton={false}
                    >
                      <HugeiconsIcon icon={ChevronRightIcon} />
                    </Button>
                  ) : null}
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
      )}
    </section>
  )
}

function RecentFailuresSection({
  builds,
  state,
}: {
  builds: Array<Build>
  state: SectionState
}) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="recent-failures">
      <SectionHeading
        id="recent-failures"
        title="Recent failures"
        count={state.isLoading ? undefined : builds.length}
        action={
          builds.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              render={<Link to="/builds" />}
              nativeButton={false}
            >
              View all
              <HugeiconsIcon icon={ChevronRightIcon} data-icon="inline-end" />
            </Button>
          ) : undefined
        }
      />
      {state.error ? (
        <SectionError
          message="Recent failures could not be loaded."
          onRetry={state.onRetry}
        />
      ) : state.isLoading ? (
        <SectionLoading />
      ) : builds.length === 0 ? (
        <SectionEmpty
          description="Failed and timed-out builds from the recent build window will appear here."
          icon={CheckCircleIcon}
          title="No recent failures"
        />
      ) : (
        <ItemGroup className="gap-2">
          {builds.map((build) => (
            <BuildItem build={build} key={build.id} statusPresentation="icon" />
          ))}
        </ItemGroup>
      )}
    </section>
  )
}

export function DashboardTriageBoard({
  attention,
  installable,
  recentFailures,
  running,
}: {
  attention: {
    blockedBuilds: Array<Build>
    incidents: Array<OperatorIncident>
    noOnlineRunners: boolean
    onIncidentRead: (incidentId: string) => void
    state: SectionState
  }
  installable: {
    items: Array<InstallableBuildArtifact>
    shareableProjectIds: Set<string>
    state: SectionState
  }
  recentFailures: { builds: Array<Build>; state: SectionState }
  running: {
    builds: Array<Build>
    runningTotal: number
    state: SectionState
    waitingTotal: number
  }
}) {
  return (
    <div className="flex flex-col gap-8">
      <NeedsAttentionSection
        blockedBuilds={attention.blockedBuilds}
        incidents={attention.incidents}
        noOnlineRunners={attention.noOnlineRunners}
        onIncidentRead={attention.onIncidentRead}
        state={attention.state}
      />
      <RunningNowSection
        builds={running.builds}
        runningTotal={running.runningTotal}
        state={running.state}
        waitingTotal={running.waitingTotal}
      />
      <ReadyToInstallSection
        items={installable.items}
        shareableProjectIds={installable.shareableProjectIds}
        state={installable.state}
      />
      <RecentFailuresSection
        builds={recentFailures.builds}
        state={recentFailures.state}
      />
    </div>
  )
}
