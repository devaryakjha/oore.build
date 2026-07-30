import {
  flexRender,
  type Row,
  type Table as TanStackTable,
} from '@tanstack/react-table'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
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
import type { User } from '@/lib/types'
import type { UserSort } from './users'

function renderUserCell(row: Row<User>, columnId: string) {
  const cell = row
    .getVisibleCells()
    .find((candidate) => candidate.column.id === columnId)
  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null
}

function CompactUsersSkeleton() {
  return (
    <ItemGroup className="gap-2">
      {Array.from({ length: 5 }, (_, index) => (
        <Item key={index} variant="outline" className="flex-nowrap" aria-hidden>
          <ItemMedia>
            <Skeleton className="size-4" />
          </ItemMedia>
          <ItemContent>
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-5 w-36" />
          </ItemContent>
          <ItemActions>
            <Skeleton className="size-8" />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

function DesktopUsersSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <span className="sr-only">Select</span>
          </TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Joined</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }, (_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="size-4" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-48" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16" />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="size-8" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function UsersCollectionSkeleton() {
  return (
    <CollectionViewport
      compact={<CompactUsersSkeleton />}
      desktop={
        <DataTableFrame fill>
          <DesktopUsersSkeleton />
        </DataTableFrame>
      }
    />
  )
}

function CompactUsers({
  authUserId,
  rows,
}: {
  authUserId?: string
  rows: Array<Row<User>>
}) {
  return (
    <ItemGroup className="gap-2">
      {rows.map((row) => (
        <Item
          key={row.id}
          variant="outline"
          className="flex-nowrap"
          data-state={row.getIsSelected() ? 'selected' : undefined}
          data-oore-performance-collection-item={row.original.id}
          data-oore-performance-representation="compact"
        >
          <ItemMedia>
            <Checkbox
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onCheckedChange={(checked) => row.toggleSelected(!!checked)}
              aria-label={`Select ${row.original.email}`}
            />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>
              <span className="truncate">{row.original.email}</span>
              {row.original.id === authUserId ? (
                <span className="shrink-0 text-xs font-normal text-muted-foreground">
                  (you)
                </span>
              ) : null}
            </ItemTitle>
            <ItemDescription>
              <span className="flex flex-wrap items-center gap-2">
                {renderUserCell(row, 'role')}
                {renderUserCell(row, 'status')}
                <span>{renderUserCell(row, 'created_at')}</span>
              </span>
            </ItemDescription>
          </ItemContent>
          <ItemActions className="self-start">
            {renderUserCell(row, 'actions')}
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

function UsersTable({
  direction,
  onSortChange,
  sort,
  table,
}: {
  direction: SortDirection
  onSortChange: (sort: UserSort, direction: SortDirection) => void
  sort: UserSort
  table: TanStackTable<User>
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={
                table.getIsSomePageRowsSelected() &&
                !table.getIsAllPageRowsSelected()
              }
              onCheckedChange={(checked) =>
                table.toggleAllPageRowsSelected(!!checked)
              }
              aria-label="Select all users on this page"
            />
          </TableHead>
          <SortableTableHead
            sort={sort}
            sortKey="email"
            direction={sort === 'email' ? direction : 'asc'}
            onSortChange={onSortChange}
          >
            Email
          </SortableTableHead>
          <SortableTableHead
            sort={sort}
            sortKey="role"
            direction={direction}
            onSortChange={onSortChange}
          >
            Role
          </SortableTableHead>
          <SortableTableHead
            sort={sort}
            sortKey="status"
            direction={direction}
            onSortChange={onSortChange}
          >
            Status
          </SortableTableHead>
          <SortableTableHead
            className="hidden lg:table-cell"
            sort={sort}
            sortKey="created_at"
            direction={direction}
            onSortChange={onSortChange}
          >
            Joined
          </SortableTableHead>
          <TableHead className="w-12">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-state={row.getIsSelected() ? 'selected' : undefined}
            data-oore-performance-collection-item={row.original.id}
            data-oore-performance-representation="table"
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={
                  cell.column.id === 'created_at'
                    ? 'hidden lg:table-cell'
                    : cell.column.id === 'actions'
                      ? 'text-right'
                      : undefined
                }
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function UsersCollection({
  authUserId,
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
  table,
  total,
}: {
  authUserId?: string
  direction: SortDirection
  emptyState: ReactNode
  error: Error | null
  isLoading: boolean
  isRefreshing: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onRetry: () => void
  onSortChange: (sort: UserSort, direction: SortDirection) => void
  page: number
  pageSize: number
  sort: UserSort
  table: TanStackTable<User>
  total: number
}) {
  const hasResults = total > 0

  return (
    <CollectionFrame ariaLabel="Users" isBusy={isLoading || isRefreshing}>
      {error ? (
        <CollectionError
          title="Users could not be loaded"
          description={error.message}
          onRetry={onRetry}
        />
      ) : null}

      {isLoading ? (
        <UsersCollectionSkeleton />
      ) : hasResults ? (
        <CollectionViewport
          compact={
            <>
              <CompactUsers
                authUserId={authUserId}
                rows={table.getRowModel().rows}
              />
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
              <UsersTable
                direction={direction}
                onSortChange={onSortChange}
                sort={sort}
                table={table}
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
