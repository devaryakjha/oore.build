import type { ReactNode } from 'react'
import type { RemoteAuthMode } from '@/lib/types'
import {
  authModeDescription,
  authModeLabel,
} from '@/components/settings/preferences-utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import {
  SettingsSection,
  SettingsSurface,
} from '@/components/settings/settings-section'

export function ExternalAccessCard({
  children,
  externalAccessEnabled,
  isOwner,
  onToggle,
  preflightLoading,
  readinessReady,
  remoteAuthMode,
  updatePending,
}: {
  children: ReactNode
  externalAccessEnabled: boolean
  isOwner: boolean
  onToggle: () => void
  preflightLoading: boolean
  readinessReady: boolean
  remoteAuthMode: RemoteAuthMode
  updatePending: boolean
}) {
  return (
    <SettingsSection
      title="External access"
      description={
        externalAccessEnabled
          ? authModeDescription(remoteAuthMode)
          : 'Local sign-in is limited to this machine.'
      }
      actions={
        <Badge variant={externalAccessEnabled ? 'secondary' : 'outline'}>
          {externalAccessEnabled ? authModeLabel(remoteAuthMode) : 'Local only'}
        </Badge>
      }
    >
      <SettingsSurface inset={false}>
        <Item>
          <ItemContent>
            <ItemTitle>Allow access from other devices</ItemTitle>
            <ItemDescription>
              {externalAccessEnabled
                ? 'Remote sign-in is available using the configured identity provider.'
                : 'Follow the steps below. Oore will enable this button when setup is ready.'}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {isOwner ? (
              <Button
                type="button"
                onClick={onToggle}
                disabled={
                  updatePending ||
                  (!externalAccessEnabled &&
                    (!readinessReady || preflightLoading))
                }
              >
                {updatePending ? (
                  <>
                    <Spinner />
                    Saving...
                  </>
                ) : externalAccessEnabled ? (
                  'Turn off'
                ) : !readinessReady ? (
                  'Finish setup below'
                ) : (
                  'Turn on'
                )}
              </Button>
            ) : null}
          </ItemActions>
        </Item>
      </SettingsSurface>
      {!isOwner ? (
        <Alert>
          <AlertDescription>
            Only the owner can change external access.
          </AlertDescription>
        </Alert>
      ) : null}
      {children}
    </SettingsSection>
  )
}
