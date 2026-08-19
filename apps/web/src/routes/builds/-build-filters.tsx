import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  ProjectFilter,
  StatusFilter,
  type BuildFilterValue,
} from './-build-filter-controls'

interface BuildFiltersProps {
  filters: BuildFilterValue
  onChange: (updates: Partial<BuildFilterValue> & { page?: undefined }) => void
}

export function BuildFilters({ filters, onChange }: BuildFiltersProps) {
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
    <div className="flex justify-end">
      <Button
        variant="outline"
        className="shrink-0 lg:hidden"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((open) => !open)}
      >
        Filters
      </Button>

      <div
        className={`${filtersOpen ? 'grid' : 'hidden'} gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:flex lg:shrink-0 lg:items-center lg:border-0 lg:bg-transparent lg:p-0`}
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
      </div>
    </div>
  )
}
