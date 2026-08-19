import type { User, UserRole } from '@/api/types'
import {
  DataTableColumnHeader,
  type DataTableColumnDef,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/lib/format-utils'
import { UserActions } from './-user-actions'
import { ROLE_LABELS } from './-user-role-labels'

const ROLE_BADGE_VARIANT = {
  owner: 'outline',
  admin: 'outline',
  developer: 'secondary',
  qa_viewer: 'outline',
} satisfies Record<string, 'secondary' | 'outline'>

const STATUS_BADGE_VARIANT = {
  active: 'secondary',
  invited: 'outline',
  disabled: 'destructive',
} satisfies Record<string, 'secondary' | 'outline' | 'destructive'>

export interface UserColumnOptions {
  authUserId: string | undefined
  onRoleChange: (userId: string, email: string, newRole: UserRole) => void
  onDisable: (userId: string, email: string) => void
  onReEnable: (userId: string, email: string) => void
}

function UserRoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge variant={ROLE_BADGE_VARIANT[role] ?? 'outline'} className="text-xs">
      {ROLE_LABELS[role] ?? role}
    </Badge>
  )
}

function UserStatusBadge({ status }: { status: User['status'] }) {
  return (
    <Badge
      variant={STATUS_BADGE_VARIANT[status] ?? 'outline'}
      className="text-xs capitalize"
    >
      {status}
    </Badge>
  )
}

export function getColumns(
  options: UserColumnOptions,
): Array<DataTableColumnDef<User>> {
  const { authUserId } = options

  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => {
        if (!row.getCanSelect()) return null
        return (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        )
      },
      enableSorting: false,
      enableHiding: false,
      meta: {
        headerClassName: 'w-10',
        skeleton: <Skeleton className="size-4" />,
      },
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => {
        const isSelf = row.original.id === authUserId
        return (
          <span>
            {row.original.email}
            {isSelf ? (
              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
            ) : null}
          </span>
        )
      },
      meta: { skeleton: <Skeleton className="h-4 w-48" /> },
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
      cell: ({ row }) => <UserRoleBadge role={row.original.role} />,
      meta: { skeleton: <Skeleton className="h-5 w-20" /> },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
      meta: { skeleton: <Skeleton className="h-5 w-16" /> },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Joined" />
      ),
      cell: ({ row }) => (
        <span
          className="text-xs text-muted-foreground"
          title={new Date(row.original.created_at * 1000).toLocaleString()}
        >
          {relativeTime(row.original.created_at)}
        </span>
      ),
      meta: {
        cellClassName: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        skeleton: <Skeleton className="h-4 w-16" />,
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <UserActions user={row.original} {...options} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: {
        cellClassName: 'text-right',
        headerClassName: 'w-12',
        skeleton: <Skeleton className="size-8" />,
      },
    },
  ]
}
