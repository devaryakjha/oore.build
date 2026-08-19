import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  functionalUpdate,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  type SortingState,
  type Updater,
} from '@tanstack/react-table'
import type { ReactNode } from 'react'

export interface DataTableColumnMeta {
  cellClassName?: string
  headerClassName?: string
  skeleton?: ReactNode
}

// New in v9: declare the features this table uses — anything you don't
// register is tree-shaken out of the bundle.
export const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  columnMeta: metaHelper<DataTableColumnMeta>(),
})

// Pass this as the first generic argument to `ColumnDef`, `Column`, `Table`,
// and `Row` so each type knows which feature APIs are available.
export type DataTableFeatures = typeof features

export type DataTableSortDirection = 'asc' | 'desc'

export function dataTableSortingState(
  sort: string,
  direction: DataTableSortDirection,
): SortingState {
  return [{ id: sort, desc: direction === 'desc' }]
}

export function resolveDataTableSorting<TSort extends string>(
  updater: Updater<SortingState>,
  current: SortingState,
  sortKeys: ReadonlyArray<TSort>,
): { direction: DataTableSortDirection; sort: TSort } | null {
  const next = functionalUpdate(updater, current)[0]
  if (!next) return null

  const sort = sortKeys.find((key) => key === next.id)
  return sort ? { sort, direction: next.desc ? 'desc' : 'asc' } : null
}
