/**
 * Check if a date is valid
 */
function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime())
}

/**
 * Format a date string to a relative time (e.g., "2 hours ago")
 */
export function formatDistanceToNow(date: string | Date | null | undefined): string {
  if (!date) return 'Never'
  const now = new Date()
  const then = new Date(date)
  if (!isValidDate(then)) return 'Invalid date'
  const diffMs = now.getTime() - then.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return 'just now'
  } else if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(then)
  }
}

/**
 * Format a date to a readable string using Intl.DateTimeFormat
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (!isValidDate(d)) return 'Invalid date'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

/**
 * Format a date to include time using Intl.DateTimeFormat
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (!isValidDate(d)) return 'Invalid date'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Format duration in ms to readable string
 */
export function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000)
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)

  if (hours > 0) {
    return `${hours}h ${mins % 60}m`
  } else if (mins > 0) {
    return `${mins}m ${secs % 60}s`
  } else {
    return `${secs}s`
  }
}

/**
 * Calculate duration between two dates
 */
export function calculateDuration(start: string | Date | null | undefined, end: string | Date | null | undefined): string {
  if (!start || !end) return '-'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (!isValidDate(startDate) || !isValidDate(endDate)) return '-'
  return formatDuration(endDate.getTime() - startDate.getTime())
}
