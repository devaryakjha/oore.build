import type { ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SortDirection = 'asc' | 'desc'

interface SortableTableHeadProps<TSort extends string> {
  children: ReactNode
  className?: string
  direction: SortDirection
  onSortChange: (sort: TSort, direction: SortDirection) => void
  sort: TSort
  sortKey: TSort
}

export function SortableTableHead<TSort extends string>({
  children,
  className,
  direction,
  onSortChange,
  sort,
  sortKey,
}: SortableTableHeadProps<TSort>) {
  const active = sort === sortKey
  const nextDirection: SortDirection =
    active && direction === 'asc' ? 'desc' : 'asc'
  const Icon = active
    ? direction === 'asc'
      ? ArrowUp01Icon
      : ArrowDown01Icon
    : ArrowUpDownIcon

  return (
    <TableHead
      aria-sort={
        active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={className}
    >
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-8"
        onClick={() => onSortChange(sortKey, nextDirection)}
      >
        {children}
        <HugeiconsIcon icon={Icon} aria-hidden />
      </Button>
    </TableHead>
  )
}

const PAGE_SIZE_LABELS = {
  '20': '20',
  '50': '50',
  '100': '100',
} satisfies Record<string, string>

interface CollectionPaginationProps {
  className?: string
  embedded?: boolean
  isRefreshing?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  page: number
  pageSize: number
  total: number
}

export function CollectionPagination({
  className,
  embedded = false,
  isRefreshing = false,
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  total,
}: CollectionPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        !embedded && 'border-t pt-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">
          {total === 0 ? '0 results' : `${start}–${end} of ${total}`}
        </span>
        {isRefreshing ? (
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5"
          >
            <Spinner />
            <span className="sr-only">Refreshing</span>
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Rows
        </span>
        <NativeSelect
          className="w-16"
          aria-label="Results per page"
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {Object.entries(PAGE_SIZE_LABELS).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <Pagination className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationLink
                href="#"
                aria-label="Go to previous page"
                onClick={(event) => {
                  event.preventDefault()
                  if (page > 1) onPageChange(page - 1)
                }}
                aria-disabled={page <= 1}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden />
              </PaginationLink>
            </PaginationItem>
            <li className="min-w-12 text-center text-xs text-muted-foreground">
              {page} / {totalPages}
            </li>
            <PaginationItem>
              <PaginationLink
                href="#"
                aria-label="Go to next page"
                onClick={(event) => {
                  event.preventDefault()
                  if (page < totalPages) onPageChange(page + 1)
                }}
                aria-disabled={page >= totalPages}
                className={
                  page >= totalPages ? 'pointer-events-none opacity-50' : ''
                }
              >
                <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
