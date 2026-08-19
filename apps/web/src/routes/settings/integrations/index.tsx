import { Link, createFileRoute, useSearch } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { InformationCircleIcon, Link04Icon } from '@hugeicons/core-free-icons'
import { toast } from '@/lib/toast'
import { searchChoice, searchNumber, searchString } from '@/lib/search-input'
import type { SearchInput } from '@/lib/search-input'

import { useMountEffect } from '@/hooks/use-mount-effect'
import { usePageClamp } from '@/hooks/use-page-clamp'
import {
  getActiveInstanceOrRedirect,
  requireInstanceRoleOrRedirect,
} from '@/lib/instance-context'
import { useHasPermission } from '@/hooks/use-permissions'
import { useInstancePreferences } from '@/hooks/use-artifact-storage'
import { useIntegrations } from '@/hooks/use-integrations'
import { PageMeta } from '@/lib/seo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { SortDirection } from '@/components/data-table-features'
import PageHeader from '@/components/page-header'
import PageLayout from '@/components/page-layout'
import type { IntegrationSort } from './-source-inventory'
import { ConnectSourceOptions } from './-connect-source-options'
import { ConnectedSourcesSection } from './-connected-sources-section'

interface IntegrationsSearch {
  direction?: SortDirection
  github?: string
  integration_id?: string
  page?: number
  pageSize?: 20 | 50 | 100
  q?: string
  sort?: IntegrationSort
}

const INTEGRATION_SORTS = new Set<IntegrationSort>([
  'name',
  'provider',
  'status',
  'updated_at',
])

function parseSearch(search: SearchInput): IntegrationsSearch {
  const page = searchNumber(search, 'page')
  const pageSize = searchNumber(search, 'pageSize')
  const sort = searchChoice(search, 'sort', INTEGRATION_SORTS)
  const q = searchString(search, 'q')?.trim() ?? ''

  return {
    github: searchString(search, 'github'),
    integration_id: searchString(search, 'integration_id'),
    q: q || undefined,
    sort,
    direction: searchString(search, 'direction') === 'asc' ? 'asc' : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    pageSize: pageSize === 50 || pageSize === 100 ? pageSize : undefined,
  }
}

export const Route = createFileRoute('/settings/integrations/')({
  validateSearch: parseSearch,
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireInstanceRoleOrRedirect(instance.id, ['owner', 'admin', 'developer'])
  },
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const canWrite = useHasPermission('integrations:write')
  const search = useSearch({ from: '/settings/integrations/' })
  const navigate = Route.useNavigate()
  const preferencesQuery = useInstancePreferences({ enabled: canWrite })
  const runtimeMode = preferencesQuery.data?.runtime_mode
  const sourcesAvailable = !canWrite || runtimeMode === 'remote'
  const pageSize = search.pageSize ?? 20
  const sort = search.sort ?? 'updated_at'
  const direction = search.direction ?? 'desc'
  const requestedPage = search.page ?? 1
  const integrationsQuery = useIntegrations({
    q: search.q,
    sort,
    direction,
    limit: pageSize,
    offset: (requestedPage - 1) * pageSize,
  })

  useMountEffect(() => {
    if (search.github === 'success') {
      toast.success('GitHub App connected successfully')
      window.history.replaceState({}, '', '/settings/integrations')
    }
  })

  const visibleIntegrations = integrationsQuery.data?.integrations ?? []
  const total = integrationsQuery.data?.total ?? 0
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)))

  function updateSearch(updates: Partial<IntegrationsSearch>) {
    void navigate({
      search: (previous) => ({ ...previous, ...updates }),
      replace: true,
    })
  }

  usePageClamp(
    requestedPage,
    pageSize,
    integrationsQuery.isLoading ? undefined : total,
    (nextPage) => {
      updateSearch({ page: nextPage === 1 ? undefined : nextPage })
    },
  )

  function handleSortChange(nextSort: IntegrationSort, next: SortDirection) {
    updateSearch({ sort: nextSort, direction: next, page: undefined })
  }

  const hasSearch = !!search.q
  const hasConnectedSources = total > 0 || Boolean(search.q)
  return (
    <PageLayout width="wide" fill>
      <PageMeta title="Sources" noindex />
      <PageHeader
        title="Sources"
        description="Source connections used to discover repositories and trigger builds."
        actions={
          sourcesAvailable && canWrite && hasConnectedSources ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button />}>
                <HugeiconsIcon
                  icon={Link04Icon}
                  data-icon="inline-start"
                  aria-hidden
                />
                Connect source
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() =>
                      void navigate({ to: '/settings/integrations/github' })
                    }
                  >
                    GitHub
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void navigate({ to: '/settings/integrations/gitlab' })
                    }
                  >
                    GitLab
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />

      {canWrite && preferencesQuery.isLoading ? (
        <section aria-label="Source access policy" className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full" />
        </section>
      ) : canWrite && preferencesQuery.error ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Failed to load access policy: {preferencesQuery.error.message}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void preferencesQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : !sourcesAvailable ? (
        <section
          className="space-y-3"
          aria-labelledby="local-only-sources-title"
        >
          <Separator />
          <div>
            <h2 id="local-only-sources-title" className="text-sm font-semibold">
              Local Only mode
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create projects from paths on this Mac. GitHub and GitLab sources
              become available when External Access is configured.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              render={<Link to="/settings/preferences" />}
              nativeButton={false}
            >
              Open General settings
            </Button>
            <Button render={<Link to="/projects" />} nativeButton={false}>
              Go to projects
            </Button>
          </div>
        </section>
      ) : null}

      {sourcesAvailable &&
      (integrationsQuery.isLoading ||
        integrationsQuery.error ||
        hasConnectedSources ||
        hasSearch ||
        !canWrite) ? (
        <ConnectedSourcesSection
          canWrite={canWrite}
          direction={direction}
          error={integrationsQuery.error}
          integrations={visibleIntegrations}
          isLoading={integrationsQuery.isLoading}
          onClearSearch={() => updateSearch({ q: undefined, page: undefined })}
          onPageChange={(nextPage) =>
            updateSearch({ page: nextPage > 1 ? nextPage : undefined })
          }
          onRetry={() => void integrationsQuery.refetch()}
          onSearch={(value) =>
            updateSearch({ q: value.trim() || undefined, page: undefined })
          }
          onSortChange={handleSortChange}
          page={page}
          pageSize={pageSize}
          search={search.q}
          sort={sort}
          total={total}
        />
      ) : null}

      {sourcesAvailable &&
      canWrite &&
      !integrationsQuery.isLoading &&
      !integrationsQuery.error &&
      !hasConnectedSources ? (
        <ConnectSourceOptions />
      ) : null}

      {sourcesAvailable && !canWrite ? (
        <Alert>
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription>
            You have read-only access to connected sources. An owner or admin
            can add, reconnect, or disconnect providers.
          </AlertDescription>
        </Alert>
      ) : null}
    </PageLayout>
  )
}
