import { HugeiconsIcon } from '@hugeicons/react'
import {
  InformationCircleIcon,
  Link04Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'

import type { Integration } from '@/api/types'
import type { SortDirection } from '@/components/collection-controls'
import { CollectionSearchInput } from '@/components/collection-search-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { SourceInventory } from './-source-inventory'
import type { IntegrationSort } from './-source-inventory'

const sortOptions = {
  name: 'Name',
  provider: 'Provider',
  status: 'Status',
  updated_at: 'Recently updated',
} satisfies Record<IntegrationSort, string>

export function ConnectedSourcesSection({
  canWrite,
  direction,
  error,
  integrations,
  isLoading,
  onClearSearch,
  onPageChange,
  onPageSizeChange,
  onRetry,
  onSearch,
  onSortChange,
  page,
  pageSize,
  search,
  sort,
  total,
}: {
  canWrite: boolean
  direction: SortDirection
  error: Error | null
  integrations: Array<Integration>
  isLoading: boolean
  onClearSearch: () => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onRetry: () => void
  onSearch: (query: string) => void
  onSortChange: (sort: IntegrationSort, direction: SortDirection) => void
  page: number
  pageSize: number
  search?: string
  sort: IntegrationSort
  total: number
}) {
  const isEmpty = !isLoading && !error && total === 0
  return (
    <section
      aria-label="Connected sources"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
    >
      {isLoading || total > 0 || search ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CollectionSearchInput
            initialValue={search ?? ''}
            onSearch={onSearch}
            placeholder="Search connected sources"
            ariaLabel="Search connected sources"
          />
          <NativeSelect
            className="w-full sm:hidden"
            aria-label="Sort connected sources"
            value={sort}
            onChange={(event) => {
              const value = event.target.value
              if (
                value === 'name' ||
                value === 'provider' ||
                value === 'status' ||
                value === 'updated_at'
              ) {
                onSortChange(value, direction)
              }
            }}
          >
            {Object.entries(sortOptions).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Failed to load sources: {error.message}</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {isEmpty && !search ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Link04Icon} />
            </EmptyMedia>
            <EmptyTitle>No connected sources</EmptyTitle>
            <EmptyDescription>
              {canWrite
                ? 'Choose GitHub or GitLab below to discover repositories.'
                : 'An owner or admin can connect the first source.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {isEmpty && search ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Search01Icon} />
            </EmptyMedia>
            <EmptyTitle>No matching sources</EmptyTitle>
            <EmptyDescription>
              Try a different search or clear the current query.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={onClearSearch}>
              Clear search
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}
      {!error && (isLoading || total > 0) ? (
        <SourceInventory
          direction={direction}
          integrations={integrations}
          isLoading={isLoading}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onSortChange={onSortChange}
          page={page}
          pageSize={pageSize}
          sort={sort}
          total={total}
        />
      ) : null}
    </section>
  )
}
