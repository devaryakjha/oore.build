import { beforeEach, describe, expect, it } from 'vitest'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth-store'
import { useInstanceStore } from '@/stores/instance-store'
import { useSetupStore } from '@/stores/setup-store'

const authUser = {
  email: 'owner@example.com',
  oidc_subject: 'owner-subject',
  user_id: 'owner-id',
  role: 'owner' as const,
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  queryClient.clear()
  useInstanceStore.setState({
    instances: {},
    activeInstanceId: null,
  })
  useAuthStore.setState({
    instanceId: null,
    token: null,
    expiresAt: null,
    user: null,
  })
  useSetupStore.setState({
    instanceId: null,
    sessionToken: null,
    sessionExpiresAt: null,
  })
})

describe('useInstanceStore', () => {
  it('clears active credentials before publishing a changed backend authority', () => {
    const id = useInstanceStore
      .getState()
      .addInstance('Server', 'https://original.example.com')
    useAuthStore.getState().setInstanceContext(id)
    useAuthStore.getState().setAuth('prior-bearer', 9_999_999_999, authUser)
    useSetupStore.getState().setInstanceContext(id)
    useSetupStore.getState().setSessionToken('prior-setup-session')
    useSetupStore.getState().setSessionExpiresAt(9_999_999_999)
    sessionStorage.setItem(
      `oore_setup_trusted_proxy_prefill_${id}`,
      '{"ownerEmail":"owner@example.com"}',
    )
    queryClient.setQueryData([id, 'users'], { users: ['prior-backend'] })

    let stateWhenUrlChanged:
      | { authToken: string | null; setupToken: string | null }
      | undefined
    const unsubscribe = useInstanceStore.subscribe((state, previous) => {
      if (state.instances[id]?.url !== previous.instances[id]?.url) {
        stateWhenUrlChanged = {
          authToken: useAuthStore.getState().token,
          setupToken: useSetupStore.getState().sessionToken,
        }
      }
    })

    useInstanceStore.getState().updateInstance(id, {
      url: 'https://replacement.example.com',
    })
    unsubscribe()

    expect(stateWhenUrlChanged).toEqual({
      authToken: null,
      setupToken: null,
    })
    expect(localStorage.getItem(`oore_auth_token_${id}`)).toBeNull()
    expect(sessionStorage.getItem(`oore_setup_session_${id}`)).toBeNull()
    expect(
      sessionStorage.getItem(`oore_setup_session_expires_${id}`),
    ).toBeNull()
    expect(
      sessionStorage.getItem(`oore_setup_trusted_proxy_prefill_${id}`),
    ).toBeNull()
    expect(queryClient.getQueryData([id, 'users'])).toBeUndefined()
  })

  it('clears only the edited inactive instance credentials', () => {
    const activeId = useInstanceStore
      .getState()
      .addInstance('Active', 'https://active.example.com')
    const editedId = useInstanceStore
      .getState()
      .addInstance('Edited', 'https://original.example.com')
    useAuthStore.getState().setInstanceContext(activeId)
    useAuthStore.getState().setAuth('active-bearer', 9_999_999_999, authUser)
    useSetupStore.getState().setInstanceContext(activeId)
    useSetupStore.getState().setSessionToken('active-setup-session')
    localStorage.setItem(`oore_auth_token_${editedId}`, 'prior-bearer')
    sessionStorage.setItem(
      `oore_setup_session_${editedId}`,
      'prior-setup-session',
    )
    queryClient.setQueryData([activeId, 'users'], ['active'])
    queryClient.setQueryData([editedId, 'users'], ['edited'])

    useInstanceStore.getState().updateInstance(editedId, {
      url: 'https://replacement.example.com',
    })

    expect(useAuthStore.getState().token).toBe('active-bearer')
    expect(useSetupStore.getState().sessionToken).toBe('active-setup-session')
    expect(localStorage.getItem(`oore_auth_token_${editedId}`)).toBeNull()
    expect(sessionStorage.getItem(`oore_setup_session_${editedId}`)).toBeNull()
    expect(queryClient.getQueryData([activeId, 'users'])).toEqual(['active'])
    expect(queryClient.getQueryData([editedId, 'users'])).toBeUndefined()

    useInstanceStore.getState().setActiveInstance(editedId)
    expect(useAuthStore.getState().token).toBeNull()
    expect(useSetupStore.getState().sessionToken).toBeNull()
  })

  it('preserves credentials for non-authority edits', () => {
    const id = useInstanceStore
      .getState()
      .addInstance('Server', 'https://ci.example.com')
    useAuthStore.getState().setInstanceContext(id)
    useAuthStore.getState().setAuth('current-bearer', 9_999_999_999, authUser)
    useSetupStore.getState().setInstanceContext(id)
    useSetupStore.getState().setSessionToken('current-setup-session')
    queryClient.setQueryData([id, 'users'], ['current'])

    useInstanceStore.getState().updateInstance(id, {
      label: 'Renamed',
      url: 'https://CI.EXAMPLE.COM:443/',
    })

    expect(useAuthStore.getState().token).toBe('current-bearer')
    expect(useSetupStore.getState().sessionToken).toBe('current-setup-session')
    expect(queryClient.getQueryData([id, 'users'])).toEqual(['current'])
  })
})
