import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { MoreHorizontalCircle01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import {
  CollectionError,
  CollectionFrame,
  CollectionViewport,
} from '@/components/collection'
import { DataTableFrame } from '@/components/data-table'
import {
  CollectionPagination,
  SortableTableHead,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { relativeTime } from '@/lib/format-utils'
import {
  BUILD_STATUS_FILTER_OPTIONS,
  getRunnerPolicyBlockLabel,
  getStatusVariant,
} from '@/lib/status-variants'
import type { Build } from '@/lib/types'
import type { BuildSort } from './-build-sort'

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
      onMouseEnter={() => void loadBuildActionsMenu()}
      onFocus={() => void loadBuildActionsMenu()}
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

function DesktopBuildsSkeleton() {
  const cellClasses = [
    undefined,
    undefined,
    undefined,
    'hidden lg:table-cell',
    'hidden lg:table-cell',
    'hidden lg:table-cell',
    undefined,
    undefined,
  ]

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {cellClasses.map((className, index) => (
            <TableHead key={index} className={className}>
              <Skeleton className="h-4 w-16" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }, (_, rowIndex) => (
          <TableRow key={rowIndex}>
            {cellClasses.map((className, cellIndex) => (
              <TableCell key={cellIndex} className={className}>
                <Skeleton className="h-5 w-20" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function BuildCollectionSkeleton() {
  return (
    <CollectionViewport
      compact={<CompactBuildsSkeleton />}
      desktop={
        <DataTableFrame fill>
          <DesktopBuildsSkeleton />
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

function BuildTable({
  builds,
  direction,
  onSortChange,
  sort,
}: {
  builds: Array<Build>
  direction: SortDirection
  onSortChange: (sort: BuildSort, direction: SortDirection) => void
  sort: BuildSort
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Build</TableHead>
          <SortableTableHead
            sort={sort}
            sortKey="project_name"
            direction={direction}
            onSortChange={onSortChange}
          >
            Project
          </SortableTableHead>
          <SortableTableHead
            sort={sort}
            sortKey="status"
            direction={direction}
            onSortChange={onSortChange}
          >
            Status
          </SortableTableHead>
          <TableHead className="hidden lg:table-cell">Trigger</TableHead>
          <SortableTableHead
            className="hidden lg:table-cell"
            sort={sort}
            sortKey="branch"
            direction={direction}
            onSortChange={onSortChange}
          >
            Branch
          </SortableTableHead>
          <TableHead className="hidden lg:table-cell">Commit</TableHead>
          <SortableTableHead
            sort={sort}
            sortKey="created_at"
            direction={direction}
            onSortChange={onSortChange}
          >
            Created
          </SortableTableHead>
          <TableHead className="w-10">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {builds.map((build) => (
          <TableRow key={build.id}>
            <TableCell>
              <BuildIdentity build={build} />
            </TableCell>
            <TableCell>
              <p className="text-sm">{projectName(build)}</p>
              {build.context?.pipeline_name ? (
                <p className="text-xs text-muted-foreground">
                  {build.context.pipeline_name}
                </p>
              ) : null}
            </TableCell>
            <TableCell>
              <Badge variant={getStatusVariant(build.status)}>
                {BUILD_STATUS_FILTER_OPTIONS[build.status]}
              </Badge>
              {build.runner_policy_block_reason ? (
                <p className="mt-1 text-xs text-warning">
                  {getRunnerPolicyBlockLabel(build.runner_policy_block_reason)}
                </p>
              ) : null}
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Badge variant="outline">{build.trigger_type}</Badge>
            </TableCell>
            <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
              {build.branch ?? 'n/a'}
            </TableCell>
            <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
              {build.commit_sha ? build.commit_sha.slice(0, 10) : 'n/a'}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {relativeTime(build.created_at)}
            </TableCell>
            <TableCell>
              <BuildActionsControl build={build} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
        <BuildCollectionSkeleton />
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
              <BuildTable
                builds={builds}
                direction={direction}
                onSortChange={onSortChange}
                sort={sort}
              />
            </DataTableFrame>
          }
        />
      ) : error ? null : (
        emptyState
      )}
    </CollectionFrame>
  )
}
