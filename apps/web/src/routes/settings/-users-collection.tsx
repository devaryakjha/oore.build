import { flexRender, type Row } from '@tanstack/react-table'
import type { ReactNode } from 'react'

import {
  CollectionError,
  CollectionFrame,
  CollectionViewport,
} from '@/components/collection'
import {
  DataTable,
  DataTableFrame,
  type DataTableFeatures,
  type DataTableInstance,
} from '@/components/data-table'
import { CollectionPagination } from '@/components/collection-controls'
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
import type { User } from '@/api/types'

function renderUserCell(row: Row<DataTableFeatures, User>, columnId: string) {
  const cell = row
    .getAllCells()
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

function UsersCollectionSkeleton({
  table,
}: {
  table: DataTableInstance<User>
}) {
  return (
    <CollectionViewport
      compact={<CompactUsersSkeleton />}
      desktop={
        <DataTableFrame fill>
          <DataTable table={table} isLoading />
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
  rows: Array<Row<DataTableFeatures, User>>
}) {
  return (
    <ItemGroup className="gap-2">
      {rows.map((row) => (
        <Item
          key={row.id}
          variant="outline"
          className="flex-nowrap"
          data-state={row.getIsSelected() ? 'selected' : undefined}
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

export function UsersCollection({
  authUserId,
  emptyState,
  error,
  isLoading,
  isRefreshing,
  onPageChange,
  onPageSizeChange,
  onRetry,
  page,
  pageSize,
  table,
  total,
}: {
  authUserId?: string
  emptyState: ReactNode
  error: Error | null
  isLoading: boolean
  isRefreshing: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onRetry: () => void
  page: number
  pageSize: number
  table: DataTableInstance<User>
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
        <UsersCollectionSkeleton table={table} />
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
