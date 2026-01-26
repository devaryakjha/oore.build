'use client'

import { apiFetch, clearAuthToken, hasAuthToken, setAuthToken } from '@/lib/api/client'
import type { SetupStatus } from '@/lib/api/types'

export async function validateToken(token: string): Promise<boolean> {
  try {
    // Temporarily set the token to test it
    setAuthToken(token)

    // Try to fetch setup status - this requires auth
    await apiFetch<SetupStatus>('/api/setup/status')

    return true
  } catch {
    // Clear the token if validation failed
    clearAuthToken()
    return false
  }
}

export function logout(): void {
  clearAuthToken()
  window.location.href = '/login'
}

export function isAuthenticated(): boolean {
  return hasAuthToken()
}
