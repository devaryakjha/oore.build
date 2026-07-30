import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Project } from '@/lib/types'
import { BUILD_STATUS_FILTER_OPTIONS } from '@/lib/status-variants'

export interface BuildFilterValue {
  project?: string
  q?: string
  status?: string
}

export interface BuildFilterControlProps {
  filters: BuildFilterValue
  onChange: (updates: Partial<BuildFilterValue> & { page?: undefined }) => void
  projects: Array<Project>
  projectsResolved: boolean
}

export function ProjectFilter({
  className,
  filters,
  onChange,
  projects,
  projectsResolved,
}: Pick<
  BuildFilterControlProps,
  'filters' | 'onChange' | 'projects' | 'projectsResolved'
> & {
  className?: string
}) {
  return (
    <Select
      value={filters.project ?? 'all'}
      onValueChange={(value) =>
        onChange({
          project: value && value !== 'all' ? value : undefined,
          page: undefined,
        })
      }
      items={Object.fromEntries([
        ['all', 'All projects'],
        ...projects.map((project) => [project.id, project.name] as const),
      ])}
      disabled={!projectsResolved}
    >
      <SelectTrigger className={className} aria-label="Filter by project">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function StatusFilter({
  className,
  filters,
  onChange,
}: Pick<BuildFilterControlProps, 'filters' | 'onChange'> & {
  className?: string
}) {
  return (
    <Select
      value={filters.status ?? 'all'}
      onValueChange={(value) =>
        onChange({
          status: value && value !== 'all' ? value : undefined,
          page: undefined,
        })
      }
      items={BUILD_STATUS_FILTER_OPTIONS}
    >
      <SelectTrigger className={className} aria-label="Filter by status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {Object.entries(BUILD_STATUS_FILTER_OPTIONS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
