import type { ApiTokenSummary } from '@/api/types'
import { useMemo } from 'react'
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
import type { ApiTokenSort } from './api-tokens'
import type { SortDirection } from '@/components/collection-controls'
import { CollectionPagination } from '@/components/collection-controls'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiTokenActions } from './-api-token-actions'

const API_TOKEN_TABLE_SORTS = [
  'name',
  'role',
  'created_at',
  'last_used_at',
  'status',
] satisfies ReadonlyArray<ApiTokenSort>

interface RoleLabels {
  [role: string]: string
}

const roles: RoleLabels = {
  owner: 'Owner',
  admin: 'Admin',
  developer: 'Developer',
  qa_viewer: 'QA Viewer',
}

function status(token: ApiTokenSummary) {
  if (token.is_revoked) return 'revoked'
  if (token.expires_at && token.expires_at * 1000 < Date.now()) return 'expired'
  return 'active'
}

function relative(epoch?: number | null) {
  if (!epoch) return 'Never'
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - epoch)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function TokenStatusBadge({ token }: { token: ApiTokenSummary }) {
  const tokenStatus = status(token)

  return (
    <Badge
      variant={
        tokenStatus === 'active'
          ? 'secondary'
          : tokenStatus === 'revoked'
            ? 'destructive'
            : 'outline'
      }
    >
      {tokenStatus}
    </Badge>
  )
}

function getApiTokenColumns({
  canDelete,
  onRevoke,
}: {
  canDelete: boolean
  onRevoke: (token: ApiTokenSummary) => void
}): Array<DataTableColumnDef<ApiTokenSummary>> {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => row.original.name,
      meta: { cellClassName: 'font-medium' },
    },
    {
      accessorKey: 'prefix',
      header: 'Prefix',
      cell: ({ row }) => `${row.original.prefix}...`,
      enableSorting: false,
      meta: {
        cellClassName:
          'hidden font-mono text-xs text-muted-foreground lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
      },
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
      cell: ({ row }) => (
        <Badge variant="secondary">
          {roles[row.original.role] ?? row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_by_email',
      header: 'Created by',
      enableSorting: false,
      meta: {
        cellClassName: 'hidden text-sm text-muted-foreground lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => relative(row.original.created_at),
      meta: {
        cellClassName: 'hidden text-muted-foreground lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
      },
    },
    {
      accessorKey: 'last_used_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last used" />
      ),
      cell: ({ row }) => relative(row.original.last_used_at),
      meta: {
        cellClassName: 'hidden text-muted-foreground lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
      },
    },
    {
      id: 'status',
      accessorFn: status,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <TokenStatusBadge token={row.original} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) =>
        status(row.original) === 'active' && canDelete ? (
          <ApiTokenActions
            token={row.original}
            onRevoke={() => onRevoke(row.original)}
          />
        ) : null,
      enableHiding: false,
      enableSorting: false,
      meta: {
        cellClassName: 'text-right',
        headerClassName: 'text-right',
      },
    },
  ]
}

export function ApiTokenInventory({
  canDelete,
  direction,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onRevoke,
  onSortChange,
  page,
  pageSize,
  sort,
  tokens,
  total,
}: {
  canDelete: boolean
  direction: SortDirection
  isLoading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onRevoke: (token: ApiTokenSummary) => void
  onSortChange: (sort: ApiTokenSort, direction: SortDirection) => void
  page: number
  pageSize: number
  sort: ApiTokenSort
  tokens: Array<ApiTokenSummary>
  total: number
}) {
  const columns = useMemo(
    () => getApiTokenColumns({ canDelete, onRevoke }),
    [canDelete, onRevoke],
  )
  const sorting = useMemo(
    () => dataTableSortingState(sort, direction),
    [direction, sort],
  )
  const table = useDataTable({
    columns,
    data: tokens,
    getRowId: (token) => token.id,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = resolveDataTableSorting(
        updater,
        sorting,
        API_TOKEN_TABLE_SORTS,
      )
      if (next) onSortChange(next.sort, next.direction)
    },
  })

  return (
    <section
      aria-label="API token inventory"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <CollectionViewport
        compact={
          <>
            <div className="divide-y">
              {isLoading
                ? Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="my-4 h-16 w-full" />
                  ))
                : tokens.map((token) => {
                    const tokenStatus = status(token)
                    return (
                      <article key={token.id} className="space-y-3 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="truncate font-medium">
                              {token.name}
                            </h2>
                            <code className="block truncate font-mono text-xs text-muted-foreground">
                              {token.prefix}...
                            </code>
                          </div>
                          <Badge
                            variant={
                              tokenStatus === 'active'
                                ? 'secondary'
                                : tokenStatus === 'revoked'
                                  ? 'destructive'
                                  : 'outline'
                            }
                          >
                            {tokenStatus}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">
                            {roles[token.role] ?? token.role}
                          </Badge>
                          <span>Created {relative(token.created_at)}</span>
                          <span>Used {relative(token.last_used_at)}</span>
                        </div>
                        {tokenStatus === 'active' && canDelete ? (
                          <ApiTokenActions
                            token={token}
                            onRevoke={() => onRevoke(token)}
                          />
                        ) : null}
                      </article>
                    )
                  })}
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
    </section>
  )
}
