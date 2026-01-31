'use client'

import { ApiError, clearAuthToken, hasAuthToken, setAuthToken } from '@/lib/api/client'

export interface TokenValidationResult {
  valid: boolean
  error?: string
}

export async function validateToken(token: string): Promise<TokenValidationResult> {
  try {
    // Validate token by making a test request WITHOUT setting it globally first
    // This prevents a race condition where an invalid token could be used by
    // concurrent requests before validation completes
    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:8080')

    const response = await fetch(`${API_BASE_URL}/api/setup/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        error: errorData.error || `HTTP ${response.status}`,
      }
    }

    // Only set the token globally AFTER validation succeeds
    setAuthToken(token)
    return { valid: true }
  } catch (err) {
    // Don't clear any token here - we never set one
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
