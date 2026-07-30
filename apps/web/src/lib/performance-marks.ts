import { useEffect } from 'react'

const PERFORMANCE_SESSION_KEY = 'oore.performance.capture'

export const PERFORMANCE_MARKS = {
  routeStart: 'oore:route:start',
  routeResolved: 'oore:route:resolved',
  usefulContent: 'oore:content:useful',
  interactionReady: 'oore:interaction:ready',
  logViewerOpen: 'oore:logs:open',
  firstVisibleLogRows: 'oore:logs:first-visible-rows',
  streamUpdateComplete: 'oore:logs:stream-update-complete',
  logFilterReady: 'oore:logs:filter-ready',
} as const

export type PerformanceSurface =
  | 'builds-collection'
  | 'build-detail'
  | 'preferences-form'
  | 'qa-release-hub'
  | 'build-log-workbench'

function hasBrowserPerformanceApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.performance?.mark === 'function'
  )
}

export function initializePerformanceCapture(search: string): void {
  if (typeof window === 'undefined') return

  const requested = new URLSearchParams(search).get('oorePerf')
  if (requested === '1') {
    window.sessionStorage.setItem(PERFORMANCE_SESSION_KEY, '1')
  } else if (requested === '0') {
    window.sessionStorage.removeItem(PERFORMANCE_SESSION_KEY)
  }
}

export function isPerformanceCaptureEnabled(): boolean {
  return (
    hasBrowserPerformanceApi() &&
    window.sessionStorage.getItem(PERFORMANCE_SESSION_KEY) === '1'
  )
}

export function markPerformance(
  name: (typeof PERFORMANCE_MARKS)[keyof typeof PERFORMANCE_MARKS],
  detail: Record<string, string | number | boolean | null>,
): void {
  if (!isPerformanceCaptureEnabled()) return
  window.performance.mark(name, { detail })
}

export function usePerformanceSurface(
  surface: PerformanceSurface,
  ready: boolean,
): void {
  useEffect(() => {
    if (!ready || !isPerformanceCaptureEnabled()) return

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        markPerformance(PERFORMANCE_MARKS.usefulContent, { surface })
        markPerformance(PERFORMANCE_MARKS.interactionReady, { surface })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) window.cancelAnimationFrame(secondFrame)
    }
  }, [ready, surface])
}
