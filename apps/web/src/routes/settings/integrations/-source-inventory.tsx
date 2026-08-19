import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'

import type { Integration } from '@/api/types'
import {
  DataTable,
  DataTableColumnHeader,
  DataTableFrame,
  useDataTable,
  type DataTableColumnDef,
} from '@/components/data-table'
import {
  dataTableSortingState,
  resolveDataTableSorting,
} from '@/components/data-table-features'
import { CollectionViewport } from '@/components/collection'
import type { SortDirection } from '@/components/collection-controls'
import { CollectionPagination } from '@/components/collection-controls'
import { relativeTime } from '@/lib/format-utils'
import { getIntegrationStatusVariant } from '@/lib/status-variants'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export type IntegrationSort = 'name' | 'provider' | 'status' | 'updated_at'

const INTEGRATION_SORTS = [
  'name',
  'provider',
  'status',
  'updated_at',
] satisfies ReadonlyArray<IntegrationSort>

function providerLabel(provider: Integration['provider']): string {
  if (provider === 'github') return 'GitHub'
  if (provider === 'gitlab') return 'GitLab'
  return 'Local Git'
}

function authModeLabel(mode: string): string {
  const labels = new Map([
    ['github_app', 'GitHub App'],
    ['github_app_manifest', 'GitHub App manifest'],
    ['oauth_app', 'OAuth app'],
    ['pat', 'Personal access token'],
    ['personal_token', 'Personal access token'],
  ])
  return labels.get(mode) ?? mode.replace(/_/g, ' ')
}

function sourceIdentity(integration: Integration) {
  return (
    <Link
      to="/settings/integrations/$integrationId"
      params={{ integrationId: integration.id }}
      className="group block min-w-0 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="block truncate font-medium group-hover:underline">
        {integration.display_name ?? integration.provider}
      </span>
      <span className="block truncate font-mono text-[11px] text-muted-foreground">
        {integration.id.slice(0, 8)}
      </span>
    </Link>
  )
}

const sourceColumns: Array<DataTableColumnDef<Integration>> = [
  {
    id: 'name',
    accessorFn: (integration) => integration.display_name,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Source" />
    ),
    cell: ({ row }) => sourceIdentity(row.original),
  },
  {
    accessorKey: 'provider',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{providerLabel(row.original.provider)}</Badge>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={getIntegrationStatusVariant(row.original.status)}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'auth_mode',
    header: 'Authentication',
    cell: ({ row }) => authModeLabel(row.original.auth_mode),
    enableSorting: false,
    meta: {
      headerClassName: 'hidden lg:table-cell',
      cellClassName:
        'hidden font-mono text-xs text-muted-foreground lg:table-cell',
    },
  },
  {
    accessorKey: 'host_url',
    header: 'Host',
    enableSorting: false,
    meta: {
      headerClassName: 'hidden lg:table-cell',
      cellClassName:
        'hidden max-w-[24ch] truncate text-xs text-muted-foreground lg:table-cell',
    },
  },
  {
    accessorKey: 'updated_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ row }) => relativeTime(row.original.updated_at),
    meta: {
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden text-xs text-muted-foreground lg:table-cell',
    },
  },
]

export function SourceInventory({
  direction,
  integrations,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  page,
  pageSize,
  sort,
  total,
}: {
  direction: SortDirection
  integrations: Array<Integration>
  isLoading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSortChange: (sort: IntegrationSort, direction: SortDirection) => void
  page: number
  pageSize: number
  sort: IntegrationSort
  total: number
}) {
  const sorting = useMemo(
    () => dataTableSortingState(sort, direction),
    [direction, sort],
  )
  const table = useDataTable({
    columns: sourceColumns,
    data: integrations,
    getRowId: (integration) => integration.id,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = resolveDataTableSorting(updater, sorting, INTEGRATION_SORTS)
      if (next) onSortChange(next.sort, next.direction)
    },
  })

  return (
    <div
      aria-label="Connected source inventory"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <CollectionViewport
        compact={
          <>
            <div className="divide-y">
              {isLoading
                ? Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="my-4 h-16 w-full" />
                  ))
                : integrations.map((integration) => (
                    <article key={integration.id} className="space-y-3 py-4">
                      <div className="flex items-start justify-between gap-3">
                        {sourceIdentity(integration)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {providerLabel(integration.provider)}
                        </Badge>
                        <Badge
                          variant={getIntegrationStatusVariant(
                            integration.status,
                          )}
                        >
                          {integration.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Updated {relativeTime(integration.updated_at)}
                        </span>
                      </div>
                    </article>
                  ))}
            </div>
            {!isLoading ? (
              <CollectionPagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            ) : null}
          </>
        }
        desktop={
          <div className="flex min-h-0 flex-1 flex-col">
            <DataTableFrame
              fill
              footer={
                !isLoading ? (
                  <CollectionPagination
                    embedded
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                  />
                ) : undefined
              }
            >
              <DataTable table={table} isLoading={isLoading} />
            </DataTableFrame>
          </div>
        }
      />
    </div>
  )
}
