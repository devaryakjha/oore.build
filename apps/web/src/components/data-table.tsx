import {
  useTable,
  type CellData,
  type Column,
  type ColumnDef,
  type ReactTable,
  type Row,
  type RowData,
  type TableOptions,
} from '@tanstack/react-table'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { features, type DataTableFeatures } from './data-table-features'

export type { DataTableFeatures } from './data-table-features'

export type DataTableColumnDef<TData extends RowData> = ColumnDef<
  DataTableFeatures,
  TData
>
export type DataTableInstance<TData extends RowData> = ReactTable<
  DataTableFeatures,
  TData
>

type DataTableOptions<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  'columns' | 'data' | 'features'
> & {
  columns: Array<DataTableColumnDef<TData>>
  data: Array<TData>
}

export function useDataTable<TData extends RowData>({
  columns,
  data,
  ...options
}: DataTableOptions<TData>) {
  return useTable({
    features,
    columns,
    data,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    ...options,
  })
}

export function DataTableColumnHeader<
  TData extends RowData,
  TValue extends CellData,
>({
  column,
  title,
}: {
  column: Column<DataTableFeatures, TData, TValue>
  title: string
}) {
  if (!column.getCanSort()) return title

  const direction = column.getIsSorted()
  const Icon =
    direction === 'asc'
      ? ArrowUp01Icon
      : direction === 'desc'
        ? ArrowDown01Icon
        : ArrowUpDownIcon

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8"
      onClick={() => column.toggleSorting(direction === 'asc')}
    >
      {title}
      <HugeiconsIcon icon={Icon} aria-hidden />
    </Button>
  )
}

type TableRowProps = Omit<ComponentProps<typeof TableRow>, 'children'>

export function DataTable<TData extends RowData>({
  emptyMessage = 'No results.',
  getRowProps,
  isLoading = false,
  showHeader = true,
  skeletonRows = 5,
  table,
}: {
  emptyMessage?: string
  getRowProps?: (row: Row<DataTableFeatures, TData>) => TableRowProps
  isLoading?: boolean
  showHeader?: boolean
  skeletonRows?: number
  table: DataTableInstance<TData>
}) {
  const visibleColumns = table.getVisibleLeafColumns()

  return (
    <Table>
      {showHeader ? (
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.columnDef.meta?.headerClassName}
                >
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
      ) : null}
      <TableBody>
        {isLoading
          ? Array.from({ length: skeletonRows }, (_, rowIndex) => (
              <TableRow key={rowIndex} aria-hidden>
                {visibleColumns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={column.columnDef.meta?.cellClassName}
                  >
                    {column.columnDef.meta?.skeleton ?? (
                      <Skeleton className="h-4 w-24 max-w-full" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          : table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                {...getRowProps?.(row)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cell.column.columnDef.meta?.cellClassName}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
        {!isLoading && table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={visibleColumns.length}
              className="h-24 text-center"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  )
}

export function DataTableFrame({
  children,
  className,
  footer,
  fill = footer != null,
}: {
  children: ReactNode
  className?: string
  footer?: ReactNode
  fill?: boolean
}) {
  return (
    <div
      data-slot="data-table"
      className={cn(
        'flex min-w-0 flex-col',
        fill && 'min-h-0 flex-1',
        className,
      )}
    >
      <div
        className={cn(
          'overflow-hidden rounded-md border',
          fill && 'flex min-h-0 flex-1 flex-col',
        )}
      >
        <div
          data-slot="data-table-viewport"
          className={cn(
            'min-w-0 scrollbar-gutter-stable overflow-auto overscroll-contain',
            fill ? 'min-h-72 flex-1' : 'max-h-[clamp(18rem,58dvh,48rem)]',
            '**:data-[slot=table-container]:overflow-visible',
            '**:data-[slot=table-header]:sticky **:data-[slot=table-header]:top-0 **:data-[slot=table-header]:z-10',
            '**:data-[slot=table-head]:bg-background',
          )}
        >
          {children}
        </div>
      </div>
      {footer ? (
        <div data-slot="data-table-footer" className="shrink-0 py-4">
          {footer}
        </div>
      ) : null}
    </div>
  )
}
