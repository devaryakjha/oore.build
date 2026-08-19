import { HttpResponse, delay, http } from 'msw'
import * as z from 'zod'
import type { NotificationChannel } from '@/lib/api-client/generated/models'
import { requireDemoInstancePermission } from '../authorization'
import { demoState } from '../state'

const channelTypeSchema = z.enum(['webhook', 'mattermost', 'email'])
const smtpConfigSchema = z.record(z.string(), z.json())
const createChannelSchema = z.object({
  name: z.string(),
  channel_type: channelTypeSchema,
  enabled: z.boolean().optional(),
  events: z.array(z.string()).optional(),
  url: z.string().optional(),
  secret: z.string().optional(),
  smtp_config: smtpConfigSchema.optional(),
})
const updateChannelSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  events: z.array(z.string()).optional(),
  url: z.string().optional(),
  secret: z.string().optional(),
  smtp_config: smtpConfigSchema.optional(),
})

function now(): number {
  return Math.floor(Date.now() / 1000)
}

export const notificationHandlers = [
  http.get('/v1/settings/notification-channels', async ({ request }) => {
    await delay(150)
    const url = new URL(request.url)
    const query = url.searchParams.get('q')?.toLowerCase()
    const sort = url.searchParams.get('sort') ?? 'name'
    const direction = url.searchParams.get('direction') === 'desc' ? -1 : 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
    const channels = demoState.notificationChannels
      .filter((channel) =>
        query
          ? [channel.name, channel.channel_type, ...channel.events].some(
              (value) => value.toLowerCase().includes(query),
            )
          : true,
      )
      .slice()
      .sort((left, right) => {
        const leftValue =
          sort === 'type'
            ? left.channel_type
            : sort === 'status'
              ? left.enabled
              : sort === 'updated_at'
                ? left.updated_at
                : left.name
        const rightValue =
          sort === 'type'
            ? right.channel_type
            : sort === 'status'
              ? right.enabled
              : sort === 'updated_at'
                ? right.updated_at
                : right.name
        return direction * String(leftValue).localeCompare(String(rightValue))
      })
    return HttpResponse.json({
      channels: channels.slice(offset, offset + limit),
      total: channels.length,
    })
  }),

  http.post('/v1/settings/notification-channels', async ({ request }) => {
    await delay(300)
    const forbidden = requireDemoInstancePermission(
      request,
      'instance_settings:write',
    )
    if (forbidden) return forbidden
    const body = createChannelSchema.parse(await request.json())

    const channel: NotificationChannel = {
      id: `notif-demo-${crypto.randomUUID().slice(0, 8)}`,
      name: body.name,
      channel_type: body.channel_type,
      enabled: body.enabled ?? true,
      events: body.events ?? [],
      has_url: !!body.url,
      has_secret: !!body.secret,
      has_smtp_config: !!body.smtp_config,
      created_by: 'usr-demo-owner-001',
      created_at: now(),
      updated_at: now(),
    }

    demoState.notificationChannels.push(channel)
    return HttpResponse.json({ channel }, { status: 201 })
  }),

  http.get('/v1/settings/notification-channels/:id', async ({ params }) => {
    await delay(150)
    const channel = demoState.notificationChannels.find(
      (c) => c.id === params.id,
    )
    if (!channel) {
      return HttpResponse.json(
        { error: 'not_found', message: 'Channel not found' },
        { status: 404 },
      )
    }
    return HttpResponse.json({ channel })
  }),

  http.put(
    '/v1/settings/notification-channels/:id',
    async ({ params, request }) => {
      await delay(300)
      const forbidden = requireDemoInstancePermission(
        request,
        'instance_settings:write',
      )
      if (forbidden) return forbidden
      const idx = demoState.notificationChannels.findIndex(
        (c) => c.id === params.id,
      )
      if (idx === -1) {
        return HttpResponse.json(
          { error: 'not_found', message: 'Channel not found' },
          { status: 404 },
        )
      }
      const body = updateChannelSchema.parse(await request.json())
      const existing = demoState.notificationChannels[idx]

      const updated: NotificationChannel = {
        ...existing,
        name: body.name ?? existing.name,
        enabled: body.enabled ?? existing.enabled,
        events: body.events ?? existing.events,
        has_url: body.url ? true : existing.has_url,
        has_secret: body.secret ? true : existing.has_secret,
        has_smtp_config: body.smtp_config ? true : existing.has_smtp_config,
        updated_at: now(),
      }

      demoState.notificationChannels[idx] = updated
      return HttpResponse.json({ channel: updated })
    },
  ),

  http.delete(
    '/v1/settings/notification-channels/:id',
    async ({ params, request }) => {
      await delay(300)
      const forbidden = requireDemoInstancePermission(
        request,
        'instance_settings:write',
      )
      if (forbidden) return forbidden
      const idx = demoState.notificationChannels.findIndex(
        (c) => c.id === params.id,
      )
      if (idx === -1) {
        return HttpResponse.json(
          { error: 'not_found', message: 'Channel not found' },
          { status: 404 },
        )
      }
      demoState.notificationChannels.splice(idx, 1)
      demoState.notificationDeliveries =
        demoState.notificationDeliveries.filter(
          (delivery) => delivery.channel_id !== params.id,
        )
      return HttpResponse.json({ deleted: true })
    },
  ),

  http.post(
    '/v1/settings/notification-channels/:id/test',
    async ({ params, request }) => {
      await delay(500)
      const forbidden = requireDemoInstancePermission(
        request,
        'instance_settings:write',
      )
      if (forbidden) return forbidden
      const channel = demoState.notificationChannels.find(
        (c) => c.id === params.id,
      )
      if (!channel) {
        return HttpResponse.json(
          { error: 'not_found', message: 'Channel not found' },
          { status: 404 },
        )
      }
      return HttpResponse.json({ success: true })
    },
  ),

  http.get(
    '/v1/settings/notification-channels/:id/deliveries',
    async ({ params }) => {
      await delay(150)
      const channelDeliveries = demoState.notificationDeliveries.filter(
        (d) => d.channel_id === params.id,
      )
      return HttpResponse.json({
        deliveries: channelDeliveries,
        total: channelDeliveries.length,
      })
    },
  ),
]
