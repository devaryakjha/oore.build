import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChevronRightIcon } from '@hugeicons/core-free-icons'

import type { Build } from '@/api/types'
import { CollectionViewport } from '@/components/collection'
import {
  DataTable,
  DataTableColumnHeader,
  DataTableFrame,
  dataTableSortingState,
  resolveDataTableSorting,
  useDataTable,
  type DataTableColumnDef,
} from '@/components/data-table'
import type { SortDirection } from '@/components/collection-controls'
import { CollectionPagination } from '@/components/collection-controls'
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
import {
  BUILD_STATUS_FILTER_OPTIONS,
  getStatusVariant,
} from '@/lib/status-variants'
import type { ProjectBuildSort } from './-project-build-sort'

const PROJECT_BUILD_SORTS = [
  'pipeline_name',
  'status',
  'branch',
  'created_at',
] satisfies ReadonlyArray<ProjectBuildSort>

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

function CompactBuildsSkeleton() {
  return (
    <ItemGroup className="gap-2">
      {Array.from({ length: 5 }, (_, index) => (
        <Item key={index} variant="outline" aria-hidden>
          <ItemContent>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </ItemContent>
          <ItemActions>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="size-4" />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

function CompactBuilds({ builds }: { builds: Array<Build> }) {
  return (
    <ItemGroup className="gap-2">
      {builds.map((build) => (
        <Item
          key={build.id}
          variant="outline"
          render={
            <Link
              to="/builds/$buildId"
              params={{ buildId: build.id }}
              aria-label={`Open build #${build.build_number}`}
            />
          }
        >
          <ItemContent className="min-w-0">
            <ItemTitle>
              #{build.build_number}
              <span className="font-normal text-muted-foreground">
                {build.context?.pipeline_name ?? 'Unknown pipeline'}
              </span>
            </ItemTitle>
            <ItemDescription className="line-clamp-1">
              {build.branch ?? 'No branch'} · {relativeTime(build.created_at)}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant={getStatusVariant(build.status)}>
              {BUILD_STATUS_FILTER_OPTIONS[build.status]}
            </Badge>
            <HugeiconsIcon icon={ChevronRightIcon} />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

const projectBuildColumns: Array<DataTableColumnDef<Build>> = [
  {
    accessorKey: 'build_number',
    header: 'Build',
    cell: ({ row }) => <BuildIdentity build={row.original} />,
    enableSorting: false,
    meta: { skeleton: <Skeleton className="h-8 w-20" /> },
  },
  {
    id: 'pipeline_name',
    accessorFn: (build) => build.context?.pipeline_name,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pipeline" />
    ),
    cell: ({ row }) => row.original.context?.pipeline_name ?? 'Unknown pipeline',
    meta: { skeleton: <Skeleton className="h-8 w-32" /> },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={getStatusVariant(row.original.status)}>
        {BUILD_STATUS_FILTER_OPTIONS[row.original.status]}
      </Badge>
    ),
    meta: { skeleton: <Skeleton className="h-6 w-20" /> },
  },
  {
    accessorKey: 'trigger_type',
    header: 'Trigger',
    cell: ({ row }) => <Badge variant="outline">{row.original.trigger_type}</Badge>,
    enableSorting: false,
    meta: {
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
      skeleton: <Skeleton className="h-6 w-24" />,
    },
  },
  {
    accessorKey: 'branch',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Branch" />
    ),
    cell: ({ row }) => row.original.branch ?? 'n/a',
    meta: {
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden font-mono text-xs text-muted-foreground lg:table-cell',
    },
  },
  {
    accessorKey: 'commit_sha',
    header: 'Commit',
    cell: ({ row }) => row.original.commit_sha?.slice(0, 10) ?? 'n/a',
    enableSorting: false,
    meta: {
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden font-mono text-xs text-muted-foreground lg:table-cell',
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
]

export function ProjectBuildInventory({
  builds,
  direction,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  page,
  pageSize,
  sort,
  total,
}: {
  builds: Array<Build>
  direction: SortDirection
  isLoading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onSortChange: (sort: ProjectBuildSort, direction: SortDirection) => void
  page: number
  pageSize: number
  sort: ProjectBuildSort
  total: number
}) {
  const sorting = useMemo(
    () => dataTableSortingState(sort, direction),
    [direction, sort],
  )
  const table = useDataTable({
    columns: projectBuildColumns,
    data: builds,
    getRowId: (build) => build.id,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = resolveDataTableSorting(updater, sorting, PROJECT_BUILD_SORTS)
      if (next) onSortChange(next.sort, next.direction)
    },
  })

  return (
    <section
      aria-label="Project build history"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <CollectionViewport
        compact={
          <div className="space-y-4">
            {isLoading ? (
              <CompactBuildsSkeleton />
            ) : (
              <CompactBuilds builds={builds} />
            )}
            {!isLoading ? (
              <CollectionPagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            ) : undefined}
          </div>
        }
        desktop={
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
        }
      />
    </section>
  )
}
