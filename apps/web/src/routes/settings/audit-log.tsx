import { HugeiconsIcon } from '@hugeicons/react'
import {
  Calendar03Icon,
  InformationCircleIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import * as z from 'zod'
import { searchChoice, searchNumber, searchString } from '@/lib/search-input'
import type { SearchInput, SearchValue } from '@/lib/search-input'

import type { SortDirection } from '@/components/data-table-features'
import PageHeader from '@/components/page-header'
import PageLayout from '@/components/page-layout'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuditLogs } from '@/hooks/use-audit-logs'
import { usePageClamp } from '@/hooks/use-page-clamp'
import {
  getActiveInstanceOrRedirect,
  requireInstanceRoleOrRedirect,
} from '@/lib/instance-context'
import { PageMeta } from '@/lib/seo'
import { AuditLogCollection } from './-audit-log-collection'
import type { AuditSort } from './-audit-log-collection'

interface AuditLogSearch {
  direction?: SortDirection
  from?: string
  page?: number
  pageSize?: 20 | 50 | 100
  q?: string
  resource?: string
  sort?: AuditSort
  to?: string
}

const RESOURCE_TYPE_OPTIONS = {
  all: 'All resources',
  user: 'User',
  build: 'Build',
  project: 'Project',
  pipeline: 'Pipeline',
  integration: 'Integration',
  instance_settings: 'Settings',
  runner: 'Runner',
  artifact: 'Artifact',
  auth: 'Auth',
} satisfies Record<string, string>

const AUDIT_SORT_VALUES = new Set<AuditSort>([
  'created_at',
  'actor_email',
  'action',
  'resource_type',
])

function validDate(value: SearchValue): string | undefined {
  const parsed = z.string().safeParse(value)
  if (!parsed.success || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.data)) {
    return undefined
  }
  return Number.isNaN(new Date(`${parsed.data}T00:00:00`).getTime())
    ? undefined
    : parsed.data
}

function parseSearch(search: SearchInput): AuditLogSearch {
  const page = searchNumber(search, 'page')
  const pageSize = searchNumber(search, 'pageSize')
  const q = searchString(search, 'q')?.trim() ?? ''
  const resourceValue = searchString(search, 'resource')
  const resource =
    resourceValue &&
    resourceValue !== 'all' &&
    resourceValue in RESOURCE_TYPE_OPTIONS
      ? resourceValue
      : undefined
  const sort = searchChoice(search, 'sort', AUDIT_SORT_VALUES)
  const direction = searchString(search, 'direction')

  return {
    q: q || undefined,
    resource,
    from: validDate(searchString(search, 'from')),
    to: validDate(searchString(search, 'to')),
    sort,
    direction:
      direction === 'asc' || direction === 'desc' ? direction : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    pageSize: pageSize === 50 || pageSize === 100 ? pageSize : undefined,
  }
}

export const Route = createFileRoute('/settings/audit-log')({
  staticData: {
    breadcrumb: {
      title: 'Audit log',
    },
  },
  validateSearch: parseSearch,
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireInstanceRoleOrRedirect(instance.id, ['owner', 'admin'])
  },
  component: AuditLogPage,
})

function dateFromSearch(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function AuditDateRangePicker({
  from,
  onChange,
  to,
}: {
  from?: string
  onChange: (range: DateRange | undefined) => void
  to?: string
}) {
  const fromDate = dateFromSearch(from)
  const toDate = dateFromSearch(to)
  const selected: DateRange | undefined =
    fromDate || toDate ? { from: fromDate, to: toDate } : undefined
  const label = fromDate
    ? toDate
      ? `${format(fromDate, 'MMM d, yyyy')} to ${format(toDate, 'MMM d, yyyy')}`
      : `From ${format(fromDate, 'MMM d, yyyy')}`
    : toDate
      ? `Through ${format(toDate, 'MMM d, yyyy')}`
      : 'Pick a date range'

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            data-empty={!selected}
            className="col-span-2 w-full justify-start overflow-hidden text-left font-normal data-[empty=true]:text-muted-foreground sm:w-auto"
            aria-label={`Date range: ${label}`}
          />
        }
      >
        <HugeiconsIcon
          icon={Calendar03Icon}
          data-icon="inline-start"
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[calc(100dvh-2rem)] w-auto max-w-[calc(100vw-2rem)] overflow-auto p-0"
      >
        <Calendar
          mode="range"
          selected={selected}
          defaultMonth={fromDate ?? toDate}
          numberOfMonths={2}
          onSelect={onChange}
        />
      </PopoverContent>
    </Popover>
  )
}

