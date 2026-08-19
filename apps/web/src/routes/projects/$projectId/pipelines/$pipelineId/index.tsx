import { lazy, Suspense, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Delete02Icon,
  Edit02Icon,
  InformationCircleIcon,
  PlayIcon,
} from '@hugeicons/core-free-icons'
import { toast } from '@/lib/toast'
import type { Build } from '@/api/types'

import {
  getActiveInstanceOrRedirect,
  requireInstanceRoleOrRedirect,
} from '@/lib/instance-context'
import { useBuilds } from '@/hooks/use-builds'
import {
  hasProjectPermission,
  useHasPermissions,
} from '@/hooks/use-permissions'
import {
  useDeletePipeline,
  usePipeline,
  usePipelineAndroidSigning,
  usePipelineIosSigning,
  useUpdatePipeline,
} from '@/hooks/use-pipelines'
import { useProject } from '@/hooks/use-projects'
import {
  getPipelineStatusVariant,
  getStatusVariant,
} from '@/lib/status-variants'
import { relativeTime } from '@/lib/format-utils'
import { PageMeta } from '@/lib/seo'
import {
  DataTable,
  DataTableFrame,
  useDataTable,
  type DataTableColumnDef,
} from '@/components/data-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import PageHeader from '@/components/page-header'
import PageLayout from '@/components/page-layout'
import { Skeleton } from '@/components/ui/skeleton'
import { PipelineConfigurationCard } from '../-pipeline-configuration-card'

const recentBuildColumns: Array<DataTableColumnDef<Build>> = [
  {
    accessorKey: 'build_number',
    header: 'Build',
    cell: ({ row }) => `#${row.original.build_number}`,
    enableSorting: false,
    meta: { cellClassName: 'font-mono text-sm group-hover:underline' },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={getStatusVariant(row.original.status)}>
        {row.original.status}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'branch',
    header: 'Branch',
    cell: ({ row }) => row.original.branch ?? 'n/a',
    enableSorting: false,
    meta: { cellClassName: 'font-mono text-xs text-muted-foreground' },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) =>
      new Date(row.original.created_at * 1000).toLocaleString(),
    enableSorting: false,
    meta: { cellClassName: 'text-sm text-muted-foreground' },
  },
]

function RecentBuildsTable({
  builds,
  onOpen,
}: {
  builds: Array<Build>
  onOpen: (build: Build) => void
}) {
  const table = useDataTable({
    columns: recentBuildColumns,
    data: builds,
    getRowId: (build) => build.id,
  })
  return (
    <DataTable
      table={table}
      getRowProps={(row) => ({
        className: 'group cursor-pointer',
        role: 'link',
        tabIndex: 0,
        onClick: () => onOpen(row.original),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen(row.original)
          }
        },
      })}
    />
  )
}

const loadTriggerBuildDrawer = () => import('@/components/trigger-build-drawer')
const TriggerBuildDrawer = lazy(loadTriggerBuildDrawer)

export const Route = createFileRoute(
  '/projects/$projectId/pipelines/$pipelineId/',
)({
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireInstanceRoleOrRedirect(instance.id, ['owner', 'admin', 'developer'])
  },
  component: PipelineDetailPage,
})

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

