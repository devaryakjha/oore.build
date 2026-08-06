import { HugeiconsIcon } from '@hugeicons/react'
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons'
import type {
  useExternalAccessNetworkSettings,
  useExternalAccessPreflight,
} from '@/hooks/use-artifact-storage'
import type {
  GetExternalAccessOidcResponse,
  RemoteAuthMode,
  TrustedProxySettingsPublic,
} from '@/lib/types'
import {
  authModeLabel,
  guidanceForPreflight,
} from '@/components/settings/preferences-utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'

export function ExternalAccessSetup({
  identityError,
  identityLoading,
  identityReady,
  identitySaving,
  isOwner,
  networkReady,
  networkSettingsQuery,
  oidcConfig,
  onEditIdentity,
  onEditNetwork,
  onChooseCloudflare,
  onChooseOidc,
  onChooseOtherProxy,
  onPreloadIdentity,
  onPreloadNetwork,
  onReadinessOpenChange,
  onRetryIdentity,
  preflightQuery,
  readinessOpen,
  readinessReady,
  remoteAuthMode,
  setupReady,
  setupStepsComplete,
  trustedProxySettings,
}: {
  identityError: Error | null
  identityLoading: boolean
  identityReady: boolean
  identitySaving: boolean
  isOwner: boolean
  networkReady: boolean
  networkSettingsQuery: ReturnType<typeof useExternalAccessNetworkSettings>
  oidcConfig: GetExternalAccessOidcResponse | undefined
  onEditIdentity: () => void
  onEditNetwork: () => void
  onChooseCloudflare: () => void
  onChooseOidc: () => void
  onChooseOtherProxy: () => void
  onPreloadIdentity: () => void
  onPreloadNetwork: () => void
  onReadinessOpenChange: (open: boolean) => void
  onRetryIdentity: () => void
  preflightQuery: ReturnType<typeof useExternalAccessPreflight>
  readinessOpen: boolean
  readinessReady: boolean
  remoteAuthMode: RemoteAuthMode
  setupReady: boolean
  setupStepsComplete: number
  trustedProxySettings: TrustedProxySettingsPublic | undefined
}) {
  const networkSettings = networkSettingsQuery.data
  const failedReadinessChecks =
    preflightQuery.data?.checks.filter((check) => !check.ok) ?? []
  const setupStepCount = 2
  const ReadinessIcon = readinessOpen ? ArrowDown01Icon : ArrowRight01Icon
  const identityLabel =
    remoteAuthMode === 'trusted_proxy' &&
    trustedProxySettings?.proof_provider === 'cloudflare_access'
      ? 'Cloudflare Access'
      : authModeLabel(remoteAuthMode)
  return (
    <>
      {!networkReady ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Next: Add the public address</CardTitle>
            <CardDescription>
              Enter the HTTPS address and the frontend address that will open
              Oore.
            </CardDescription>
            <CardAction>
              <Button
                type="button"
                onClick={onEditNetwork}
                disabled={
                  !isOwner ||
                  networkSettingsQuery.isLoading ||
                  !!networkSettingsQuery.error
                }
              >
                Add public address
              </Button>
            </CardAction>
          </CardHeader>
        </Card>
      ) : !identityReady && !identityError ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Next: Choose how users sign in</CardTitle>
            <CardDescription>
              Cloudflare Access is the best choice when Cloudflare protects the
              public address.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              onClick={onChooseCloudflare}
              disabled={!isOwner || identityLoading || identitySaving}
            >
              {identitySaving ? <Spinner className="size-4" /> : null}
              Use Cloudflare Access
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onChooseOidc}
              disabled={!isOwner || identityLoading || identitySaving}
            >
              Use OpenID Connect
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onChooseOtherProxy}
              disabled={!isOwner || identityLoading || identitySaving}
            >
              Use another proxy
            </Button>
          </CardContent>
        </Card>
      ) : readinessReady ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Setup is ready</CardTitle>
            <CardDescription>
              Turn on remote access above, then sign in through the public
              address.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card size="sm">
        <CardHeader>
          <CardTitle>Setup steps</CardTitle>
          <CardDescription>
            {preflightQuery.isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner className="size-4" />
                Checking requirements...
              </span>
            ) : (
              <>
                {setupStepsComplete}/{setupStepCount} setup steps ready.
              </>
            )}
          </CardDescription>
          <CardAction>
            <Badge variant={readinessReady ? 'secondary' : 'outline'}>
              {readinessReady
                ? 'Ready to enable'
                : `${setupStepsComplete}/${setupStepCount} ready`}
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent>
          <ItemGroup className="grid gap-3 md:grid-cols-2">
            <Item
              render={
                <button
                  type="button"
                  disabled={
                    !isOwner ||
                    networkSettingsQuery.isLoading ||
                    !!networkSettingsQuery.error
                  }
                />
              }
              variant="outline"
              className="disabled:pointer-events-none disabled:opacity-50"
              onMouseEnter={onPreloadNetwork}
              onFocus={onPreloadNetwork}
              onClick={onEditNetwork}
            >
              <ItemContent>
                <ItemTitle>1. Network</ItemTitle>
                <ItemDescription>
                  {networkSettings?.public_url ??
                    'Set Public URL and allowed origins.'}
                </ItemDescription>
                <ItemDescription>
                  {networkSettings?.allowed_origins.length ?? 0} allowed origins
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant={networkReady ? 'secondary' : 'outline'}>
                  {networkReady ? 'Ready' : 'Setup'}
                </Badge>
                <HugeiconsIcon icon={ArrowRight01Icon} />
              </ItemActions>
            </Item>

            <Item
              render={
                identityReady ? (
                  <button
                    type="button"
                    disabled={!isOwner || identityLoading || !!identityError}
                  />
                ) : (
                  <div />
                )
              }
              variant="outline"
              className="disabled:pointer-events-none disabled:opacity-50"
              onMouseEnter={identityReady ? onPreloadIdentity : undefined}
              onFocus={identityReady ? onPreloadIdentity : undefined}
              onClick={identityReady ? onEditIdentity : undefined}
            >
              <ItemContent>
                <ItemTitle>2. Identity</ItemTitle>
                <ItemDescription>
                  {identityReady
                    ? `${identityLabel} configured.`
                    : 'Choose a sign-in method above.'}
                </ItemDescription>
                {remoteAuthMode === 'trusted_proxy' && trustedProxySettings ? (
                  <>
                    {trustedProxySettings.proof_provider ===
                    'cloudflare_access' ? (
                      <>
                        <ItemDescription>
                          Proof: Signed Cloudflare Access token
                        </ItemDescription>
                        <ItemDescription>
                          Team: {trustedProxySettings.cloudflare_team_domain}
                        </ItemDescription>
                      </>
                    ) : (
                      <>
                        <ItemDescription>
                          Header: {trustedProxySettings.user_email_header}
                        </ItemDescription>
                        <ItemDescription>
                          Secret:{' '}
                          {trustedProxySettings.has_shared_secret
                            ? 'Stored'
                            : 'Missing'}
                        </ItemDescription>
                      </>
                    )}
                    {trustedProxySettings.proof_provider === 'shared_secret' &&
                    trustedProxySettings.user_email_header ===
                      'x-warpgate-username' ? (
                      <ItemDescription>
                        iOS installs:{' '}
                        {trustedProxySettings.has_warpgate_ticket
                          ? `Ticket from ${trustedProxySettings.warpgate_ticket_source === 'environment' ? 'environment' : 'encrypted settings'}`
                          : 'Ticket missing'}
                      </ItemDescription>
                    ) : null}
                    <ItemDescription>
                      Peer CIDRs:{' '}
                      {trustedProxySettings.trusted_proxy_cidrs.length > 0
                        ? trustedProxySettings.trusted_proxy_cidrs.join(', ')
                        : 'Loopback only'}
                    </ItemDescription>
                  </>
                ) : remoteAuthMode === 'oidc' && oidcConfig ? (
                  <>
                    <ItemDescription>
                      Issuer: {oidcConfig.issuer_url}
                    </ItemDescription>
                    <ItemDescription>
                      Client ID: {oidcConfig.client_id}
                    </ItemDescription>
                    <ItemDescription>
                      Secret:{' '}
                      {oidcConfig.has_client_secret
                        ? 'Stored'
                        : 'None (public client)'}
                    </ItemDescription>
                  </>
                ) : null}
              </ItemContent>
              <ItemActions>
                <Badge variant={identityReady ? 'secondary' : 'outline'}>
                  {identityReady ? 'Ready' : 'Setup'}
                </Badge>
                {identityReady ? (
                  <HugeiconsIcon icon={ArrowRight01Icon} />
                ) : null}
              </ItemActions>
            </Item>
          </ItemGroup>
        </CardContent>
      </Card>

      {!setupReady ? (
        <Alert variant="destructive">
          <AlertDescription>
            Complete setup before enabling External Access.
          </AlertDescription>
        </Alert>
      ) : null}

      {networkSettingsQuery.error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Failed to load network settings:{' '}
              {networkSettingsQuery.error.message}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void networkSettingsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {identityError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Failed to load identity settings: {identityError.message}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetryIdentity}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Collapsible open={readinessOpen} onOpenChange={onReadinessOpenChange}>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Technical checks</CardTitle>
            <CardDescription>
              {preflightQuery.isLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner className="size-4" />
                  Checking...
                </span>
              ) : preflightQuery.error ? (
                <span className="text-destructive">Check run failed.</span>
              ) : preflightQuery.data?.ready ? (
                <>All checks are passing.</>
              ) : (
                <>
                  {failedReadinessChecks.length} check
                  {failedReadinessChecks.length === 1 ? '' : 's'} need
                  attention.
                </>
              )}
            </CardDescription>
            <CardAction>
              <CollapsibleTrigger
                render={<Button type="button" variant="ghost" size="sm" />}
              >
                <HugeiconsIcon icon={ReadinessIcon} />
                {readinessOpen ? 'Hide checks' : 'Show checks'}
              </CollapsibleTrigger>
            </CardAction>
          </CardHeader>

          <CardContent className="space-y-3">
            {preflightQuery.error ? (
              <Alert variant="destructive">
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Failed to run readiness checks:{' '}
                    {preflightQuery.error.message}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void preflightQuery.refetch()}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            <CollapsibleContent>
              <ItemGroup>
                {preflightQuery.data
                  ? preflightQuery.data.checks.map((check) => {
                      const CheckIcon = check.ok
                        ? CheckmarkCircle02Icon
                        : AlertCircleIcon

                      return (
                        <Item key={check.id} variant="outline" size="sm">
                          <ItemMedia>
                            <HugeiconsIcon
                              icon={CheckIcon}
                              className={
                                check.ok ? 'text-success' : 'text-destructive'
                              }
                            />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>{check.label}</ItemTitle>
                            <ItemDescription>
                              {check.ok
                                ? check.message
                                : guidanceForPreflight(
                                    check.id,
                                    check.failure_code,
                                  )}
                            </ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            <Badge variant={check.ok ? 'secondary' : 'outline'}>
                              {check.ok ? 'Ready' : 'Needs setup'}
                            </Badge>
                          </ItemActions>
                        </Item>
                      )
                    })
                  : null}
              </ItemGroup>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>
    </>
  )
}
