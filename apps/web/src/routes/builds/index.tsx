import { lazy, Suspense, useState } from 'react'
import { createFileRoute, redirect, useSearch } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { InformationCircleIcon, PlayIcon } from '@hugeicons/core-free-icons'

import {
  getActiveInstanceOrRedirect,
  requireAuthOrRedirect,
} from '@/lib/instance-context'
import { useBuilds } from '@/hooks/use-builds'
import { useHasPermissions } from '@/hooks/use-permissions'
import { useProjects } from '@/hooks/use-projects'
import { useSetupStatus } from '@/hooks/use-setup'
import { usePageClamp } from '@/hooks/use-page-clamp'
import { BUILD_STATUS_FILTER_OPTIONS } from '@/lib/status-variants'
import { searchChoice, searchNumber, searchString } from '@/lib/search-input'
import type { SearchInput } from '@/lib/search-input'
import { useAuthStore } from '@/stores/auth-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/page-header'
import PageLayout from '@/components/page-layout'
import type { SortDirection } from '@/components/collection-controls'
import { PageMeta } from '@/lib/seo'
import { BuildCollection } from './-build-collection'
import { BuildsEmptyState } from './-builds-empty-state'
import { BuildFilters } from './-build-filters'
import type { BuildSort } from './-build-sort'

const loadTriggerBuildDrawer = () => import('@/components/trigger-build-drawer')
const TriggerBuildDrawer = lazy(loadTriggerBuildDrawer)

interface BuildsSearch {
  direction?: SortDirection
  page?: number
  pageSize?: 20 | 50 | 100
  project?: string
  q?: string
  sort?: BuildSort
  status?: string
}

const BUILD_SORT_VALUES = new Set<BuildSort>([
  'created_at',
  'status',
  'project_name',
  'pipeline_name',
  'branch',
])

function parseSearch(search: SearchInput): BuildsSearch {
  const page = searchNumber(search, 'page')
  const pageSize = searchNumber(search, 'pageSize')
  const q = searchString(search, 'q')?.trim() ?? ''
  const project = searchString(search, 'project')?.trim() ?? ''
  const statusValue = searchString(search, 'status')
  const status =
    statusValue && statusValue in BUILD_STATUS_FILTER_OPTIONS ? statusValue : ''
  const sort = searchChoice(search, 'sort', BUILD_SORT_VALUES)

  return {
    q: q || undefined,
    project: project || undefined,
    status: status && status !== 'all' ? status : undefined,
    sort,
    direction: searchString(search, 'direction') === 'asc' ? 'asc' : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    pageSize: pageSize === 50 || pageSize === 100 ? pageSize : undefined,
  }
}

export const Route = createFileRoute('/builds/')({
  validateSearch: parseSearch,
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireAuthOrRedirect(instance.id)
    if (useAuthStore.getState().user?.role === 'qa_viewer') {
      throw redirect({ to: '/' })
    }
  },
  component: OperationsBuildsPage,
})

