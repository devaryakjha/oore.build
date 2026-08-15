import { create } from 'zustand'
import { clearBootstrapTokenVerification } from '@/lib/api'

interface SetupStoreState {
  instanceId: string | null
  bootstrapTokenPrefill: string | null
  sessionToken: string | null
  sessionExpiresAt: number | null
  setInstanceContext: (instanceId: string | null) => void
  setBootstrapTokenPrefill: (token: string | null) => void
  setSessionToken: (token: string | null) => void
  setSessionExpiresAt: (expiresAt: number | null) => void
  reset: () => void
}

function tokenKey(instanceId: string | null) {
  return `oore_setup_session${instanceId ? '_${instanceId}' : ''}`
}

function expiresKey(instanceId: string | null) {
  return `oore_setup_session_expires${instanceId ? '_${instanceId}' : ''}`
}

function loadSessionToken(instanceId: string | null) {
  try {
    return sessionStorage.getItem(tokenKey(instanceId))
  } catch {
    return null
  }
}

function saveSessionToken(
  instanceId: string | null,
  token: string | null,
): void {
  try {
    if (token) {
      sessionStorage.setItem(tokenKey(instanceId), token)
    } else {
      sessionStorage.removeItem(tokenKey(instanceId))
    }
  } catch {
    // sessionStorage unavailable
  }
}

function loadSessionExpiresAt(instanceId: string | null) {
  try {
    const val = sessionStorage.getItem(expiresKey(instanceId))
    if (!val) return null
    const expiresAt = Number(val)
    return Number.isFinite(expiresAt) ? expiresAt : null
  } catch {
    return null
  }
}

function saveSessionExpiresAt(
  instanceId: string | null,
  expiresAt: number | null,
): void {
  try {
    if (expiresAt != null) {
      sessionStorage.setItem(expiresKey(instanceId), String(expiresAt))
    } else {
      sessionStorage.removeItem(expiresKey(instanceId))
    }
  } catch {
    // sessionStorage unavailable
  }
}

export const useSetupStore = create<SetupStoreState>()((set, get) => ({
  instanceId: null,
  bootstrapTokenPrefill: null,
  sessionToken: loadSessionToken(null),
  sessionExpiresAt: loadSessionExpiresAt(null),

  setInstanceContext: (instanceId) => {
    const currentInstanceId = get().instanceId
    set({
      instanceId,
      bootstrapTokenPrefill:
        currentInstanceId === instanceId ? get().bootstrapTokenPrefill : null,
      sessionToken: loadSessionToken(instanceId),
      sessionExpiresAt: loadSessionExpiresAt(instanceId),
    })
  },

  setBootstrapTokenPrefill: (token) => {
    if (token === null) clearBootstrapTokenVerification()
    set({ bootstrapTokenPrefill: token })
  },

  setSessionToken: (token) => {
    const { instanceId } = get()
    saveSessionToken(instanceId, token)
    set({ sessionToken: token })
  },

  setSessionExpiresAt: (expiresAt) => {
    const { instanceId } = get()
    saveSessionExpiresAt(instanceId, expiresAt)
    set({ sessionExpiresAt: expiresAt })
  },

  reset: () => {
    const { instanceId } = get()
    clearBootstrapTokenVerification()
    saveSessionToken(instanceId, null)
    saveSessionExpiresAt(instanceId, null)
    set({
      bootstrapTokenPrefill: null,
      sessionToken: null,
      sessionExpiresAt: null,
    })
  },
}))
