import useSWR from 'swr'
import { fetcher } from './client'
import type { WebhookEvent } from './types'

const WEBHOOKS_KEY = '/api/webhooks/events'

export function useWebhookEvents() {
  return useSWR<WebhookEvent[]>(WEBHOOKS_KEY, fetcher)
}

export function useWebhookEvent(id: string | null) {
  return useSWR<WebhookEvent>(
    id ? `${WEBHOOKS_KEY}/${id}` : null,
    fetcher
  )
}
