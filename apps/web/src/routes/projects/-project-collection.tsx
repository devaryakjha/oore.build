import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { MoreHorizontalCircle01Icon } from '@hugeicons/core-free-icons'

import {
  CollectionError,
  CollectionFrame,
  CollectionViewport,
} from '@/components/collection'
import {
  DataTable,
  DataTableColumnHeader,
  DataTableFrame,
  useDataTable,
  type DataTableColumnDef,
  type DataTableInstance,
} from '@/components/data-table'
import {
  dataTableSortingState,
  resolveDataTableSorting,
} from '@/components/data-table-features'
import {
  CollectionPagination,
  type SortDirection,
} from '@/components/collection-controls'
import RepositoryAvatar from '@/components/repository-avatar'
import { Button } from '@/components/ui/button'
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
import type { Project } from '@/api/types'

export type ProjectSort = 'created_at' | 'updated_at' | 'name'

const PROJECT_TABLE_SORTS = [
  'name',
  'updated_at',
] satisfies ReadonlyArray<ProjectSort>

const loadProjectActionsMenu = () => import('./-project-actions-menu')
const ProjectActionsMenu = lazy(loadProjectActionsMenu)

function ProjectAvatar({ project }: { project: Project }) {
  return (
    <RepositoryAvatar
      fullName={project.repository_full_name ?? project.name}
      avatarUrl={project.repository_avatar_url}
      repositoryId={project.repository_id}
      provider={project.repository_provider}
    />
  )
}

function ProjectLink({
  children,
  project,
}: {
  children: ReactNode
  project: Project
}) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="rounded-md outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  )
}

function ProjectIdentity({ project }: { project: Project }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ProjectAvatar project={project} />
      <span className="min-w-0">
        <span className="block truncate font-medium">
          <ProjectLink project={project}>{project.name}</ProjectLink>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {project.repository_full_name ?? 'Local repository'}
        </span>
      </span>
    </div>
  )
}

function ProjectActionsControl({
  canManage,
  project,
}: {
  canManage: boolean
  project: Project
}) {
  const [requested, setRequested] = useState(false)
  const [open, setOpen] = useState(false)

  const trigger = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Actions for ${project.name}`}
      title="Project actions"
      onClick={() => {
        setRequested(true)
        setOpen(true)
      }}
    >
      <HugeiconsIcon icon={MoreHorizontalCircle01Icon} />
    </Button>
  )

  if (!requested) return trigger

  return (
    <Suspense fallback={trigger}>
      <ProjectActionsMenu
        canManage={canManage}
        open={open}
        onOpenChange={setOpen}
        project={project}
      />
    </Suspense>
  )
}

function getProjectColumns(
  canManageProject: (project: Project) => boolean,
): Array<DataTableColumnDef<Project>> {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => <ProjectIdentity project={row.original} />,
      meta: { skeleton: <Skeleton className="h-8 w-48" /> },
    },
    {
      accessorKey: 'default_branch',
      header: 'Default branch',
      cell: ({ row }) => row.original.default_branch ?? 'Not set',
      enableSorting: false,
      meta: {
        cellClassName: 'font-mono text-xs text-muted-foreground',
        skeleton: <Skeleton className="h-4 w-24" />,
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => row.original.description ?? 'No description',
      enableSorting: false,
      meta: {
        cellClassName:
          'hidden max-w-[30ch] truncate text-sm text-muted-foreground lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        skeleton: <Skeleton className="h-4 w-40" />,
      },
    },
    {
      accessorKey: 'updated_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      cell: ({ row }) => relativeTime(row.original.updated_at),
      meta: {
        cellClassName: 'text-sm text-muted-foreground',
        skeleton: <Skeleton className="h-4 w-20" />,
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <ProjectActionsControl
          canManage={canManageProject(row.original)}
          project={row.original}
        />
      ),
      enableHiding: false,
      enableSorting: false,
      meta: {
        headerClassName: 'w-10',
        skeleton: <Skeleton className="size-8" />,
      },
    },
  ]
}

function CompactProjectsSkeleton() {
  return (
    <ItemGroup className="gap-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Item key={index} variant="outline" className="flex-nowrap" aria-hidden>
          <ItemMedia>
            <Skeleton className="size-8 rounded-full" />
          </ItemMedia>
          <ItemContent>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </ItemContent>
          <ItemActions>
            <Skeleton className="size-8" />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

function ProjectCollectionSkeleton({
  table,
}: {
  table: DataTableInstance<Project>
}) {
  return (
    <CollectionViewport
      compact={<CompactProjectsSkeleton />}
      desktop={
        <DataTableFrame fill>
          <DataTable table={table} isLoading />
        </DataTableFrame>
      }
    />
  )
}

function CompactProjects({
  canManageProject,
  projects,
}: {
  canManageProject: (project: Project) => boolean
  projects: Array<Project>
}) {
  return (
    <ItemGroup className="gap-2">
      {projects.map((project) => (
        <Item key={project.id} variant="outline" className="flex-nowrap">
          <ItemMedia>
            <ProjectAvatar project={project} />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>
              <ProjectLink project={project}>{project.name}</ProjectLink>
            </ItemTitle>
            <ItemDescription>
              <span className="block truncate">
                {project.repository_full_name ?? 'Local repository'}
                {' · '}
                <span className="font-mono">
                  {project.default_branch ?? 'Branch not set'}
                </span>
              </span>
              <span className="block truncate">
                {project.description ?? 'No description'}
              </span>
            </ItemDescription>
          </ItemContent>
          <ItemActions className="self-start">
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              {relativeTime(project.updated_at)}
            </span>
            <ProjectActionsControl
              canManage={canManageProject(project)}
              project={project}
            />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

export function ProjectCollection({
  canManageProject,
  direction,
  emptyState,
  error,
  isLoading,
  isRefreshing,
  onPageChange,
  onPageSizeChange,
  onRetry,
  onSortChange,
  page,
  pageSize,
  projects,
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
  onPageSizeChange: (pageSize: number) => void
  onRetry: () => void
  onSortChange: (sort: ProjectSort, direction: SortDirection) => void
  page: number
  pageSize: number
  projects: Array<Project>
  sort: ProjectSort
  total: number
}) {
  const hasResults = total > 0
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

      {isLoading ? (
        <ProjectCollectionSkeleton table={table} />
      ) : hasResults ? (
        <CollectionViewport
          compact={
            <>
              <CompactProjects
                canManageProject={canManageProject}
                projects={projects}
              />
              <CollectionPagination
                isRefreshing={isRefreshing}
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </>
          }
          desktop={
            <DataTableFrame
              fill
              footer={
                <CollectionPagination
                  embedded
                  isRefreshing={isRefreshing}
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={onPageChange}
                  onPageSizeChange={onPageSizeChange}
                />
              }
            >
              <DataTable table={table} />
            </DataTableFrame>
          }
        />
      ) : error ? null : (
        emptyState
      )}
    </CollectionFrame>
  )
}
