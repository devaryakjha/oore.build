import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { MoreHorizontalCircle01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

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
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/lib/format-utils'
import {
  BUILD_STATUS_FILTER_OPTIONS,
  getRunnerPolicyBlockLabel,
  getStatusVariant,
} from '@/lib/status-variants'
import type { Build } from '@/api/types'
import type { BuildSort } from './-build-sort'

const BUILD_TABLE_SORTS = [
  'project_name',
  'status',
  'branch',
  'created_at',
] satisfies ReadonlyArray<BuildSort>

const loadBuildActionsMenu = () => import('./-build-actions-menu')
const BuildActionsMenu = lazy(loadBuildActionsMenu)
const loadBuildItem = () => import('@/components/build-item')
const BuildItem = lazy(() =>
  loadBuildItem().then((module) => ({ default: module.BuildItem })),
)

function projectName(build: Build) {
  return build.context?.project_name ?? 'Unknown project'
}

function BuildIdentity({ build }: { build: Build }) {
  return (
    <Link
      to="/builds/$buildId"
      params={{ buildId: build.id }}
      className="rounded-md font-mono text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      #{build.build_number}
    </Link>
  )
}

function BuildActionsControl({ build }: { build: Build }) {
  const [requested, setRequested] = useState(false)
  const [open, setOpen] = useState(false)

  const trigger = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Actions for build ${build.build_number}`}
      title="Build actions"
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
      <BuildActionsMenu build={build} open={open} onOpenChange={setOpen} />
    </Suspense>
  )
}

function getBuildColumns(): Array<DataTableColumnDef<Build>> {
  return [
    {
      accessorKey: 'build_number',
      header: 'Build',
      cell: ({ row }) => <BuildIdentity build={row.original} />,
      enableSorting: false,
    },
    {
      id: 'project_name',
      accessorFn: projectName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => (
        <>
          <p className="text-sm">{projectName(row.original)}</p>
          {row.original.context?.pipeline_name ? (
            <p className="text-xs text-muted-foreground">
              {row.original.context.pipeline_name}
            </p>
          ) : null}
        </>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <>
          <Badge variant={getStatusVariant(row.original.status)}>
            {BUILD_STATUS_FILTER_OPTIONS[row.original.status]}
          </Badge>
          {row.original.runner_policy_block_reason ? (
            <p className="mt-1 text-xs text-warning">
              {getRunnerPolicyBlockLabel(
                row.original.runner_policy_block_reason,
              )}
            </p>
          ) : null}
        </>
      ),
    },
    {
      accessorKey: 'trigger_type',
      header: 'Trigger',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.trigger_type}</Badge>
      ),
      enableSorting: false,
      meta: {
        cellClassName: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
      },
    },
    {
      accessorKey: 'branch',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Branch" />
      ),
      cell: ({ row }) => row.original.branch ?? 'n/a',
      meta: {
        cellClassName:
          'hidden font-mono text-xs text-muted-foreground lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
      },
    },
    {
      accessorKey: 'commit_sha',
      header: 'Commit',
      cell: ({ row }) => row.original.commit_sha?.slice(0, 10) ?? 'n/a',
      enableSorting: false,
      meta: {
        cellClassName:
          'hidden font-mono text-xs text-muted-foreground lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => relativeTime(row.original.created_at),
      meta: { cellClassName: 'text-sm text-muted-foreground' },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <BuildActionsControl build={row.original} />,
      enableHiding: false,
      enableSorting: false,
      meta: { headerClassName: 'w-10' },
    },
  ]
}

function CompactBuildsSkeleton() {
  return (
    <ItemGroup className="gap-2">
      {Array.from({ length: 5 }, (_, index) => (
        <Item key={index} variant="outline" aria-hidden>
          <ItemMedia>
            <Skeleton className="size-8 rounded-full" />
          </ItemMedia>
          <ItemContent>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </ItemContent>
          <ItemActions>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="size-8" />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

function BuildCollectionSkeleton({
  table,
}: {
  table: DataTableInstance<Build>
}) {
  return (
    <CollectionViewport
      compact={<CompactBuildsSkeleton />}
      desktop={
        <DataTableFrame fill>
          <DataTable table={table} isLoading />
        </DataTableFrame>
      }
    />
  )
}

function CompactBuilds({ builds }: { builds: Array<Build> }) {
  return (
    <Suspense fallback={<CompactBuildsSkeleton />}>
      <ItemGroup className="gap-2">
        {builds.map((build) => (
          <BuildItem
            key={build.id}
            build={build}
            action={<BuildActionsControl build={build} />}
          />
        ))}
      </ItemGroup>
    </Suspense>
  )
}

export function BuildCollection({
  builds,
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
  sort,
  total,
}: {
  builds: Array<Build>
  direction: SortDirection
  emptyState: ReactNode
  error: Error | null
  isLoading: boolean
  isRefreshing: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onRetry: () => void
  onSortChange: (sort: BuildSort, direction: SortDirection) => void
  page: number
  pageSize: number
  sort: BuildSort
  total: number
}) {
  const hasResults = total > 0
  const columns = useMemo(getBuildColumns, [])
  const sorting = useMemo(
    () => dataTableSortingState(sort, direction),
    [direction, sort],
  )
  const table = useDataTable({
    columns,
    data: builds,
    getRowId: (build) => build.id,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = resolveDataTableSorting(
        updater,
        sorting,
        BUILD_TABLE_SORTS,
      )
      if (next) onSortChange(next.sort, next.direction)
    },
  })

  return (
    <CollectionFrame
      ariaLabel="Build queue and history"
      isBusy={isLoading || isRefreshing}
    >
      {error ? (
        <CollectionError
          title="Builds could not be loaded"
          description={error.message}
          onRetry={onRetry}
        />
      ) : null}

      {isLoading ? (
        <BuildCollectionSkeleton table={table} />
      ) : hasResults ? (
        <CollectionViewport
          compact={
            <>
              <CompactBuilds builds={builds} />
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
