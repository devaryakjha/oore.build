import {
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
} from '@tanstack/react-router'
import { setupStatusQueryOptions, useSetupStatus } from '@/hooks/use-setup'
import { useSessionCountdown } from '@/hooks/use-session-countdown'
import { useExpiredSetupSessionRedirect } from '@/hooks/use-setup-route-transitions'
import { isLoopbackUrl, isMixedContentBlocked } from '@/lib/connectivity'
import {
  getActiveInstanceOrRedirect,
  syncSetupStoreContext,
} from '@/lib/instance-context'
import {
  normalizeTrustedProxySetupPreset,
  saveTrustedProxySetupPrefill,
} from '@/lib/setup-prefill'
import {
  resolveInstanceApiBaseUrl,
  resolveRequiredInstanceApiBaseUrl,
} from '@/lib/instance-url'
import { useInstanceStore } from '@/stores/instance-store'
import { useSetupStore } from '@/stores/setup-store'
import { PageMeta } from '@/lib/seo'
import { queryClient } from '@/lib/query-client'
import {
  SetupRouteError,
  SetupStepIndicator,
} from '@/components/setup-route-components'

function normalizeHandoffBackend(value: string): string | null {
  try {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

function maybeAutoAddBackendInstance(): string | null {
  const params = new URLSearchParams(window.location.search)
  const backendUrl = params.get('backend')
  const ownerEmail = params.get('setup_owner_email')
  const proxyPreset = normalizeTrustedProxySetupPreset(
    params.get('proxy_preset'),
  )
  const userEmailHeader = params.get('user_email_header')
  const hasSetupPrefill = Boolean(ownerEmail || proxyPreset || userEmailHeader)
  if (!backendUrl && !hasSetupPrefill) return null

  const store = useInstanceStore.getState()
  let instanceId = store.activeInstanceId
  let normalizedBackend: string | null = null

  if (backendUrl) {
    normalizedBackend = normalizeHandoffBackend(backendUrl)
    if (!normalizedBackend) return null
    const parsedBackendUrl = new URL(normalizedBackend)

    // Keep remote handoffs fail-closed when another instance is already saved.
    // A loopback setup page can safely activate its loopback control plane.
    if (Object.keys(store.instances).length === 0) {
      const label = isLoopbackUrl(backendUrl)
        ? 'Local'
        : parsedBackendUrl.hostname
      const id = store.addInstance(label, normalizedBackend)
      store.setActiveInstance(id)
      instanceId = id
    } else {
      const matchingInstance = Object.values(store.instances).find(
        (instance) =>
          normalizeHandoffBackend(resolveInstanceApiBaseUrl(instance) ?? '') ===
          normalizedBackend,
      )
      if (matchingInstance) {
        store.setActiveInstance(matchingInstance.id)
        instanceId = matchingInstance.id
      } else if (
        isLoopbackUrl(normalizedBackend) &&
        isLoopbackUrl(window.location.origin)
      ) {
        const id = store.addInstance('Local', normalizedBackend)
        store.setActiveInstance(id)
        instanceId = id
      }
    }
  }

  if (instanceId && hasSetupPrefill) {
    saveTrustedProxySetupPrefill(instanceId, {
      ownerEmail: ownerEmail ?? undefined,
      proxyPreset,
      userEmailHeader: userEmailHeader ?? undefined,
    })
  }

  const url = new URL(window.location.href)
  url.searchParams.delete('backend')
  url.searchParams.delete('setup_owner_email')
  url.searchParams.delete('proxy_preset')
  url.searchParams.delete('user_email_header')
  window.history.replaceState(
    window.history.state,
    '',
    url.pathname + url.search + url.hash,
  )
  return normalizedBackend
}

function takeBootstrapTokenFromFragment(): string | null | undefined {
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  if (!fragment.has('bootstrap_token')) return undefined

  const token = fragment.get('bootstrap_token')
  fragment.delete('bootstrap_token')

  const url = new URL(window.location.href)
  const remainingFragment = fragment.toString()
  url.hash = remainingFragment ? `#${remainingFragment}` : ''
  window.history.replaceState(
    window.history.state,
    '',
    url.pathname + url.search + url.hash,
  )

  return token?.trim() || null
}

export const Route = createFileRoute('/setup')({
  beforeLoad: async () => {
    // Handle ?backend= query param before instance guards
    const requestedBackend = maybeAutoAddBackendInstance()
    const bootstrapToken = takeBootstrapTokenFromFragment()

    const instance = getActiveInstanceOrRedirect()
    const baseUrl = resolveRequiredInstanceApiBaseUrl(instance)
    syncSetupStoreContext(instance.id)
    if (bootstrapToken !== undefined) {
      const activeBackend = normalizeHandoffBackend(baseUrl)
      if (
        bootstrapToken &&
        (!requestedBackend || requestedBackend !== activeBackend)
      ) {
        throw new Error(
          'This setup link targets a different Oore instance. Select that instance, then generate a new setup link.',
        )
      }
      useSetupStore.getState().setBootstrapTokenPrefill(bootstrapToken)
    }
    if (isMixedContentBlocked(window.location.origin, baseUrl)) {
      throw new Error('mixed_content_blocked')
    }

    const status = await queryClient.ensureQueryData(
      setupStatusQueryOptions(instance),
    )
    if (status.is_configured) {
      useSetupStore.getState().setBootstrapTokenPrefill(null)
      throw redirect({ to: '/' })
    }
  },
  component: SetupLayout,
  errorComponent: SetupRouteError,
})

function SetupLayout() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const { data: status } = useSetupStatus()
  const { formatted, isWarning, isExpired } = useSessionCountdown()
  const steps =
    status?.runtime_mode === 'local'
      ? ['Token', 'Mode', 'Owner', 'Complete']
      : status?.remote_auth_mode === 'trusted_proxy'
        ? ['Token', 'Mode', 'Proxy', 'Owner', 'Complete']
        : ['Token', 'Mode', 'OIDC', 'Owner', 'Complete']
  const currentStepByPath: Record<string, number> = {
    '/setup': 0,
    '/setup/': 0,
    '/setup/mode': 1,
    '/setup/oidc': 2,
    '/setup/trusted-proxy': 2,
    '/setup/owner': steps.length - 2,
    '/setup/complete': steps.length - 1,
  }
  const currentStep = status?.is_configured
    ? steps.length
    : (currentStepByPath[pathname] ?? 0)

  useExpiredSetupSessionRedirect(isExpired)

  return (
    <div className="focused-flow flex min-h-0 flex-1 flex-col items-center p-4 sm:p-6">
      <PageMeta title="Setup" />
      <div className="w-full max-w-lg space-y-5 sm:space-y-6">
        <header className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center">
            <img src="/logo.svg" alt="Oore logo" className="size-full" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight">
              Instance setup
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure your self-hosted CI instance
            </p>
          </div>
        </header>

        <div className="space-y-2">
          <SetupStepIndicator currentStep={currentStep} steps={steps} />
          {formatted && !isExpired ? (
            <p
              className={`text-right font-mono text-xs ${isWarning ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
            >
              Session expires in {formatted}
            </p>
          ) : null}
        </div>

        <div className="setup-step-content border-t pt-5 sm:pt-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
