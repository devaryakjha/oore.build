import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, PlayIcon } from '@hugeicons/core-free-icons'

import type { RuntimeMode } from '@oore/client/models'
import type {
  ListIntegrationsResponse,
  ListRunnersResponse,
} from '@oore/client/models'
import { useIndexAuthGuard } from '@/hooks/use-index-auth-guard'
import { useMountEffect } from '@/hooks/use-mount-effect'
import AddInstanceDialog from '@/components/AddInstanceDialog'
import {
  DashboardGettingStarted,
  DashboardTriageBoard,
} from '@/components/dashboard-sections'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import PageHeader from '@/components/page-header'
import PageLayout from '@/components/page-layout'
import { Spinner } from '@/components/ui/spinner'
import { useArtifactsForBuilds, useBuilds } from '@/hooks/use-builds'
import { useIntegrations } from '@/hooks/use-integrations'
import {
  useMarkOperatorIncidentRead,
  useOperatorIncidents,
} from '@/hooks/use-operator-incidents'
import {
  hasProjectPermission,
  useHasPermissions,
} from '@/hooks/use-permissions'
import { useProjects } from '@/hooks/use-projects'
import { useRunners } from '@/hooks/use-runners'
import { useSetupStatus } from '@/hooks/use-setup'
import { getSetupStatus } from '@oore/client/operations'
import { isLoopbackHostname } from '@/lib/connectivity'
import { PageMeta } from '@/lib/seo'
import { isManagedFrontend } from '@/lib/managed-frontend'
import { useAuthStore } from '@/stores/auth-store'
import { useActiveInstance, useInstanceStore } from '@/stores/instance-store'
import { createWebOoreClient } from '@/lib/api-client/client'
import {
  selectInstallableBuildArtifacts,
  selectOperatorBuildActivity,
} from '@/lib/operator-overview'

const loadQaReleasesPage = () => import('@/components/qa-releases-page')
const QaReleasesPage = lazy(loadQaReleasesPage)
const TriggerBuildDrawer = lazy(
  () => import('@/components/trigger-build-drawer'),
)

export const Route = createFileRoute('/')({
  staticData: {
    breadcrumb: {
      title: 'Overview',
    },
  },
  component: IndexPage,
})

const KNOWN_LOCAL_DAEMON_URLS = [
  'http://127.0.0.1:8787',
  'http://127.0.0.1:8788',
  'http://127.0.0.1:8790',
]

function selectHasActiveIntegration({
  active_total,
}: ListIntegrationsResponse): boolean {
  return active_total > 0
}

