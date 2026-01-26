// API configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

// Auth
export const AUTH_TOKEN_KEY = 'oore_auth_token'

// Polling intervals (ms)
export const BUILD_POLLING_INTERVAL = 5000
export const SETUP_POLLING_INTERVAL = 2000

// Build status colors
export const BUILD_STATUS_COLORS = {
  pending: 'bg-chart-1 text-chart-1-foreground',
  running: 'bg-chart-2 text-chart-2-foreground',
  success: 'bg-green-500 text-white',
  failure: 'bg-destructive text-destructive-foreground',
  cancelled: 'bg-muted text-muted-foreground',
} as const

// Provider icons and colors
export const PROVIDER_CONFIG = {
  github: {
    name: 'GitHub',
    color: 'bg-neutral-900 dark:bg-neutral-100',
  },
  gitlab: {
    name: 'GitLab',
    color: 'bg-orange-500',
  },
} as const
