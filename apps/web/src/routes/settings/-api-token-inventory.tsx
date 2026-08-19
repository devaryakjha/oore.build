import type { ApiTokenSummary } from '@/api/types'
import { useMemo } from 'react'
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
import type { ApiTokenSort } from './api-tokens'
import type { SortDirection } from '@/components/data-table-features'
import { Badge } from '@/components/ui/badge'
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
    },
    {
      accessorKey: 'prefix',
      header: 'Prefix',
      cell: ({ row }) => `${row.original.prefix}...`,
      enableSorting: false,
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
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => relative(row.original.created_at),
    },
    {
      accessorKey: 'last_used_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last used" />
      ),
      cell: ({ row }) => relative(row.original.last_used_at),
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
          <ApiTokenActions onRevoke={() => onRevoke(row.original)} />
        ) : null,
      enableHiding: false,
      enableSorting: false,
    },
  ]
}

export function ApiTokenInventory({
  canDelete,
  direction,
  isLoading,
  onPageChange,
  onRevoke,
  onSearch,
  onSortChange,
  page,
  pageSize,
  query,
  sort,
  tokens,
  total,
}: {
  canDelete: boolean
  direction: SortDirection
  isLoading: boolean
  onPageChange: (page: number) => void
  onRevoke: (token: ApiTokenSummary) => void
  onSearch: (query: string) => void
  onSortChange: (sort: ApiTokenSort, direction: SortDirection) => void
  page: number
  pageSize: number
  query: string
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
      <DataTable
        table={table}
        search={{
          value: query,
          onChange: onSearch,
          placeholder: 'Search API tokens',
        }}
        pagination={{ onPageChange, page, pageSize, total }}
        emptyMessage={isLoading ? 'Loading API tokens…' : undefined}
      />
    </section>
  )
}
