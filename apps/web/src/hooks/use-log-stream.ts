import { useEffect, useEffectEvent, useReducer, useRef } from 'react'
import { streamBuildLogEvents, type BuildLogEvent } from '@oore/client/logs'
import type { OoreClient } from '@oore/client/client'
import type { BuildLogChunk } from '@oore/client/models'
import { getBuildLogs } from '@oore/client/operations'

import {
  createLogFrameBatcher,
  mergeBuildLogChunks,
} from '@/lib/log-stream-utils'
import { useApiContext } from '@/hooks/use-api-context'
import { createWebOoreClient } from '@/lib/api-client/client'

interface UseLogStreamResult {
  logs: Array<BuildLogChunk>
  isStreaming: boolean
  isDone: boolean
}

interface UseLogStreamOptions {
  onDone?: () => void
}

const POLL_INTERVAL_MS = 2500
const POLL_BACKFILL_WINDOW = 500

async function consumeBuildLogEvents({
  buildId,
  client,
  onEvent,
  signal,
}: {
  buildId: string
  client: OoreClient
  onEvent: (event: BuildLogEvent) => boolean
  signal: AbortSignal
}) {
  for await (const event of streamBuildLogEvents({
    client,
    path: { build_id: buildId },
    signal,
  })) {
    if (!onEvent(event)) break
  }
}

type StreamAction = Partial<UseLogStreamResult> | 'reset'

const initialStreamState: UseLogStreamResult = {
  logs: [],
  isStreaming: false,
  isDone: false,
}

function streamReducer(
  state: UseLogStreamResult,
  action: StreamAction,
): UseLogStreamResult {
  return action === 'reset' ? initialStreamState : { ...state, ...action }
}

export function useLogStream(
  buildId: string,
  enabled: boolean,
  options?: UseLogStreamOptions,
): UseLogStreamResult {
  const onDone = useEffectEvent(() => options?.onDone?.())
  const [stream, updateStream] = useReducer(streamReducer, initialStreamState)
  const { baseUrl, token } = useApiContext()
  const logsBySequenceRef = useRef<Map<number, BuildLogChunk>>(new Map())
  const orderedLogsRef = useRef<Array<BuildLogChunk>>([])
  const lastSequenceRef = useRef(-1)

  useEffect(() => {
    if (!enabled || !baseUrl || !token) {
      updateStream({ isStreaming: false })
      return
    }

    const client = createWebOoreClient({ baseUrl, token })
    const abort = new AbortController()
    let pollingTimer: ReturnType<typeof setInterval> | undefined

    function appendLogs(chunks: Array<BuildLogChunk>) {
      if (chunks.length === 0) return

      const merged = mergeBuildLogChunks(
        orderedLogsRef.current,
        logsBySequenceRef.current,
        chunks,
      )
      if (!merged.changed) return

      orderedLogsRef.current = merged.logs
      lastSequenceRef.current = merged.lastSequence
      updateStream({ logs: merged.logs })
    }

    async function pollOnce() {
      const after = Math.max(-1, lastSequenceRef.current - POLL_BACKFILL_WINDOW)
      try {
        const response = await getBuildLogs({
          client,
          path: { build_id: buildId },
          query: { after_sequence: after >= 0 ? after : undefined },
          signal: abort.signal,
        })
        appendLogs(response.logs)
      } catch {
        // Retry on the next interval.
      }
    }

    function startPolling() {
      if (pollingTimer) return
      void pollOnce()
      pollingTimer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS)
    }

    function stopPolling() {
      if (!pollingTimer) return
      clearInterval(pollingTimer)
      pollingTimer = undefined
    }

    updateStream('reset')
    logsBySequenceRef.current = new Map()
    orderedLogsRef.current = []
    lastSequenceRef.current = -1

    const logBatcher = createLogFrameBatcher(appendLogs)
    let streamDone = false
    startPolling()

    void (async () => {
      try {
        await consumeBuildLogEvents({
          buildId,
          client,
          signal: abort.signal,
          onEvent: (event) => {
            stopPolling()
            updateStream({ isStreaming: true })

            if (event.type === 'log') {
              logBatcher.enqueue(event.chunk)
            } else if (event.type === 'done') {
              streamDone = true
              logBatcher.flush()
              updateStream({ isStreaming: false, isDone: true })
              void pollOnce()
              onDone()
              return false
            }
            return true
          },
        })
        if (streamDone) return
      } catch {
        // Polling is the supported fallback when SSE is unavailable.
      }

      if (!abort.signal.aborted) {
        updateStream({ isStreaming: false })
        startPolling()
      }
    })()

    return () => {
      abort.abort()
      logBatcher.cancel()
      stopPolling()
    }
  }, [enabled, baseUrl, token, buildId])

  return stream
}
