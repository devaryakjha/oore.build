import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon } from '@hugeicons/core-free-icons'

import {
  useInstancePreferences,
  useUpdateInstancePreferences,
} from '@/hooks/use-artifact-storage'
import { useHasPermission } from '@/hooks/use-permissions'
import { toast } from '@/lib/toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

export function DirectRunnerPolicyPanel() {
  const canRead = useHasPermission('instance_settings', 'read')

  if (!canRead) return null

  return <DirectRunnerPolicyControl />
}

function DirectRunnerPolicyControl() {
  const preferencesQuery = useInstancePreferences()
  const updatePreferences = useUpdateInstancePreferences()
  const canWrite = useHasPermission('instance_settings', 'write')
  const preferences = preferencesQuery.data
  const enabled = !(preferences?.direct_macos_runner_paused ?? false)

  if (preferencesQuery.isLoading) {
    return <Skeleton className="h-16 w-full" />
  }

  if (preferencesQuery.error) {
    return (
      <Alert variant="destructive">
        <HugeiconsIcon icon={Alert02Icon} aria-hidden />
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Failed to load Direct runner policy:{' '}
            {preferencesQuery.error.message}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void preferencesQuery.refetch()}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!preferences) return null

  function updatePolicy(checked: boolean) {
    const currentPreferences = preferences
    if (!currentPreferences || !canWrite || updatePreferences.isPending) return

    updatePreferences.mutate(
      {
        key_storage_mode: currentPreferences.key_storage_mode,
        direct_macos_runner_paused: !checked,
      },
      {
        onSuccess: () =>
          toast.success(
            checked
              ? 'Direct macOS runner enabled.'
              : 'Direct macOS runner paused. Running builds will finish.',
          ),
        onError: (error) =>
          toast.error(`Failed to update runner policy: ${error.message}`),
      },
    )
  }

  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Allow approved repositories</ItemTitle>
        <ItemDescription>
          Pause new claims while assigned and running jobs finish.
        </ItemDescription>
        {!canWrite ? (
          <ItemDescription>
            You have read-only access to this instance policy.
          </ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions className="ml-auto">
        <Switch
          id="direct-runner-policy"
          aria-label="Allow approved repositories"
          checked={enabled}
          disabled={!canWrite || updatePreferences.isPending}
          onCheckedChange={updatePolicy}
        />
      </ItemActions>
    </Item>
  )
}