function selectRunnerSummary({ online_total, total }: ListRunnersResponse) {
  return {
    online: online_total,
    total,
  }
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

async function detectReachableLocalDaemonUrl(): Promise<string | null> {
  for (const candidate of KNOWN_LOCAL_DAEMON_URLS) {
    try {
      await getSetupStatus({
        client: createWebOoreClient({ baseUrl: candidate }),
        signal: AbortSignal.timeout(900),
      })
      return candidate
    } catch {
      // try next candidate
    }
  }
  return null
}

function IndexPage() {
  const instance = useActiveInstance()
  const { data: status, isLoading, error } = useSetupStatus()
  const [showAddInstance, setShowAddInstance] = useState(false)
  const [isDetectingLocalInstance, setIsDetectingLocalInstance] =
    useState(false)
  const autoDetectAttemptedRef = useRef(false)
  const authUser = useAuthStore((s) => s.user)

  useMountEffect(() => {
    if (instance || autoDetectAttemptedRef.current) return

    autoDetectAttemptedRef.current = true
    setIsDetectingLocalInstance(true)

    void Promise.all([
      isManagedFrontend(),
      isLoopbackHostname(window.location.hostname)
        ? detectReachableLocalDaemonUrl()
        : Promise.resolve(null),
    ])
      .then(([managedFrontend, detectedUrl]) => {
        const store = useInstanceStore.getState()
        if (Object.keys(store.instances).length > 0) return
        if (managedFrontend) {
          const instanceId = store.addInstance(window.location.hostname, '')
          store.setActiveInstance(instanceId)
          return
        }
        if (!detectedUrl) return
        const existingInstance = Object.values(store.instances).find(
          (candidate) =>
            normalizeUrl(candidate.url) === normalizeUrl(detectedUrl),
        )
        const instanceId =
          existingInstance?.id ?? store.addInstance('Local', detectedUrl)
        store.setActiveInstance(instanceId)
      })
      .catch(() => {
        // No reachable local daemon; keep manual add-instance path.
      })
      .finally(() => {
        setIsDetectingLocalInstance(false)
      })
  })

  const isAutoSigningIn = useIndexAuthGuard(status, instance)

  if (!instance && isDetectingLocalInstance) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <PageMeta />
        <div className="flex items-center gap-3">
          <Spinner className="size-5" />
          <p className="text-sm text-muted-foreground">
            Detecting local daemon...
          </p>
        </div>
      </div>
    )
  }

  if (isAutoSigningIn) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <PageMeta />
        <div className="flex items-center gap-3">
          <Spinner className="size-5" />
          <p className="text-sm text-muted-foreground">Signing in...</p>
        </div>
      </div>
    )
  }

  if (!instance) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <PageMeta />
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center">
              <img src="/logo.svg" alt="Oore CI logo" className="size-full" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Oore CI</h1>
            <p className="text-sm text-muted-foreground">
              Self-hosted mobile CI and app distribution platform.
              <br />
              Connect a backend instance to begin.
            </p>
          </div>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Instance registry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add a backend instance to start setup or connect to an
                already-configured daemon.
              </p>
              <Button
                onClick={() => setShowAddInstance(true)}
                className="w-full"
              >
                <HugeiconsIcon icon={Add01Icon} />
                Add instance
              </Button>
            </CardContent>
          </Card>
        </div>

        <AddInstanceDialog
          open={showAddInstance}
          onOpenChange={setShowAddInstance}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <PageMeta />
        <div className="flex items-center gap-3">
          <Spinner className="size-5" />
          <p className="text-sm text-muted-foreground">
            Connecting to backend...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <PageMeta />
        <div className="w-full max-w-md">
          <Alert variant="destructive">
            <AlertTitle>Connection failed</AlertTitle>
            <AlertDescription>
              Unable to reach the oore daemon. Make sure{' '}
              <code className="bg-muted px-1 py-0.5 text-xs">oored</code> is
              running.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  if (status?.is_configured) {
    if (authUser?.role === 'qa_viewer') {
      return (
        <Suspense
          fallback={
            <PageLayout width="wide">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full" />
            </PageLayout>
          }
        >
          <QaReleasesPage />
        </Suspense>
      )
    }
    return (
      <>
        <PageMeta />
        <ConfiguredDashboard runtimeMode={status.runtime_mode} />
      </>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <PageMeta />
      <div className="flex items-center gap-3">
        <Spinner className="size-5" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

function ConfiguredDashboard({ runtimeMode }: { runtimeMode: RuntimeMode }) {
  const navigate = useNavigate()
  const [
    canWriteIntegrations,
    canWriteProjects,
    canWriteBuilds,
    canWriteArtifacts,
  ] = useHasPermissions([
    'integrations:write',
    'projects:write',
    'builds:write',
    'artifacts:write',
  ])
  const incidentsQuery = useOperatorIncidents({
    enabled: canWriteIntegrations,
  })
  const markIncidentRead = useMarkOperatorIncidentRead()

  const projectsQuery = useProjects({ limit: 100 })
  const projects = projectsQuery.data?.projects ?? []
  const integrationsQuery = useIntegrations(
    { limit: 1 },
    {
      select: selectHasActiveIntegration,
    },
  )
  const runnersQuery = useRunners(
    { limit: 1 },
    {
      select: selectRunnerSummary,
    },
  )

  const recentBuildsQuery = useBuilds({ limit: 50 })
  const activeBuildsQuery = useBuilds({
    status: 'queued,scheduled,assigned,running',
    limit: 50,
  })
  const runningBuildsQuery = useBuilds({ status: 'running', limit: 4 })
  const waitingBuildsQuery = useBuilds({
    status: 'queued,scheduled,assigned',
    limit: 1,
  })
  const buildActivity = selectOperatorBuildActivity(
    recentBuildsQuery.data?.builds ?? [],
  )
  const blockedBuilds = selectOperatorBuildActivity(
    activeBuildsQuery.data?.builds ?? [],
  ).blocked
  const succeededBuildIds = buildActivity.succeeded.map((build) => build.id)
  const artifactsQuery = useArtifactsForBuilds(succeededBuildIds)
  const installableBuildArtifacts = selectInstallableBuildArtifacts({
    artifacts: artifactsQuery.data?.artifacts ?? [],
    builds: buildActivity.succeeded,
  })
  const hasProjects = projects.length > 0
  const integrationsResolved =
    !integrationsQuery.isLoading && !integrationsQuery.error
  const noConnectedSources =
    runtimeMode === 'remote' &&
    integrationsResolved &&
    integrationsQuery.data === false
  const integrationConnectTo = '/settings/integrations'
  const noOnlineRunners = !!runnersQuery.data && runnersQuery.data.online === 0
  const canShowRunBuild = hasProjects && !noOnlineRunners && canWriteBuilds
  const waitingBuilds = waitingBuildsQuery.data?.total ?? 0
  const shareableProjectIds = new Set(
    projects
      .filter(
        (project) =>
          canWriteArtifacts &&
          hasProjectPermission(project.current_user_role, 'artifacts:write'),
      )
      .map((project) => project.id),
  )

  return (
    <PageLayout width="wide">
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Overview"
          actions={
            canShowRunBuild ? (
              <Suspense fallback={null}>
                <TriggerBuildDrawer
                  description="Choose a project and pipeline to run a manual build."
                  onBuildCreated={(buildId) => {
                    void navigate({
                      to: '/builds/$buildId',
                      params: { buildId },
                    })
                  }}
                >
                  <Button>
                    <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
                    Run build
                  </Button>
                </TriggerBuildDrawer>
              </Suspense>
            ) : undefined
          }
        />

        {!projectsQuery.isLoading &&
        !projectsQuery.error &&
        projects.length === 0 ? (
          <DashboardGettingStarted
            canWriteIntegrations={canWriteIntegrations}
            canWriteProjects={canWriteProjects}
            integrationConnectTo={integrationConnectTo}
            noConnectedSources={noConnectedSources}
            runtimeMode={runtimeMode}
          />
        ) : null}

        {projectsQuery.error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>Projects could not be loaded.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void projectsQuery.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {hasProjects || projectsQuery.isLoading || projectsQuery.error ? (
          <DashboardTriageBoard
            attention={{
              blockedBuilds,
              incidents: incidentsQuery.data?.incidents ?? [],
              noOnlineRunners:
                hasProjects && waitingBuilds > 0 && noOnlineRunners,
              onIncidentRead: (incidentId) =>
                markIncidentRead.mutate(incidentId),
              state: {
                error:
                  !!incidentsQuery.error ||
                  !!activeBuildsQuery.error ||
                  !!runnersQuery.error ||
                  !!waitingBuildsQuery.error,
                isLoading:
                  incidentsQuery.isLoading ||
                  activeBuildsQuery.isLoading ||
                  runnersQuery.isLoading ||
                  waitingBuildsQuery.isLoading,
                onRetry: () => {
                  void incidentsQuery.refetch()
                  void activeBuildsQuery.refetch()
                  void runnersQuery.refetch()
                  void waitingBuildsQuery.refetch()
                },
              },
            }}
            running={{
              builds: runningBuildsQuery.data?.builds ?? [],
              runningTotal: runningBuildsQuery.data?.total ?? 0,
              waitingTotal: waitingBuilds,
              state: {
                error: !!runningBuildsQuery.error || !!waitingBuildsQuery.error,
                isLoading:
                  runningBuildsQuery.isLoading || waitingBuildsQuery.isLoading,
                onRetry: () => {
                  void runningBuildsQuery.refetch()
                  void waitingBuildsQuery.refetch()
                },
              },
            }}
            installable={{
              items: installableBuildArtifacts,
              shareableProjectIds,
              state: {
                error: !!recentBuildsQuery.error || !!artifactsQuery.error,
                isLoading:
                  recentBuildsQuery.isLoading || artifactsQuery.isLoading,
                onRetry: () => {
                  void recentBuildsQuery.refetch()
                  if (succeededBuildIds.length > 0) {
                    void artifactsQuery.refetch()
                  }
                },
              },
            }}
            recentFailures={{
              builds: buildActivity.failures,
              state: {
                error: !!recentBuildsQuery.error,
                isLoading: recentBuildsQuery.isLoading,
                onRetry: () => void recentBuildsQuery.refetch(),
              },
            }}
          />
        ) : null}
      </div>
    </PageLayout>
  )
}
