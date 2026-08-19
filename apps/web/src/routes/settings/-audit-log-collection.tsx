import type { ReactNode } from 'react'

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
import type { AuditLogEntry } from '@/lib/api-client/generated/models'

export type AuditSort =
  | 'created_at'
  | 'actor_email'
  | 'action'
  | 'resource_type'

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

function DesktopAuditSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Actor</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Resource</TableHead>
          <TableHead className="hidden lg:table-cell">Resource ID</TableHead>
          <TableHead className="hidden lg:table-cell">Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }, (_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-28" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-20" />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Skeleton className="h-4 w-40" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function AuditCollectionSkeleton() {
  return (
    <CollectionViewport
      compact={<CompactAuditSkeleton />}
      desktop={
        <DataTableFrame fill>
          <DesktopAuditSkeleton />
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

function AuditTable({
  direction,
  entries,
  onSortChange,
  sort,
}: {
  direction: SortDirection
  entries: Array<AuditLogEntry>
  onSortChange: (sort: AuditSort, direction: SortDirection) => void
  sort: AuditSort
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            sort={sort}
            sortKey="created_at"
            direction={direction}
            onSortChange={onSortChange}
          >
            Time
          </SortableTableHead>
          <SortableTableHead
            sort={sort}
            sortKey="actor_email"
            direction={direction}
            onSortChange={onSortChange}
          >
            Actor
          </SortableTableHead>
          <SortableTableHead
            sort={sort}
            sortKey="action"
            direction={direction}
            onSortChange={onSortChange}
          >
            Action
          </SortableTableHead>
          <SortableTableHead
            sort={sort}
            sortKey="resource_type"
            direction={direction}
            onSortChange={onSortChange}
          >
            Resource
          </SortableTableHead>
          <TableHead className="hidden lg:table-cell">Resource ID</TableHead>
          <TableHead className="hidden lg:table-cell">Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>
              <AuditTime entry={entry} />
            </TableCell>
            <TableCell className="max-w-40 truncate text-sm">
              {entry.actor_email ?? (
                <span className="text-muted-foreground">System</span>
              )}
            </TableCell>
            <TableCell className="max-w-48">
              <Badge variant="outline" className="max-w-full truncate">
                {auditActionLabel(entry.action)}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {auditResourceLabel(entry.resource_type)}
              </Badge>
            </TableCell>
            <TableCell className="hidden font-mono text-[11px] text-muted-foreground lg:table-cell">
              {entry.resource_id
                ? entry.resource_id.slice(0, 8)
                : 'Not available'}
            </TableCell>
            <TableCell className="hidden max-w-xs truncate text-xs text-muted-foreground lg:table-cell">
              {entry.details ?? 'Not available'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

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
        <AuditCollectionSkeleton />
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
              <AuditTable
                direction={direction}
                entries={entries}
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