function OperationsBuildsPage() {
  const [buildDrawerOpen, setBuildDrawerOpen] = useState(false)
  const search = useSearch({ from: '/builds/' })
  const navigate = Route.useNavigate()
  const page = search.page ?? 1
  const pageSize = search.pageSize ?? 20
  const sort = search.sort ?? 'created_at'
  const direction = search.direction ?? 'desc'
  const buildsQuery = useBuilds({
    branch: search.q,
    project_id: search.project,
    status: search.status,
    sort,
    direction,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })
  const projectsQuery = useProjects({ limit: 1 })
  const setupStatusQuery = useSetupStatus()
  const [canTriggerBuildGlobally, canWriteProjects, canWriteIntegrations] =
    useHasPermissions(['builds:write', 'projects:write', 'integrations:write'])
  const builds = buildsQuery.data?.builds ?? []
  const hasProjects = (projectsQuery.data?.total ?? 0) > 0
  const total = buildsQuery.data?.total ?? 0
  const canTriggerBuild = canTriggerBuildGlobally && hasProjects
  const runtimeMode = setupStatusQuery.data?.runtime_mode ?? 'local'
  const projectsResolved = !projectsQuery.isLoading && !projectsQuery.error
  const missingProjects = projectsResolved && !hasProjects
  const hasFilters = !!search.q || !!search.project || !!search.status
  const buildCapabilities = {
    triggerBuild: canTriggerBuild,
    writeIntegrations: canWriteIntegrations,
    writeProjects: canWriteProjects,
  }

  function updateSearch(updates: Partial<BuildsSearch>) {
    void navigate({
      search: (previous) => ({ ...previous, ...updates }),
      replace: true,
    })
  }

  usePageClamp(page, pageSize, buildsQuery.data?.total, (nextPage) => {
    updateSearch({ page: nextPage === 1 ? undefined : nextPage })
  })

  function handleSortChange(nextSort: BuildSort, next: SortDirection) {
    updateSearch({ sort: nextSort, direction: next, page: undefined })
  }

  function clearFilters() {
    updateSearch({
      q: undefined,
      project: undefined,
      status: undefined,
      page: undefined,
    })
  }

  const showFilteredEmpty =
    !buildsQuery.isLoading && !buildsQuery.error && total === 0 && hasFilters
  const showTrueEmpty =
    !buildsQuery.isLoading &&
    !buildsQuery.error &&
    total === 0 &&
    !hasFilters &&
    !missingProjects

  return (
    <PageLayout width="wide" fill>
      <PageMeta title="Builds" noindex />
      <PageHeader
        title="Builds"
        description="Queue, execution, and historical run inventory across projects."
        actions={
          !missingProjects && canTriggerBuild ? (
            <Suspense fallback={null}>
              <TriggerBuildDrawer
                description="Choose a project and pipeline to run a manual build."
                open={buildDrawerOpen}
                onOpenChange={setBuildDrawerOpen}
                onBuildCreated={(buildId) => {
                  void navigate({
                    to: '/builds/$buildId',
                    params: { buildId },
                  })
                }}
              >
                <Button>
                  <HugeiconsIcon icon={PlayIcon} />
                  Run build
                </Button>
              </TriggerBuildDrawer>
            </Suspense>
          ) : undefined
        }
      />

      {!missingProjects ? (
        <BuildFilters
          direction={direction}
          filters={search}
          onChange={updateSearch}
          onSortChange={handleSortChange}
          sort={sort}
        />
      ) : null}

      {projectsQuery.error ? (
        <Alert>
          <HugeiconsIcon icon={InformationCircleIcon} />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Project filters and build actions are temporarily unavailable.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void projectsQuery.refetch()}
            >
              Retry projects
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <BuildsEmptyState
        capabilities={buildCapabilities}
        onClearFilters={clearFilters}
        onRunBuild={() => setBuildDrawerOpen(true)}
        runtimeMode={runtimeMode}
        state={missingProjects ? 'missing-projects' : null}
      />

      {!missingProjects ? (
        <BuildCollection
          builds={builds}
          direction={direction}
          emptyState={
            <BuildsEmptyState
              capabilities={buildCapabilities}
              onClearFilters={clearFilters}
              onRunBuild={() => setBuildDrawerOpen(true)}
              runtimeMode={runtimeMode}
              state={
                showTrueEmpty
                  ? 'no-builds'
                  : showFilteredEmpty
                    ? 'no-results'
                    : null
              }
            />
          }
          error={buildsQuery.error}
          isLoading={buildsQuery.isLoading}
          isRefreshing={buildsQuery.isFetching && !buildsQuery.isLoading}
          onPageChange={(nextPage) =>
            updateSearch({ page: nextPage > 1 ? nextPage : undefined })
          }
          onPageSizeChange={(nextPageSize) =>
            updateSearch({
              pageSize:
                nextPageSize === 50 || nextPageSize === 100
                  ? nextPageSize
                  : undefined,
              page: undefined,
            })
          }
          onSortChange={handleSortChange}
          onRetry={() => void buildsQuery.refetch()}
          page={page}
          pageSize={pageSize}
          sort={sort}
          total={total}
        />
      ) : null}
    </PageLayout>
  )
}
