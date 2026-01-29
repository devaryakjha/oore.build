'use client'

import { apiFetch, ApiError, clearAuthToken, hasAuthToken, setAuthToken } from '@/lib/api/client'
import type { SetupStatus } from '@/lib/api/types'

export interface TokenValidationResult {
  valid: boolean
  error?: string
}

export async function validateToken(token: string): Promise<TokenValidationResult> {
  try {
    // Temporarily set the token to test it
    setAuthToken(token)

    // Try to fetch setup status - this requires auth
    await apiFetch<SetupStatus>('/api/setup/status')

    return { valid: true }
  } catch (err) {
    // Clear the token if validation failed
    clearAuthToken()

    // Extract error message from ApiError
    if (err instanceof ApiError) {
      return { valid: false, error: err.message }
    }

    return { valid: false, error: 'Failed to connect to server' }
  }
}

export function logout(): void {
  clearAuthToken()
  window.location.href = '/login'
}

export function isAuthenticated(): boolean {
  return hasAuthToken()
}