function AuditLogPage() {
  const navigate = Route.useNavigate()
  const search = useSearch({ from: '/settings/audit-log' })
  const page = search.page ?? 1
  const pageSize = search.pageSize ?? 20
  const sort = search.sort ?? 'created_at'
  const direction = search.direction ?? 'desc'
  const fromTs = search.from
    ? Math.floor(new Date(`${search.from}T00:00:00`).getTime() / 1000)
    : undefined
  const toTs = search.to
    ? Math.floor(new Date(`${search.to}T23:59:59`).getTime() / 1000)
    : undefined

  const auditQuery = useAuditLogs({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    resource_type: search.resource,
    action: search.q,
    from_ts: fromTs,
    to_ts: toTs,
    sort,
    direction,
  })

  const entries = auditQuery.data?.entries ?? []
  const total = auditQuery.data?.total ?? 0
  const hasFilters =
    !!search.q || !!search.resource || !!search.from || !!search.to
  const showFilteredEmpty =
    !auditQuery.isLoading && !auditQuery.error && total === 0 && hasFilters
  const showTrueEmpty =
    !auditQuery.isLoading && !auditQuery.error && total === 0 && !hasFilters

  function updateSearch(updates: Partial<AuditLogSearch>) {
    void navigate({
      search: (previous) => ({ ...previous, ...updates }),
      replace: true,
    })
  }

  usePageClamp(page, pageSize, auditQuery.data?.total, (nextPage) => {
    updateSearch({ page: nextPage === 1 ? undefined : nextPage })
  })

  function clearFilters() {
    updateSearch({
      q: undefined,
      resource: undefined,
      from: undefined,
      to: undefined,
      page: undefined,
    })
  }

  function handleSortChange(nextSort: AuditSort, next: SortDirection) {
    updateSearch({ sort: nextSort, direction: next, page: undefined })
  }

  return (
    <PageLayout width="wide" fill>
      <PageMeta title="Audit log" noindex />
      <PageHeader
        title="Audit log"
        description="User and system activity across this instance."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:flex sm:flex-wrap lg:ml-auto">
          <Select
            value={search.resource ?? 'all'}
            onValueChange={(value) =>
              updateSearch({
                resource: value && value !== 'all' ? value : undefined,
                page: undefined,
              })
            }
            items={RESOURCE_TYPE_OPTIONS}
          >
            <SelectTrigger
              className="col-span-2 w-full sm:col-span-1 sm:w-40"
              aria-label="Filter by resource"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(RESOURCE_TYPE_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <AuditDateRangePicker
            from={search.from}
            to={search.to}
            onChange={(range) =>
              updateSearch({
                from: range?.from
                  ? format(range.from, 'yyyy-MM-dd')
                  : undefined,
                to: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
                page: undefined,
              })
            }
          />
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <AuditLogCollection
        direction={direction}
        emptyState={
          showFilteredEmpty ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={Search01Icon} />
                </EmptyMedia>
                <EmptyTitle>No matching activity</EmptyTitle>
                <EmptyDescription>
                  Change the current filters or clear them to see all activity.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </EmptyContent>
            </Empty>
          ) : showTrueEmpty ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={InformationCircleIcon} />
                </EmptyMedia>
                <EmptyTitle>No activity yet</EmptyTitle>
                <EmptyDescription>
                  User and system actions will appear here as they happen.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null
        }
        entries={entries}
        error={auditQuery.error}
        isLoading={auditQuery.isLoading}
        isRefreshing={auditQuery.isFetching && !auditQuery.isLoading}
        onPageChange={(nextPage) =>
          updateSearch({ page: nextPage > 1 ? nextPage : undefined })
        }
        onRetry={() => void auditQuery.refetch()}
        onSearch={(value) =>
          updateSearch({ q: value.trim() || undefined, page: undefined })
        }
        onSortChange={handleSortChange}
        page={page}
        pageSize={pageSize}
        query={search.q ?? ''}
        sort={sort}
        total={total}
      />
    </PageLayout>
  )
}
