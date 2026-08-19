import {
  useTable,
  type CellData,
  type Column,
  type ColumnDef,
  type ReactTable,
  type RowData,
  type TableOptions,
} from '@tanstack/react-table'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(direction === 'asc')}
    >
      {title}
      <HugeiconsIcon
        icon={
          direction === 'asc'
            ? ArrowUp01Icon
            : direction === 'desc'
              ? ArrowDown01Icon
              : ArrowUpDownIcon
        }
        aria-hidden
      />
    </Button>
  )
}

export function DataTable<TData extends RowData>({
  emptyMessage = 'No results.',
  pagination,
  search,
  table,
}: {
  emptyMessage?: string
  pagination?: {
    onPageChange: (page: number) => void
    page: number
    pageSize: number
    total: number
  }
  search?: {
    onChange: (value: string) => void
    placeholder: string
    value: string
  }
  table: DataTableInstance<TData>
}) {
  const visibleColumns = table.getVisibleLeafColumns()
  const rows = table.getRowModel().rows

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 py-4">
        {search ? (
          <Input
            value={search.value}
            placeholder={search.placeholder}
            onChange={(event) => search.onChange(event.target.value)}
            className="max-w-sm"
          />
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" className="ml-auto" />}
          >
            Columns
            <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id.replaceAll('_', ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination ? (
        <div className="flex items-center justify-end gap-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(pagination.page + 1)}
            disabled={pagination.page * pagination.pageSize >= pagination.total}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
