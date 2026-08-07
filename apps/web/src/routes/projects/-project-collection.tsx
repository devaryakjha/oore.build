import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { MoreHorizontalCircle01Icon } from '@hugeicons/core-free-icons'

import {
  CollectionError,
  CollectionFrame,
  CollectionViewport,
} from '@/components/collection'
import { DataTableFrame } from '@/components/data-table'
import {
  CollectionPagination,
  SortableTableHead,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { relativeTime } from '@/lib/format-utils'
import type { AuthorizedProject, Project } from '@/lib/types'

export type ProjectSort = 'created_at' | 'updated_at' | 'name'

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
      onMouseEnter={() => void loadProjectActionsMenu()}
      onFocus={() => void loadProjectActionsMenu()}
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

function DesktopProjectsSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead>Default branch</TableHead>
          <TableHead className="hidden lg:table-cell">Description</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }, (_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-8 w-48" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Skeleton className="h-4 w-40" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="size-8" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ProjectCollectionSkeleton() {
  return (
    <CollectionViewport
      compact={<CompactProjectsSkeleton />}
      desktop={
        <DataTableFrame fill>
          <DesktopProjectsSkeleton />
        </DataTableFrame>
      }
    />
  )
}

function CompactProjects({
  canManageProject,
  projects,
}: {
  canManageProject: (project: AuthorizedProject) => boolean
  projects: Array<AuthorizedProject>
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

function ProjectTable({
  canManageProject,
  direction,
  onSortChange,
  projects,
  sort,
}: {
  canManageProject: (project: AuthorizedProject) => boolean
  direction: SortDirection
  onSortChange: (sort: ProjectSort, direction: SortDirection) => void
  projects: Array<AuthorizedProject>
  sort: ProjectSort
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            sort={sort}
            sortKey="name"
            direction={direction}
            onSortChange={onSortChange}
          >
            Project
          </SortableTableHead>
          <TableHead>Default branch</TableHead>
          <TableHead className="hidden lg:table-cell">Description</TableHead>
          <SortableTableHead
            sort={sort}
            sortKey="updated_at"
            direction={direction}
            onSortChange={onSortChange}
          >
            Updated
          </SortableTableHead>
          <TableHead className="w-10">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id}>
            <TableCell>
              <ProjectIdentity project={project} />
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {project.default_branch ?? 'Not set'}
            </TableCell>
            <TableCell className="hidden max-w-[30ch] truncate text-sm text-muted-foreground lg:table-cell">
              {project.description ?? 'No description'}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {relativeTime(project.updated_at)}
            </TableCell>
            <TableCell>
              <ProjectActionsControl
                canManage={canManageProject(project)}
                project={project}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
  canManageProject: (project: AuthorizedProject) => boolean
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
  projects: Array<AuthorizedProject>
  sort: ProjectSort
  total: number
}) {
  const hasResults = total > 0

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
        <ProjectCollectionSkeleton />
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
              <ProjectTable
                canManageProject={canManageProject}
                direction={direction}
                onSortChange={onSortChange}
                projects={projects}
                sort={sort}
              />
            </DataTableFrame>
          }
        />
      ) : error ? null : (
        emptyState
      )}
    </CollectionFrame>
  )
}
