import { beforeEach, describe, expect, it } from 'vitest'
import { useSetupStore } from '@/stores/setup-store'

// ── sessionStorage mock (jsdom provides one, but reset between tests) ──

beforeEach(() => {
  sessionStorage.clear()
  useSetupStore.setState({
    instanceId: null,
    sessionToken: null,
    sessionExpiresAt: null,
  })
})

describe('useSetupStore', () => {
  it('keeps the pre-instance setup capability in legacy-compatible storage', () => {
    useSetupStore.getState().setSessionToken('abc-123')
    useSetupStore.getState().setSessionExpiresAt(1_700_000_000)

    expect(useSetupStore.getState().sessionToken).toBe('abc-123')
    expect(useSetupStore.getState().sessionExpiresAt).toBe(1_700_000_000)
    expect(sessionStorage.getItem('oore_setup_session')).toBe('abc-123')
    expect(sessionStorage.getItem('oore_setup_session_expires')).toBe(
      '1700000000',
    )
  })

  it('reset clears the active instance setup capability', () => {
    const id = 'inst-reset'
    useSetupStore.getState().setInstanceContext(id)
    useSetupStore.getState().setSessionToken('tok')
    useSetupStore.getState().setSessionExpiresAt(1234)

    useSetupStore.getState().reset()

    expect(sessionStorage.getItem(`oore_setup_session_${id}`)).toBeNull()
    expect(
      sessionStorage.getItem(`oore_setup_session_expires_${id}`),
    ).toBeNull()
    expect(useSetupStore.getState().sessionToken).toBeNull()
    expect(useSetupStore.getState().sessionExpiresAt).toBeNull()
  })

  it('isolates setup capabilities when the active instance changes', () => {
    const id1 = 'inst-1'
    const id2 = 'inst-2'
    sessionStorage.setItem(`oore_setup_session_${id1}`, 'tok-1')
    sessionStorage.setItem(`oore_setup_session_expires_${id1}`, '111')
    sessionStorage.setItem(`oore_setup_session_${id2}`, 'tok-2')
    sessionStorage.setItem(`oore_setup_session_expires_${id2}`, '222')

    useSetupStore.getState().setInstanceContext(id1)
    expect(useSetupStore.getState().sessionToken).toBe('tok-1')
    expect(useSetupStore.getState().sessionExpiresAt).toBe(111)

    useSetupStore.getState().setInstanceContext(id2)
    expect(useSetupStore.getState().sessionToken).toBe('tok-2')
    expect(useSetupStore.getState().sessionExpiresAt).toBe(222)
  })
})
