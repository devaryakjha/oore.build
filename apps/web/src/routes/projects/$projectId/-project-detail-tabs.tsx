import { HugeiconsIcon } from '@hugeicons/react'
import {
  InformationCircleIcon,
  PlayIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { useNavigate, useSearch } from '@tanstack/react-router'

import { BUILD_STATUS_FILTER_OPTIONS } from '@/lib/status-variants'
import { useBuilds } from '@/hooks/use-builds'
import { usePageClamp } from '@/hooks/use-page-clamp'
import type { SortDirection } from '@/components/data-table-features'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { ProjectBuildSort } from './-project-build-sort'
import { ProjectBuildInventory } from './-project-build-inventory'

type ProjectBuildSearchUpdates = Partial<{
  direction: SortDirection
  page: number
  pageSize: 20 | 50 | 100
  q: string
  sort: ProjectBuildSort
  status: string
}>

export function ProjectBuildsTab({
  active,
  canTriggerBuild,
  onTriggerBuild,
  pipelineCount,
  projectHasSource,
  projectId,
}: {
  active: boolean
  canTriggerBuild: boolean
  onTriggerBuild: () => void
  pipelineCount: number
  projectHasSource: boolean
  projectId: string
}) {
  const search = useSearch({ from: '/projects/$projectId/' })
  const navigate = useNavigate({ from: '/projects/$projectId/' })
  const page = search.page ?? 1
  const pageSize = search.pageSize ?? 20
  const sort = search.sort ?? 'created_at'
  const direction = search.direction ?? 'desc'
  const buildsQuery = useBuilds(
    {
      project_id: projectId,
      branch: search.q,
      status: search.status,
      sort: search.sort,
      direction: search.direction,
      limit: pageSize,
      offset: page > 1 ? (page - 1) * pageSize : undefined,
    },
    { enabled: active, refetchInterval: 15_000 },
  )
  const builds = buildsQuery.data?.builds ?? []
  const total = buildsQuery.data?.total ?? 0
  const hasFilters = !!search.q || !!search.status

  function updateSearch(updates: ProjectBuildSearchUpdates) {
    void navigate({
      to: '/projects/$projectId',
      params: { projectId },
      search: (previous) => ({ ...previous, ...updates }),
      replace: true,
    })
  }

  usePageClamp(page, pageSize, buildsQuery.data?.total, (nextPage) => {
    updateSearch({ page: nextPage === 1 ? undefined : nextPage })
  })

  function handleSortChange(
    nextSort: ProjectBuildSort,
    nextDirection: SortDirection,
  ) {
    updateSearch({
      sort: nextSort,
      direction: nextDirection,
      page: undefined,
    })
  }

  function clearFilters() {
    updateSearch({ q: undefined, status: undefined, page: undefined })
  }

  const showFilteredEmpty =
    !buildsQuery.isLoading && !buildsQuery.error && total === 0 && hasFilters
  const showTrueEmpty =
    !buildsQuery.isLoading && !buildsQuery.error && total === 0 && !hasFilters

  return (
    <TabsContent value="builds" className="min-h-0">
      {active ? (
        <div className="flex h-full min-h-0 flex-col gap-4 pt-2">
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 gap-3 sm:ml-auto sm:flex sm:flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'hidden sm:inline-flex',
                  !hasFilters && 'invisible',
                )}
                aria-hidden={!hasFilters}
                tabIndex={hasFilters ? undefined : -1}
                onClick={clearFilters}
              >
                Clear filters
              </Button>
              <Select
                value={search.status ?? 'all'}
                onValueChange={(value) =>
                  updateSearch({
                    status: value && value !== 'all' ? value : undefined,
                    page: undefined,
                  })
                }
                items={BUILD_STATUS_FILTER_OPTIONS}
              >
                <SelectTrigger
                  className="w-full sm:w-40"
                  aria-label="Filter by status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BUILD_STATUS_FILTER_OPTIONS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              {hasFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="col-span-2 sm:hidden"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>

          {buildsQuery.error ? (
            <Alert variant="destructive">
              <HugeiconsIcon icon={InformationCircleIcon} size={16} />
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>Failed to load builds: {buildsQuery.error.message}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void buildsQuery.refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {showTrueEmpty ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={PlayIcon} />
                </EmptyMedia>
                <EmptyTitle>No builds yet</EmptyTitle>
                <EmptyDescription>
                  {canTriggerBuild
                    ? 'Run this project’s first pipeline to see its status, output, and artifacts here.'
                    : 'Builds will appear here once triggered by a developer.'}
                </EmptyDescription>
              </EmptyHeader>
              {canTriggerBuild && pipelineCount > 0 && projectHasSource ? (
                <EmptyContent>
                  <Button size="sm" onClick={onTriggerBuild}>
                    <HugeiconsIcon icon={PlayIcon} />
                    Run first build
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : null}

          {showFilteredEmpty ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={Search01Icon} />
                </EmptyMedia>
                <EmptyTitle>No matching builds</EmptyTitle>
                <EmptyDescription>
                  Change the current filters or clear them to see all builds.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </EmptyContent>
            </Empty>
          ) : null}

          {!buildsQuery.error && (buildsQuery.isLoading || total > 0) ? (
            <ProjectBuildInventory
              builds={builds}
              direction={direction}
              isLoading={buildsQuery.isLoading}
              onPageChange={(nextPage) =>
                updateSearch({ page: nextPage > 1 ? nextPage : undefined })
              }
              onSearch={(value) =>
                updateSearch({ q: value.trim() || undefined, page: undefined })
              }
              onSortChange={handleSortChange}
              page={page}
              pageSize={pageSize}
              query={search.q ?? ''}
              sort={sort}
              total={total}
            />
          ) : null}
        </div>
      ) : null}
    </TabsContent>
  )
}
