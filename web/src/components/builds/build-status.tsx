import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BuildStatus as BuildStatusType } from '@/lib/api/types'
import {
  Clock01Icon,
  Loading03Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

const statusConfig: Record<
  BuildStatusType,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock01Icon; className: string }
> = {
  pending: {
    label: 'Pending',
    variant: 'secondary',
    icon: Clock01Icon,
    className: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  },
  running: {
    label: 'Running',
    variant: 'default',
    icon: Loading03Icon,
    className: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  },
  success: {
    label: 'Success',
    variant: 'default',
    icon: CheckmarkCircle02Icon,
    className: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
  },
  failure: {
    label: 'Failed',
    variant: 'destructive',
    icon: Cancel01Icon,
    className: 'bg-destructive/20 text-destructive border-destructive/30',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'outline',
    icon: AlertCircleIcon,
    className: 'bg-muted text-muted-foreground',
  },
}

interface BuildStatusProps {
  status: BuildStatusType
  showLabel?: boolean
  size?: 'sm' | 'default'
}

export function BuildStatusBadge({ status, showLabel = true, size = 'default' }: BuildStatusProps) {
  const config = statusConfig[status]

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        config.className,
        size === 'sm' && 'text-xs px-1.5 py-0'
      )}
    >
      <HugeiconsIcon
        icon={config.icon}
        className={cn(
          'h-3 w-3',
          status === 'running' && 'animate-spin'
        )}
      />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  )
}

export function BuildStatusIcon({ status }: { status: BuildStatusType }) {
  const config = statusConfig[status]

  return (
    <HugeiconsIcon
      icon={config.icon}
      className={cn(
        'h-4 w-4',
        status === 'running' && 'animate-spin',
        status === 'success' && 'text-green-500',
        status === 'failure' && 'text-destructive',
        status === 'pending' && 'text-chart-1',
        status === 'cancelled' && 'text-muted-foreground'
      )}
    />
  )
}
