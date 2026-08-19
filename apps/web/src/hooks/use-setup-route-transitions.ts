import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'

import type { SetupStatus } from '@/api/types'
import { useSetupStore } from '@/stores/setup-store'

export function useBootstrapStepTransition(
  status: SetupStatus | undefined,
  sessionToken: string | null,
) {
  const navigate = useNavigate()
  const setupState = status?.state

  useEffect(() => {
    if (!setupState || !sessionToken) return

    if (setupState === 'bootstrap_pending' || setupState === 'uninitialized') {
      void navigate({
        to: '/setup/mode',
        viewTransition: { types: ['setup-forward'] },
      })
    } else if (setupState === 'idp_configured') {
      void navigate({
        to: '/setup/owner',
        viewTransition: { types: ['setup-forward'] },
      })
    } else if (setupState === 'owner_created') {
      void navigate({
        to: '/setup/complete',
        viewTransition: { types: ['setup-forward'] },
      })
    }
  }, [navigate, sessionToken, setupState])
}

export function useSetupModeGuard(
  status: SetupStatus | undefined,
  expectedAuthMode: 'oidc' | 'trusted_proxy',
) {
  const navigate = useNavigate()
  const runtimeMode = status?.runtime_mode
  const remoteAuthMode = status?.remote_auth_mode

  useEffect(() => {
    if (
      runtimeMode &&
      (runtimeMode !== 'remote' || remoteAuthMode !== expectedAuthMode)
    ) {
      void navigate({
        to: '/setup/mode',
        viewTransition: { types: ['setup-back'] },
      })
    }
  }, [expectedAuthMode, navigate, remoteAuthMode, runtimeMode])
}

export function useOwnerStepTransition(status?: SetupStatus) {
  const navigate = useNavigate()
  const setupState = status?.state

  useEffect(() => {
    if (setupState === 'owner_created') {
      void navigate({
        to: '/setup/complete',
        viewTransition: { types: ['setup-forward'] },
      })
    }
  }, [navigate, setupState])
}

export function useExpiredSetupSessionRedirect(isExpired: boolean) {
  const navigate = useNavigate()
  const reset = useSetupStore((state) => state.reset)
  const handledRef = useRef(false)

  useEffect(() => {
    if (!isExpired) {
      handledRef.current = false
      return
    }
    if (handledRef.current) return

    handledRef.current = true
    reset()
    void navigate({
      to: '/setup',
      viewTransition: { types: ['setup-back'] },
    })
  }, [isExpired, navigate, reset])
}
