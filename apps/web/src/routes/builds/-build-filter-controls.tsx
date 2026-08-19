import { useMemo, useState } from 'react'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '@/components/ui/combobox'
import { Button } from '@/components/ui/button'
import { DataTableSelectFilter } from '@/components/data-table'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { useInfiniteProjects, useProject } from '@/hooks/use-projects'
import { BUILD_STATUS_FILTER_OPTIONS } from '@/lib/status-variants'
import { isNearScrollEnd } from '@/lib/scroll'
import { cn } from '@/lib/utils'

export interface BuildFilterValue {
  project?: string
  q?: string
  status?: string
}

export interface BuildFilterControlProps {
  filters: BuildFilterValue
  onChange: (updates: Partial<BuildFilterValue> & { page?: undefined }) => void
}

export function ProjectFilter({
  className,
  filters,
  onChange,
}: Pick<BuildFilterControlProps, 'filters' | 'onChange'> & {
  className?: string
}) {
  const [search, setSearch] = useState('')
  const updateSearch = useDebouncedCallback(
    (value: string) => setSearch(value.trim()),
    300,
  )
  const projectsQuery = useInfiniteProjects({
    limit: 100,
    search: search || undefined,
    sort: 'name',
    direction: 'asc',
  })
  const selectedProjectQuery = useProject(filters.project ?? '')
  const projects = useMemo(
    () => projectsQuery.data?.pages.flatMap((page) => page.projects) ?? [],
    [projectsQuery.data?.pages],
  )
  const selectedProject = filters.project
    ? (projects.find((project) => project.id === filters.project) ??
      selectedProjectQuery.data?.project ??
      null)
    : null
  const options = useMemo(
    () => [
      { id: '', name: 'All projects' },
      ...projects.map(({ id, name }) => ({ id, name })),
    ],
    [projects],
  )
  const selectedOption = selectedProject
    ? { id: selectedProject.id, name: selectedProject.name }
    : options[0]

  return (
    <Combobox
      items={options}
      value={selectedOption}
      disabled={projectsQuery.isLoading}
      filter={null}
      isItemEqualToValue={(item, value) => item.id === value.id}
      itemToStringLabel={(item) => item.name}
      onInputValueChange={(value, details) => {
        if (
          details.reason === 'input-change' ||
          details.reason === 'input-clear'
        ) {
          updateSearch(value)
        }
      }}
      onValueChange={(project) =>
        onChange({
          project: project?.id || undefined,
          page: undefined,
        })
      }
    >
      <ComboboxTrigger
        render={
          <Button
            variant="outline"
            className={cn('justify-between font-normal', className)}
          />
        }
        aria-label="Filter by project"
      >
        <span className="truncate">
          <ComboboxValue />
        </span>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput
          showTrigger={false}
          placeholder="Search projects"
          aria-label="Search projects"
        />
        <ComboboxEmpty>
          {projectsQuery.error
            ? 'Projects could not be loaded.'
            : 'No projects found.'}
        </ComboboxEmpty>
        <ComboboxList
          onScroll={(event) => {
            const list = event.currentTarget
            if (
              isNearScrollEnd(list) &&
              projectsQuery.hasNextPage &&
              !projectsQuery.isFetchingNextPage
            ) {
              void projectsQuery.fetchNextPage()
            }
          }}
        >
          {options.map((project) => (
            <ComboboxItem key={project.id || 'all'} value={project}>
              {project.name}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function StatusFilter({
  filters,
  onChange,
}: Pick<BuildFilterControlProps, 'filters' | 'onChange'>) {
  return (
    <DataTableSelectFilter
      value={filters.status ?? 'all'}
      onValueChange={(value) =>
        onChange({
          status: value && value !== 'all' ? value : undefined,
          page: undefined,
        })
      }
      options={BUILD_STATUS_FILTER_OPTIONS}
    />
  )
}
