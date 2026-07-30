import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAuthStorageForInstance,
  getLastAuthMetaForInstance,
  useAuthStore,
} from './auth-store'

// Mock localStorage
const store: Record<string, string> = {}
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) delete store[key]
  }),
  get length() {
    return Object.keys(store).length
  },
  key: vi.fn((_: number) => null),
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  })
  mockLocalStorage.clear()
  useAuthStore.setState({
    instanceId: null,
    token: null,
    expiresAt: null,
    user: null,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('auth-store', () => {
  const testUser = {
    email: 'test@example.com',
    oidc_subject: 'sub-123',
    user_id: 'uid-456',
    role: 'developer' as const,
  }

  it('setInstanceContext isolates storage per instance', () => {
    useAuthStore.getState().setInstanceContext('inst-a')
    useAuthStore.getState().setAuth('tok-a', 111, testUser)

    useAuthStore.getState().setInstanceContext('inst-b')
    expect(useAuthStore.getState().token).toBeNull()

    const userB = { ...testUser, email: 'b@example.com' }
    useAuthStore.getState().setAuth('tok-b', 222, userB)

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'oore_auth_token_inst-b',
      'tok-b',
    )

    store['oore_auth_token_inst-a'] = 'tok-a'
    store['oore_auth_expires_inst-a'] = '111'
    store['oore_auth_user_inst-a'] = JSON.stringify(testUser)

    useAuthStore.getState().setInstanceContext('inst-a')
    expect(useAuthStore.getState().token).toBe('tok-a')
    expect(useAuthStore.getState().expiresAt).toBe(111)
  })

  it('clearAuthStorageForInstance clears all keys for that instance', () => {
    store['oore_auth_token_inst-x'] = 'tok'
    store['oore_auth_expires_inst-x'] = '999'
    store['oore_auth_user_inst-x'] = '{}'

    clearAuthStorageForInstance('inst-x')

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
      'oore_auth_token_inst-x',
    )
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
      'oore_auth_expires_inst-x',
    )
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
      'oore_auth_user_inst-x',
    )
  })

  it('clears live credentials without erasing the last-auth audit hint', () => {
    useAuthStore.getState().setInstanceContext('inst-a')
    useAuthStore.getState().setAuth('tok-a', 9999999999, testUser)

    expect(store['oore_auth_last_method_inst-a']).toBe('oidc')
    expect(Number(store['oore_auth_last_at_inst-a'])).toBeGreaterThan(0)
    expect(getLastAuthMetaForInstance('inst-a')).toEqual({
      method: 'oidc',
      at: Number(store['oore_auth_last_at_inst-a']),
    })

    useAuthStore.getState().clearAuth()

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      expiresAt: null,
      user: null,
    })
    expect(store['oore_auth_token_inst-a']).toBeUndefined()
    expect(store['oore_auth_expires_inst-a']).toBeUndefined()
    expect(store['oore_auth_user_inst-a']).toBeUndefined()
    expect(store['oore_auth_last_method_inst-a']).toBe('oidc')
    expect(store['oore_auth_last_at_inst-a']).toBeDefined()
  })
})
