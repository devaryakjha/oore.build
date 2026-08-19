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
  const hasFilters = !!filters.q || !!filters.project || !!filters.status
  const clearFilters = () =>
    onChange({
      q: undefined,
      project: undefined,
      status: undefined,
      page: undefined,
    })

  return (
    <>
      <ProjectFilter className="w-44" filters={filters} onChange={onChange} />
      <StatusFilter filters={filters} onChange={onChange} />
      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      ) : null}
    </>
  )
}
