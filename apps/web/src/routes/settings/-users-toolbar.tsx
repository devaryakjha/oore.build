import type { Table } from '@tanstack/react-table'

import { CollectionSearchInput } from '@/components/collection-search-input'
import type { SortDirection } from '@/components/collection-controls'
import { CompactSortControl } from '@/components/compact-sort-control'
import { Button } from '@/components/ui/button'
import type { User } from '@/lib/api-client/generated/models'
import type { UserSort } from './users'

const SORT_LABELS = {
  created_at: 'Joined',
  email: 'Email',
  role: 'Role',
  status: 'Status',
} satisfies Record<UserSort, string>

interface UsersToolbarProps {
  direction: SortDirection
  initialSearch: string
  onBulkDisable: (userIds: Array<string>) => void
  onSearch: (value: string) => void
  onSortChange: (sort: UserSort, direction: SortDirection) => void
  sort: UserSort
  table: Table<User>
}

export function UsersToolbar({
  direction,
  initialSearch,
  onBulkDisable,
  onSearch,
  onSortChange,
  sort,
  table,
}: UsersToolbarProps) {
  const selectedRows = table.getFilteredSelectedRowModel().rows

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <CollectionSearchInput
        initialValue={initialSearch}
        onSearch={onSearch}
        placeholder="Search users"
        ariaLabel="Search users"
      />

      <CompactSortControl
        ariaLabel="Sort users"
        className="sm:hidden"
        direction={direction}
        onSortChange={onSortChange}
        options={SORT_LABELS}
        sort={sort}
      />

      {selectedRows.length > 0 ? (
        <div className="flex items-center justify-between gap-3 sm:ml-auto sm:justify-end">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {selectedRows.length} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() =>
              onBulkDisable(selectedRows.map((row) => row.original.id))
            }
          >
            Disable selected
          </Button>
        </div>
      ) : null}
    </div>
  )
}
