import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { StepStatus } from '@/lib/api/types'
import {
  Clock01Icon,
  Loading03Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

const statusConfig: Record<
  StepStatus,
  { label: string; icon: typeof Clock01Icon; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: Clock01Icon,
    className: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  },
  running: {
    label: 'Running',
    icon: Loading03Icon,
    className: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  },
  success: {
    label: 'Success',
    icon: CheckmarkCircle02Icon,
    className: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
  },
  failure: {
    label: 'Failed',
    icon: Cancel01Icon,
    className: 'bg-destructive/20 text-destructive border-destructive/30',
  },
  skipped: {
    label: 'Skipped',
    icon: ArrowRight01Icon,
    className: 'bg-muted text-muted-foreground border-muted-foreground/30',
  },
  cancelled: {
    label: 'Cancelled',
    icon: AlertCircleIcon,
    className: 'bg-muted text-muted-foreground border-muted-foreground/30',
  },
}

interface StepStatusBadgeProps {
  status: StepStatus
  showLabel?: boolean
  size?: 'sm' | 'default'
}

export function StepStatusBadge({ status, showLabel = true, size = 'default' }: StepStatusBadgeProps) {
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

export function StepStatusIcon({ status }: { status: StepStatus }) {
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
        status === 'skipped' && 'text-muted-foreground',
        status === 'cancelled' && 'text-muted-foreground'
      )}
    />
  )
}
