import * as z from 'zod'
import { useMemo } from 'react'
import type { Runner } from '@/api/types'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import RunnerStatusDot from '@/components/runner-status-dot'
import { getRunnerStatusVariant } from '@/lib/status-variants'

export type RunnerSort = 'created_at' | 'name' | 'status' | 'last_heartbeat_at'

const RUNNER_SORTS = [
  'name',
  'status',
  'last_heartbeat_at',
] satisfies ReadonlyArray<RunnerSort>

function relative(epoch?: number | null) {
  if (!epoch) return 'Never'
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - epoch)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

function capabilities(value: Runner['capabilities']) {
  return (
    Object.entries(value)
      .flatMap(([name, enabled]) => (enabled === true ? [name] : []))
      .join(', ') || 'None reported'
  )
}

function getRunnerColumns({
  canWrite,
  onRename,
}: {
  canWrite: boolean
  onRename: (runner: Runner) => void
}): Array<DataTableColumnDef<Runner>> {
  const columns: Array<DataTableColumnDef<Runner>> = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <>
          <p className="font-medium">{row.original.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {row.original.id.slice(0, 8)}
          </p>
        </>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center">
          <RunnerStatusDot status={row.original.status} />
          <Badge variant={getRunnerStatusVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'last_heartbeat_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last heartbeat" />
      ),
      cell: ({ row }) => relative(row.original.last_heartbeat_at),
      meta: { cellClassName: 'text-muted-foreground' },
    },
    {
      id: 'version',
      accessorFn: (runner) =>
        z.string().safeParse(runner.capabilities.version).data,
      header: 'Version',
      cell: ({ row }) =>
        z.string().safeParse(row.original.capabilities.version).data ??
        'Unknown',
      enableSorting: false,
      meta: {
        headerClassName: 'hidden lg:table-cell',
        cellClassName:
          'hidden font-mono text-xs text-muted-foreground lg:table-cell',
      },
    },
    {
      id: 'capabilities',
      accessorFn: (runner) => capabilities(runner.capabilities),
      header: 'Capabilities',
      enableSorting: false,
      meta: {
        headerClassName: 'hidden lg:table-cell',
        cellClassName: 'hidden text-xs text-muted-foreground lg:table-cell',
      },
    },
    {
      accessorKey: 'registered_by',
      header: 'Registered by',
      cell: ({ row }) => row.original.registered_by ?? 'embedded',
      enableSorting: false,
      meta: {
        headerClassName: 'hidden lg:table-cell',
        cellClassName: 'hidden text-sm text-muted-foreground lg:table-cell',
      },
    },
  ]

  if (canWrite) {
    columns.push({
      id: 'actions',
      header: 'Action',
      cell: ({ row }) =>
        row.original.registered_by ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRename(row.original)}
          >
            Rename
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Managed by daemon
          </span>
        ),
      enableHiding: false,
      enableSorting: false,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
    })
  }

  return columns
}

export function RunnerInventory({
  canWrite,
  direction,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onRename,
  onSortChange,
  page,
  pageSize,
  runners,
  sort,
  total,
}: {
  canWrite: boolean
  direction: SortDirection
  isLoading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onRename: (runner: Runner) => void
  onSortChange: (sort: RunnerSort, direction: SortDirection) => void
  page: number
  pageSize: number
  runners: Array<Runner>
  sort: RunnerSort
  total: number
}) {
  const columns = useMemo(
    () => getRunnerColumns({ canWrite, onRename }),
    [canWrite, onRename],
  )
  const sorting = useMemo(
    () => dataTableSortingState(sort, direction),
    [direction, sort],
  )
  const table = useDataTable({
    columns,
    data: runners,
    getRowId: (runner) => runner.id,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = resolveDataTableSorting(updater, sorting, RUNNER_SORTS)
      if (next) onSortChange(next.sort, next.direction)
    },
  })

  return (
    <section
      aria-label="Runner inventory"
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
                : runners.map((runner) => (
                    <article key={runner.id} className="space-y-3 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate font-medium">
                            {runner.name}
                          </h2>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {runner.id.slice(0, 8)}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <RunnerStatusDot status={runner.status} />
                          <Badge
                            variant={getRunnerStatusVariant(runner.status)}
                          >
                            {runner.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Heartbeat {relative(runner.last_heartbeat_at)}
                        </span>
                        <span>{runner.registered_by ?? 'Managed runner'}</span>
                      </div>
                      {canWrite && runner.registered_by ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRename(runner)}
                        >
                          Rename
                        </Button>
                      ) : null}
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
    </section>
  )
}