function PipelineDetailPage() {
  const { projectId, pipelineId } = Route.useParams()
  const navigate = useNavigate()
  const { data, isLoading, error } = usePipeline(pipelineId)
  const [canWriteGlobally, canTriggerBuildGlobally] = useHasPermissions([
    'pipelines:write',
    'builds:write',
  ])
  const { data: projectData } = useProject(projectId)
  const projectRole = projectData?.project.current_user_role
  const canWrite =
    canWriteGlobally && hasProjectPermission(projectRole, 'pipelines:write')
  const canDelete = hasProjectPermission(projectRole, 'pipelines:delete')
  const canTriggerBuild =
    canTriggerBuildGlobally && hasProjectPermission(projectRole, 'builds:write')
  const signingQuery = usePipelineAndroidSigning(pipelineId, {
    enabled: canWrite,
  })
  const iosSigningQuery = usePipelineIosSigning(pipelineId, {
    enabled: canWrite,
  })
  const { data: buildsData } = useBuilds({
    pipeline_id: pipelineId,
    limit: 20,
  })
  const updateMutation = useUpdatePipeline()
  const deleteMutation = useDeletePipeline()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [buildDrawerOpen, setBuildDrawerOpen] = useState(false)

  const label = data?.pipeline.name ?? 'Pipeline Details'

  if (isLoading) {
    return (
      <PageLayout width="wide">
        <PageMeta title={label} noindex />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-56 w-full" />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout width="wide">
        <PageMeta title={label} noindex />
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription>
            Failed to load pipeline: {error.message}
          </AlertDescription>
        </Alert>
      </PageLayout>
    )
  }

  if (!data) return null

  const { pipeline } = data
  const builds = buildsData?.builds ?? []
  const projectHasSource = !!projectData?.project.repository_id
  const manualOnlyTriggers =
    projectData?.project.repository_provider === 'local_git'

  function handleToggleEnabled() {
    updateMutation.mutate(
      { pipelineId: pipeline.id, data: { enabled: !pipeline.enabled } },
      {
        onSuccess: () =>
          toast.success(
            pipeline.enabled ? 'Pipeline disabled' : 'Pipeline enabled',
          ),
        onError: (err) =>
          toast.error(`Failed to update pipeline: ${err.message}`),
      },
    )
  }

  function handleDelete() {
    deleteMutation.mutate(pipelineId, {
      onSuccess: () => {
        toast.success('Pipeline deleted')
        void navigate({ to: '/projects/$projectId', params: { projectId } })
      },
      onError: (err) =>
        toast.error(`Failed to delete pipeline: ${err.message}`),
    })
  }

  return (
    <PageLayout width="wide">
      <PageMeta title={label} noindex />
      <PageHeader
        title={pipeline.name}
        description="Pipeline overview and configuration."
        meta={
          <>
            <Badge variant={getPipelineStatusVariant(pipeline.enabled)}>
              {pipeline.enabled ? 'enabled' : 'disabled'}
            </Badge>
            {pipeline.execution_config.platforms.map((p) => (
              <Badge key={p} variant="outline" className="text-[11px]">
                {p}
              </Badge>
            ))}
            <span>Updated {relativeTime(pipeline.updated_at)}</span>
          </>
        }
        actions={
          canWrite || canDelete || canTriggerBuild ? (
            <>
              {canTriggerBuild ? (
                <Suspense
                  fallback={
                    <Button disabled>
                      <HugeiconsIcon icon={PlayIcon} />
                      Run build
                    </Button>
                  }
                >
                  <TriggerBuildDrawer
                    fixedProjectId={projectId}
                    fixedPipelineId={pipeline.id}
                    fixedPipelineName={pipeline.name}
                    defaultBranch={
                      projectData?.project.default_branch ?? undefined
                    }
                    description="Run this pipeline now with a branch or pinned commit."
                    open={buildDrawerOpen}
                    onOpenChange={setBuildDrawerOpen}
                    onBuildCreated={(buildId) => {
                      void navigate({
                        to: '/builds/$buildId',
                        params: { buildId },
                      })
                    }}
                  >
                    <Button disabled={!projectHasSource}>
                      <HugeiconsIcon icon={PlayIcon} />
                      Run build
                    </Button>
                  </TriggerBuildDrawer>
                </Suspense>
              ) : null}
              {canWrite ? (
                <Button
                  variant="outline"
                  onClick={handleToggleEnabled}
                  disabled={updateMutation.isPending}
                >
                  {pipeline.enabled ? 'Disable' : 'Enable'}
                </Button>
              ) : null}
              {canWrite ? (
                <Button
                  variant="outline"
                  render={
                    <Link
                      to="/projects/$projectId/pipelines/$pipelineId/edit"
                      params={{ projectId, pipelineId }}
                      search={{}}
                    />
                  }
                  nativeButton={false}
                >
                  <HugeiconsIcon icon={Edit02Icon} />
                  Edit
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <HugeiconsIcon icon={Delete02Icon} />
                  Delete
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
      {!projectHasSource ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription>
            This project has no linked source repository. Link a repository
            before triggering builds.
          </AlertDescription>
        </Alert>
      ) : null}

      <PipelineConfigurationCard
        androidSigning={signingQuery.data}
        iosSigning={iosSigningQuery.data}
        manualOnlyTriggers={manualOnlyTriggers}
        pipeline={pipeline}
      />
      {/* Recent builds */}
      <Card>
        <CardContent>
          <h3 className="pb-3 text-sm font-medium">Recent builds</h3>
          {builds.length === 0 ? (
            <Empty className="p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={PlayIcon} />
                </EmptyMedia>
                <EmptyTitle>No builds yet</EmptyTitle>
                <EmptyDescription>
                  Run this pipeline to see its status, output, and artifacts
                  here.
                </EmptyDescription>
              </EmptyHeader>
              {canTriggerBuild && projectHasSource ? (
                <EmptyContent>
                  <Button size="sm" onClick={() => setBuildDrawerOpen(true)}>
                    <HugeiconsIcon icon={PlayIcon} />
                    Run first build
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <DataTableFrame>
              <RecentBuildsTable
                builds={builds}
                onOpen={(build) => {
                  void navigate({
                    to: '/builds/$buildId',
                    params: { buildId: build.id },
                  })
                }}
              />
            </DataTableFrame>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pipeline?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{pipeline.name}". This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
