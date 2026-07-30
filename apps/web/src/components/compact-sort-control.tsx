import { SortByDown02Icon, SortByUp02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type { SortDirection } from '@/components/collection-controls'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

interface CompactSortControlProps<TSort extends string> {
  ariaLabel: string
  className?: string
  direction: SortDirection
  onSortChange: (sort: TSort, direction: SortDirection) => void
  options: Readonly<Record<TSort, string>>
  sort: TSort
}

export function CompactSortControl<TSort extends string>({
  ariaLabel,
  className,
  direction,
  onSortChange,
  options,
  sort,
}: CompactSortControlProps<TSort>) {
  const DirectionIcon = direction === 'asc' ? SortByUp02Icon : SortByDown02Icon
  const nextDirection = direction === 'asc' ? 'desc' : 'asc'

  return (
    <div className={cn('grid grid-cols-[1fr_auto] gap-2', className)}>
      <NativeSelect
        className="w-full"
        aria-label={ariaLabel}
        value={sort}
        onChange={(event) =>
          onSortChange(event.target.value as TSort, direction)
        }
      >
        {(Object.entries(options) as Array<[TSort, string]>).map(
          ([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ),
        )}
      </NativeSelect>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Sort ${nextDirection === 'asc' ? 'ascending' : 'descending'}`}
        title={`Sort ${nextDirection === 'asc' ? 'ascending' : 'descending'}`}
        onClick={() => onSortChange(sort, nextDirection)}
      >
        <HugeiconsIcon icon={DirectionIcon} />
      </Button>
    </div>
  )
}
