import type { BadgeVariant } from '@/components/ui/badge'
import type { BuildStatus, RunnerPolicyBlockReason } from '@oore/client/models'

export const BUILD_STATUS_FILTER_OPTIONS = {
  all: 'All statuses',
  queued: 'Queued',
  scheduled: 'Scheduled',
  assigned: 'Assigned',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  timed_out: 'Timed out',
  canceled: 'Canceled',
  expired: 'Expired',
} as const satisfies Record<'all' | BuildStatus, string>

const BUILD_STATUS_VARIANT = new Map<string, BadgeVariant>([
  ['succeeded', 'success'],
  ['active', 'secondary'],
  ['failed', 'destructive'],
  ['error', 'destructive'],
])

export function getStatusVariant(status: string): BadgeVariant {
  return BUILD_STATUS_VARIANT.get(status) ?? 'outline'
}

const RUNNER_POLICY_BLOCK_LABEL = {
  instance_paused: 'Direct runner paused',
  repository_unavailable: 'Source unavailable',
} satisfies Record<RunnerPolicyBlockReason, string>

export function getRunnerPolicyBlockLabel(
  reason: RunnerPolicyBlockReason,
): string {
  return RUNNER_POLICY_BLOCK_LABEL[reason]
}

export function getIntegrationStatusVariant(status: string): BadgeVariant {
  if (status === 'active') return 'secondary'
  return status === 'error' ? 'destructive' : 'outline'
}

export function getPipelineStatusVariant(enabled: boolean): BadgeVariant {
  return enabled ? 'secondary' : 'outline'
}

export function getRunnerStatusVariant(status: string): BadgeVariant {
  return status === 'online' ? 'secondary' : 'outline'
}
