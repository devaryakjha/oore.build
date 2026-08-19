import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChevronRightIcon } from '@hugeicons/core-free-icons'

import type { Build } from '@/lib/api-client/generated/models'
import { CollectionViewport } from '@/components/collection'
import { DataTableFrame } from '@/components/data-table'
import type { SortDirection } from '@/components/collection-controls'
import {
  CollectionPagination,
  SortableTableHead,
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
  getStatusVariant,
} from '@/lib/status-variants'
import type { ProjectBuildSort } from './-project-build-sort'

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Build</TableHead>
                  <SortableTableHead
                    sort={sort}
                    sortKey="pipeline_name"
                    direction={direction}
                    onSortChange={onSortChange}
                  >
                    Pipeline
                  </SortableTableHead>
                  <SortableTableHead
                    sort={sort}
                    sortKey="status"
                    direction={direction}
                    onSortChange={onSortChange}
                  >
                    Status
                  </SortableTableHead>
                  <TableHead className="hidden lg:table-cell">
                    Trigger
                  </TableHead>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }, (_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Skeleton className="h-8 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-20" />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Skeleton className="h-6 w-24" />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      </TableRow>
                    ))
                  : builds.map((build) => (
                      <TableRow key={build.id}>
                        <TableCell>
                          <BuildIdentity build={build} />
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {build.context?.pipeline_name ?? 'Unknown pipeline'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(build.status)}>
                            {BUILD_STATUS_FILTER_OPTIONS[build.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline">{build.trigger_type}</Badge>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                          {build.branch ?? 'n/a'}
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                          {build.commit_sha
                            ? build.commit_sha.slice(0, 10)
                            : 'n/a'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {relativeTime(build.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </DataTableFrame>
        }
      />
    </section>
  )
}
