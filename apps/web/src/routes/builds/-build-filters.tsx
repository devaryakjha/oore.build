import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { CollectionSearchInput } from '@/components/collection-search-input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SortDirection } from '@/components/collection-controls'
import { BUILD_SORT_OPTIONS, type BuildSort } from './-build-sort'
import {
  ProjectFilter,
  StatusFilter,
  type BuildFilterValue,
} from './-build-filter-controls'

interface BuildFiltersProps {
  direction: SortDirection
  filters: BuildFilterValue
  onChange: (updates: Partial<BuildFilterValue> & { page?: undefined }) => void
  onSortChange: (sort: BuildSort, direction: SortDirection) => void
  sort: BuildSort
}

export function BuildFilters({
  direction,
  filters,
  onChange,
  onSortChange,
  sort,
}: BuildFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const hasFilters = !!filters.q || !!filters.project || !!filters.status
  const clearFilters = () =>
    onChange({
      q: undefined,
      project: undefined,
      status: undefined,
      page: undefined,
    })

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-[minmax(0,24rem)_1fr_auto]">
      <CollectionSearchInput
        className="min-w-0 sm:max-w-sm"
        initialValue={filters.q ?? ''}
        onSearch={(value) =>
          onChange({ q: value.trim() || undefined, page: undefined })
        }
        placeholder="Search by branch"
        ariaLabel="Search builds by branch"
      />

      <Button
        variant="outline"
        className="shrink-0 lg:hidden"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((open) => !open)}
      >
        Filters
      </Button>

      <div
        className={`${filtersOpen ? 'grid' : 'hidden'} col-span-2 gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:ml-auto lg:flex lg:shrink-0 lg:items-center lg:border-0 lg:bg-transparent lg:p-0`}
      >
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="order-last sm:col-span-2 lg:order-first lg:col-auto"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        ) : null}
        <ProjectFilter
          className="w-full lg:w-44"
          filters={filters}
          onChange={onChange}
        />
        <StatusFilter
          className="w-full lg:w-40"
          filters={filters}
          onChange={onChange}
        />
        <Select
          value={sort}
          onValueChange={(value) =>
            onSortChange(value ?? 'created_at', direction)
          }
          items={BUILD_SORT_OPTIONS}
        >
          <SelectTrigger className="w-full sm:hidden" aria-label="Sort builds">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries(BUILD_SORT_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
