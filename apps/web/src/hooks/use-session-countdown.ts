import { useSetupStore } from '@/stores/setup-store'
import { useTime } from './use-time'

interface SessionCountdown {
  remainingSeconds: number | null
  isExpired: boolean
  isWarning: boolean
  formatted: string | null
}

export function useSessionCountdown(): SessionCountdown {
  const sessionExpiresAt = useSetupStore((s) => s.sessionExpiresAt)
  const time = useTime()
  const now = Math.floor(time / 1000)
  const remainingSeconds =
    sessionExpiresAt == null ? null : Math.max(0, sessionExpiresAt - now)

  if (remainingSeconds == null) {
    return {
      remainingSeconds: null,
      isExpired: false,
      isWarning: false,
      formatted: null,
    }
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return {
    remainingSeconds,
    isExpired: remainingSeconds <= 0,
    isWarning: remainingSeconds > 0 && remainingSeconds < 5 * 60,
    formatted,
  }
}
