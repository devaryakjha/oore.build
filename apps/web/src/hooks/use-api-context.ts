import { resolveInstanceApiBaseUrl } from '@/lib/instance-url'
import { useAuthStore } from '@/stores/auth-store'
import { useActiveInstance } from '@/stores/instance-store'
import { useTime } from './use-time'
import { useShallow } from 'zustand/react/shallow'

export function useApiContext() {
  const instance = useActiveInstance()
  const [token, expiresAt] = useAuthStore(
    useShallow((state) => [state.token, state.expiresAt]),
  )
  const time = useTime()
  const validToken =
    !token ||
    expiresAt == null ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Math.floor(time / 1000)
      ? null
      : token

  return {
    baseUrl: resolveInstanceApiBaseUrl(instance),
    instance,
    token: validToken,
  }
}
