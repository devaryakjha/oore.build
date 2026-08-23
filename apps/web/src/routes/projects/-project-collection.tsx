import { useMemo, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { CollectionError, CollectionFrame } from '@/components/collection'
import {
  DataTable,
  DataTableColumnHeader,
  useDataTable,
  type DataTableColumnDef,
} from '@/components/data-table'
import {
  dataTableSortingState,
  resolveDataTableSorting,
} from '@/components/data-table-features'
import type { SortDirection } from '@/components/data-table-features'
import RepositoryAvatar from '@/components/repository-avatar'
import { Badge } from '@/components/ui/badge'
import { relativeTime } from '@/lib/format-utils'
import {
  latestBuildActivityAt,
  type ProjectListItem,
} from '@/lib/project-list'
import {
  BUILD_STATUS_FILTER_OPTIONS,
  getStatusVariant,
} from '@/lib/status-variants'
import type { Project } from '@oore/client/models'
import ProjectActionsMenu from './-project-actions-menu'

export type ProjectSort = 'created_at' | 'updated_at' | 'name'

const PROJECT_TABLE_SORTS = [
  'name',
  'updated_at',
] satisfies ReadonlyArray<ProjectSort>

function ProjectIdentity({ project }: { project: Project }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <RepositoryAvatar
        fullName={project.repository_full_name ?? project.name}
        avatarUrl={project.repository_avatar_url}
        repositoryId={project.repository_id}
        provider={project.repository_provider}
      />
      <span className="min-w-0">
        <Link
          to="/projects/$projectId"
          params={{ projectId: project.id }}
          className="block truncate font-medium"
        >
          {project.name}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">
          {project.repository_full_name ?? 'Local repository'}
        </span>
      </span>
    </div>
  )
}

function LatestBuild({ project }: { project: ProjectListItem }) {
  const build = project.latest_build

  if (!build) {
    return <span className="text-muted-foreground">No builds yet</span>
  }

  const pipelineName = build.pipeline_name ?? 'Pipeline unavailable'

  return (
    <div className="min-w-40">
      <div className="flex items-center gap-2">
        <Link
          to="/builds/$buildId"
          params={{ buildId: build.id }}
          aria-label={`Open ${project.name} build #${build.build_number}`}
          className="font-mono text-xs font-medium"
        >
          #{build.build_number}
        </Link>
        <Badge variant={getStatusVariant(build.status)}>
          {BUILD_STATUS_FILTER_OPTIONS[build.status]}
        </Badge>
      </div>
      <div
        className="mt-1 max-w-56 truncate text-xs text-muted-foreground"
        title={pipelineName}
      >
        {pipelineName} · {relativeTime(latestBuildActivityAt(build))}
      </div>
    </div>
  )
}

function getProjectColumns(
  canManageProject: (project: Project) => boolean,
): Array<DataTableColumnDef<ProjectListItem>> {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => <ProjectIdentity project={row.original} />,
    },
    {
      accessorKey: 'default_branch',
      header: 'Default branch',
      cell: ({ row }) => row.original.default_branch ?? 'Not set',
      enableSorting: false,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => row.original.description ?? 'No description',
      enableSorting: false,
    },
    {
      id: 'latest_build',
      header: 'Latest build',
      cell: ({ row }) => <LatestBuild project={row.original} />,
      enableSorting: false,
    },
    {
      accessorKey: 'updated_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      cell: ({ row }) => relativeTime(row.original.updated_at),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <ProjectActionsMenu
          canManage={canManageProject(row.original)}
          project={row.original}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
  ]
}

export function ProjectCollection({
  canManageProject,
  direction,
  emptyState,
  error,
  isLoading,
  isRefreshing,
  onPageChange,
  onRetry,
  onSearch,
  onSortChange,
  page,
  pageSize,
  projects,
  query,
  sort,
  total,
}: {
  canManageProject: (project: Project) => boolean
  direction: SortDirection
  emptyState: ReactNode
  error: Error | null
  isLoading: boolean
  isRefreshing: boolean
  onPageChange: (page: number) => void
  onRetry: () => void
  onSearch: (query: string) => void
  onSortChange: (sort: ProjectSort, direction: SortDirection) => void
  page: number
  pageSize: number
  projects: Array<ProjectListItem>
  query: string
  sort: ProjectSort
  total: number
}) {
  const columns = useMemo(
    () => getProjectColumns(canManageProject),
    [canManageProject],
  )
  const sorting = useMemo(
    () => dataTableSortingState(sort, direction),
    [direction, sort],
  )
  const table = useDataTable({
    columns,
    data: projects,
    getRowId: (project) => project.id,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = resolveDataTableSorting(
        updater,
        sorting,
        PROJECT_TABLE_SORTS,
      )
      if (next) onSortChange(next.sort, next.direction)
    },
  })

  return (
    <CollectionFrame ariaLabel="Projects" isBusy={isLoading || isRefreshing}>
      {error ? (
        <CollectionError
          title="Projects could not be loaded"
          description={error.message}
          onRetry={onRetry}
        />
      ) : null}

      {!isLoading && total === 0 && !error ? (
        emptyState
      ) : (
        <DataTable
          table={table}
          search={{
            value: query,
            onChange: onSearch,
            placeholder: 'Search projects',
          }}
          pagination={{ onPageChange, page, pageSize, total }}
          emptyMessage={isLoading ? 'Loading projects…' : undefined}
        />
      )}
    </CollectionFrame>
  )
}
