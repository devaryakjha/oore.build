import { useMemo, type ReactNode } from 'react'

import {
  CollectionError,
  CollectionFrame,
  CollectionViewport,
} from '@/components/collection'
import {
  DataTable,
  DataTableColumnHeader,
  DataTableFrame,
  dataTableSortingState,
  resolveDataTableSorting,
  useDataTable,
  type DataTableColumnDef,
  type DataTableInstance,
} from '@/components/data-table'
import {
  CollectionPagination,
  type SortDirection,
} from '@/components/collection-controls'
import { Badge } from '@/components/ui/badge'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/lib/format-utils'
import type { AuditLogEntry } from '@/api/types'

export type AuditSort =
  | 'created_at'
  | 'actor_email'
  | 'action'
  | 'resource_type'

const AUDIT_SORTS = [
  'created_at',
  'actor_email',
  'action',
  'resource_type',
] satisfies ReadonlyArray<AuditSort>

function auditActionLabel(action: string) {
  const words = action.replace(/[._-]+/g, ' ')
  return words.charAt(0).toLocaleUpperCase() + words.slice(1)
}

function auditResourceLabel(resourceType: string) {
  return resourceType.replaceAll('_', ' ')
}

function AuditTime({ entry }: { entry: AuditLogEntry }) {
  return (
    <time
      dateTime={new Date(entry.created_at * 1000).toISOString()}
      title={new Date(entry.created_at * 1000).toLocaleString()}
      className="text-xs whitespace-nowrap text-muted-foreground"
    >
      {relativeTime(entry.created_at)}
    </time>
  )
}

function CompactAuditSkeleton() {
  return (
    <ItemGroup className="gap-2">
      {Array.from({ length: 5 }, (_, index) => (
        <Item key={index} variant="outline" className="flex-nowrap" aria-hidden>
          <ItemContent>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </ItemContent>
          <ItemActions>
            <Skeleton className="h-4 w-16" />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

function AuditCollectionSkeleton({ table }: { table: DataTableInstance<AuditLogEntry> }) {
  return (
    <CollectionViewport
      compact={<CompactAuditSkeleton />}
      desktop={
        <DataTableFrame fill>
          <DataTable table={table} isLoading />
        </DataTableFrame>
      }
    />
  )
}

function CompactAuditLog({ entries }: { entries: Array<AuditLogEntry> }) {
  return (
    <ItemGroup className="gap-2">
      {entries.map((entry) => (
        <Item key={entry.id} variant="outline" className="flex-nowrap">
          <ItemContent className="min-w-0">
            <ItemTitle>{auditActionLabel(entry.action)}</ItemTitle>
            <ItemDescription>
              <span className="block truncate">
                {entry.actor_email ?? 'System'}
                {' · '}
                {auditResourceLabel(entry.resource_type)}
                {entry.resource_id ? (
                  <>
                    {' · '}
                    <span className="font-mono">
                      {entry.resource_id.slice(0, 8)}
                    </span>
                  </>
                ) : null}
              </span>
              {entry.details ? (
                <span className="block truncate">{entry.details}</span>
              ) : null}
            </ItemDescription>
          </ItemContent>
          <ItemActions className="self-start">
            <AuditTime entry={entry} />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

const auditColumns: Array<DataTableColumnDef<AuditLogEntry>> = [
  {
    accessorKey: 'created_at',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
    cell: ({ row }) => <AuditTime entry={row.original} />,
    meta: { skeleton: <Skeleton className="h-4 w-20" /> },
  },
  {
    accessorKey: 'actor_email',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Actor" />,
    cell: ({ row }) => row.original.actor_email ?? <span className="text-muted-foreground">System</span>,
    meta: { cellClassName: 'max-w-40 truncate text-sm', skeleton: <Skeleton className="h-4 w-32" /> },
  },
  {
    accessorKey: 'action',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
    cell: ({ row }) => <Badge variant="outline" className="max-w-full truncate">{auditActionLabel(row.original.action)}</Badge>,
    meta: { cellClassName: 'max-w-48', skeleton: <Skeleton className="h-5 w-28" /> },
  },
  {
    accessorKey: 'resource_type',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Resource" />,
    cell: ({ row }) => <Badge variant="secondary">{auditResourceLabel(row.original.resource_type)}</Badge>,
  },
  {
    accessorKey: 'resource_id',
    header: 'Resource ID',
    cell: ({ row }) => row.original.resource_id?.slice(0, 8) ?? 'Not available',
    enableSorting: false,
    meta: { headerClassName: 'hidden lg:table-cell', cellClassName: 'hidden font-mono text-[11px] text-muted-foreground lg:table-cell' },
  },
  {
    accessorKey: 'details',
    header: 'Details',
    cell: ({ row }) => row.original.details ?? 'Not available',
    enableSorting: false,
    meta: { headerClassName: 'hidden lg:table-cell', cellClassName: 'hidden max-w-xs truncate text-xs text-muted-foreground lg:table-cell' },
  },
]

export function AuditLogCollection({
  direction,
  emptyState,
  entries,
  error,
  isLoading,
  isRefreshing,
  onPageChange,
  onPageSizeChange,
  onRetry,
  onSortChange,
  page,
  pageSize,
  sort,
  total,
}: {
  direction: SortDirection
  emptyState: ReactNode
  entries: Array<AuditLogEntry>
  error: Error | null
  isLoading: boolean
  isRefreshing: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onRetry: () => void
  onSortChange: (sort: AuditSort, direction: SortDirection) => void
  page: number
  pageSize: number
  sort: AuditSort
  total: number
}) {
  const hasResults = total > 0
  const sorting = useMemo(() => dataTableSortingState(sort, direction), [direction, sort])
  const table = useDataTable({
    columns: auditColumns,
    data: entries,
    getRowId: (entry) => String(entry.id),
    state: { sorting },
    onSortingChange: (updater) => {
      const next = resolveDataTableSorting(updater, sorting, AUDIT_SORTS)
      if (next) onSortChange(next.sort, next.direction)
    },
  })

  return (
    <CollectionFrame
      ariaLabel="Audit activity"
      isBusy={isLoading || isRefreshing}
    >
      {error ? (
        <CollectionError
          title="Audit log could not be loaded"
          description={error.message}
          onRetry={onRetry}
        />
      ) : null}

      {isLoading ? (
        <AuditCollectionSkeleton table={table} />
      ) : hasResults ? (
        <CollectionViewport
          compact={
            <>
              <CompactAuditLog entries={entries} />
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
