import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { GitBranchIcon, Search01Icon } from '@hugeicons/core-free-icons'

import { CollectionError, CollectionFrame } from '@/components/collection'
import RepositoryAvatar from '@/components/repository-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/lib/format-utils'
import { latestBuildActivityAt, type ProjectListItem } from '@/lib/project-list'
import {
  BUILD_STATUS_FILTER_OPTIONS,
  getStatusVariant,
} from '@/lib/status-variants'
import type { SortDirection } from '@/components/data-table-features'
import type { Project } from '@oore/client/models'
import ProjectActionsMenu from './-project-actions-menu'

export type ProjectSort = 'created_at' | 'updated_at' | 'name'

type ProjectSortOption =
  | 'recent'
  | 'oldest'
  | 'name-ascending'
  | 'name-descending'

const PROJECT_SORT_LABELS = {
  recent: 'Recently updated',
  oldest: 'Least recently updated',
  'name-ascending': 'Name A–Z',
  'name-descending': 'Name Z–A',
} satisfies Record<ProjectSortOption, string>

function sortOption(sort: ProjectSort, direction: SortDirection) {
  if (sort === 'name') {
    return direction === 'asc' ? 'name-ascending' : 'name-descending'
  }
  return direction === 'asc' ? 'oldest' : 'recent'
}

function ProjectCard({
  canManage,
  project,
}: {
  canManage: boolean
  project: ProjectListItem
}) {
  const build = project.latest_build
  const activityAt = build ? latestBuildActivityAt(build) : project.updated_at

  return (
    <article className="group relative flex min-h-40 flex-col rounded-lg border bg-card/30 p-4 transition-colors hover:bg-muted/30">
      <div className="flex min-w-0 items-start gap-3">
        <RepositoryAvatar
          fullName={project.repository_full_name ?? project.name}
          avatarUrl={project.repository_avatar_url}
          repositoryId={project.repository_id}
          provider={project.repository_provider}
        />
        <div className="min-w-0 flex-1">
          <Link
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            className="font-medium after:absolute after:inset-0 after:content-['']"
          >
            {project.name}
          </Link>
          <p
            className="truncate text-xs text-muted-foreground"
            title={project.repository_full_name ?? 'Local repository'}
          >
            {project.repository_full_name ?? 'Local repository'}
          </p>
        </div>
        <div className="relative z-10">
          <ProjectActionsMenu canManage={canManage} project={project} />
        </div>
      </div>

      <div className="mt-5 min-w-0 flex-1">
        {build ? (
          <>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(build.status)}>
                {BUILD_STATUS_FILTER_OPTIONS[build.status]}
              </Badge>
              <Link
                to="/builds/$buildId"
                params={{ buildId: build.id }}
                className="relative z-10 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                #{build.build_number}
              </Link>
            </div>
            <p
              className="mt-2 truncate text-sm"
              title={build.pipeline_name ?? 'Pipeline unavailable'}
            >
              {build.pipeline_name ?? 'Pipeline unavailable'}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No builds yet</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <HugeiconsIcon icon={GitBranchIcon} className="size-3.5 shrink-0" />
          <span className="truncate">
            {project.default_branch ?? 'Branch not set'}
          </span>
        </span>
        <span className="shrink-0">{relativeTime(activityAt)}</span>
      </div>
    </article>
  )
}

function ProjectGridSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2" aria-label="Loading projects">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="space-y-5 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-px w-full" />
        </div>
      ))}
    </div>
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
  const selectedSort = sortOption(sort, direction)

  function handleSortChange(value: ProjectSortOption | null) {
    if (value === 'name-ascending') return onSortChange('name', 'asc')
    if (value === 'name-descending') return onSortChange('name', 'desc')
    if (value === 'oldest') return onSortChange('updated_at', 'asc')
    onSortChange('updated_at', 'desc')
  }

  return (
    <CollectionFrame ariaLabel="Projects" isBusy={isLoading || isRefreshing}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="sm:max-w-md">
          <InputGroupAddon>
            <HugeiconsIcon icon={Search01Icon} />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search projects"
            value={query}
            placeholder="Search projects"
            onChange={(event) => onSearch(event.target.value)}
          />
        </InputGroup>
        <Select value={selectedSort} onValueChange={handleSortChange}>
          <SelectTrigger className="sm:ml-auto" aria-label="Sort projects">
            {PROJECT_SORT_LABELS[selectedSort]}
          </SelectTrigger>
          <SelectContent align="end">
            {Object.entries(PROJECT_SORT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <CollectionError
          title="Projects could not be loaded"
          description={error.message}
          onRetry={onRetry}
        />
      ) : null}

      {isLoading ? <ProjectGridSkeleton /> : null}

      {!isLoading && total === 0 && !error ? emptyState : null}

      {!isLoading && !error && total > 0 ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                canManage={canManageProject(project)}
              />
            ))}
          </div>

          {total > pageSize ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}{' '}
                of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * pageSize >= total}
                  onClick={() => onPageChange(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </CollectionFrame>
  )
}
