import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'

import type { NotificationChannel } from '@/api/types'
import { relativeTime } from '@/lib/format-utils'
import {
  DataTable,
  DataTableColumnHeader,
  DataTableFrame,
  useDataTable,
  type DataTableColumnDef,
} from '@/components/data-table'
import {
  dataTableSortingState,
  resolveDataTableSorting,
} from '@/components/data-table-features'
import { CollectionViewport } from '@/components/collection'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CollectionPagination } from '@/components/collection-controls'
import type { SortDirection } from '@/components/collection-controls'
import { ChannelActions } from './-channel-actions'

export type NotificationSort = 'name' | 'type' | 'status' | 'updated_at'

const NOTIFICATION_SORTS = [
  'name',
  'type',
  'status',
  'updated_at',
] satisfies ReadonlyArray<NotificationSort>

function channelTypeLabel(type: string): string {
  if (type === 'webhook') return 'Webhook'
  if (type === 'mattermost') return 'Mattermost'
  if (type === 'email') return 'Email (SMTP)'
  return type
}

function channelIdentity(channel: NotificationChannel) {
  return (
    <Link
      to="/settings/notifications/$channelId"
      params={{ channelId: channel.id }}
      className="group block min-w-0 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="block truncate font-medium group-hover:underline">
        {channel.name}
      </span>
      <span className="block truncate font-mono text-[11px] text-muted-foreground">
        {channel.id.slice(0, 8)}
      </span>
    </Link>
  )
}

function getNotificationColumns({
  onDelete,
  onTest,
  pending,
}: {
  onDelete: (channel: NotificationChannel) => void
  onTest: (channel: NotificationChannel) => void
  pending: boolean
}): Array<DataTableColumnDef<NotificationChannel>> {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Channel" />
      ),
      cell: ({ row }) => channelIdentity(row.original),
    },
    {
      id: 'type',
      accessorFn: (channel) => channel.channel_type,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => (
        <Badge variant="outline">
          {channelTypeLabel(row.original.channel_type)}
        </Badge>
      ),
    },
    {
      id: 'status',
      accessorFn: (channel) => channel.enabled,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.enabled ? 'secondary' : 'outline'}>
          {row.original.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
    {
      accessorKey: 'events',
      header: 'Events',
      cell: ({ row }) =>
        row.original.events.length > 0
          ? row.original.events.join(', ')
          : 'All events',
      enableSorting: false,
      meta: {
        headerClassName: 'hidden lg:table-cell',
        cellClassName:
          'hidden max-w-[28ch] truncate text-xs text-muted-foreground lg:table-cell',
      },
    },
    {
      accessorKey: 'updated_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      cell: ({ row }) => relativeTime(row.original.updated_at),
      meta: {
        headerClassName: 'hidden lg:table-cell',
        cellClassName: 'hidden text-xs text-muted-foreground lg:table-cell',
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <ChannelActions
          channel={row.original}
          pending={pending}
          onDelete={() => onDelete(row.original)}
          onTest={() => onTest(row.original)}
        />
      ),
      enableHiding: false,
      enableSorting: false,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
    },
  ]
}

export function NotificationInventory({
  channels,
  direction,
  isLoading,
  onDelete,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onTest,
  page,
  pageSize,
  pending,
  sort,
  total,
}: {
  channels: Array<NotificationChannel>
  direction: SortDirection
  isLoading: boolean
  onDelete: (channel: NotificationChannel) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onSortChange: (sort: NotificationSort, direction: SortDirection) => void
  onTest: (channel: NotificationChannel) => void
  page: number
  pageSize: number
  pending: boolean
  sort: NotificationSort
  total: number
}) {
  const columns = useMemo(
    () => getNotificationColumns({ onDelete, onTest, pending }),
    [onDelete, onTest, pending],
  )
  const sorting = useMemo(
    () => dataTableSortingState(sort, direction),
    [direction, sort],
  )
  const table = useDataTable({
    columns,
    data: channels,
    getRowId: (channel) => channel.id,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = resolveDataTableSorting(updater, sorting, NOTIFICATION_SORTS)
      if (next) onSortChange(next.sort, next.direction)
    },
  })

  return (
    <section
      aria-label="Notification channel inventory"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <CollectionViewport
        compact={
          <>
            <div className="divide-y">
              {isLoading
                ? Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="space-y-2 py-4">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))
                : channels.map((channel) => (
                    <article key={channel.id} className="space-y-3 py-4">
                      <div className="flex items-start justify-between gap-3">
                        {channelIdentity(channel)}
                        <ChannelActions
                          channel={channel}
                          pending={pending}
                          onDelete={() => onDelete(channel)}
                          onTest={() => onTest(channel)}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {channelTypeLabel(channel.channel_type)}
                        </Badge>
                        <Badge
                          variant={channel.enabled ? 'secondary' : 'outline'}
                        >
                          {channel.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Updated {relativeTime(channel.updated_at)}
                        </span>
                      </div>
                    </article>
                  ))}
            </div>
            {!isLoading ? (
              <CollectionPagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            ) : null}
          </>
        }
        desktop={
          <div className="flex min-h-0 flex-1 flex-col">
            <DataTableFrame
              fill
              footer={
                !isLoading ? (
                  <CollectionPagination
                    embedded
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                  />
                ) : undefined
              }
            >
              <DataTable table={table} isLoading={isLoading} />
            </DataTableFrame>
          </div>
        }
      />
    </section>
  )
}
