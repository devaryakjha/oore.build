import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import TerminalLogViewer from '@/components/terminal-log-viewer'
import {
  defaultSelectedStep,
  groupLogs,
  isErrorLine,
} from '@/components/terminal-log-viewer/log-model'

describe('TerminalLogViewer', () => {
  it('groups marker-delimited logs while step results remain status truth', () => {
    const grouped = groupLogs(
      [
        {
          sequence: 1,
          content:
            '[oore-step] {"event":"start","name":"Build","command":"bun run build"}',
          stream: 'stdout',
        },
        { sequence: 2, content: 'Compiling', stream: 'stdout' },
        {
          sequence: 3,
          content:
            '[oore-step] {"event":"end","name":"Build","status":"succeeded"}',
          stream: 'stdout',
        },
      ],
      [
        {
          name: 'Build',
          status: 'failed',
          started_at: 1,
          finished_at: 2,
          duration_ms: 1000,
        },
      ],
    )

    expect(grouped.allVisibleLogs.map((log) => log.content)).toEqual([
      'Compiling',
    ])
    expect(grouped.stepGroups[0]).toMatchObject({
      name: 'Build',
      status: 'failed',
      command: 'bun run build',
      durationMs: 1000,
      logs: [{ sequence: 2, content: 'Compiling', stream: 'stdout' }],
    })
  })

  it('shows all logs when completed steps have no log markers', async () => {
    await act(async () => {
      render(
        <TerminalLogViewer
          logs={[{ sequence: 1, content: 'Build output', stream: 'stdout' }]}
          stepResults={[
            {
              name: 'Build Android',
              status: 'succeeded',
              started_at: 1,
              finished_at: 2,
              duration_ms: 1000,
            },
          ]}
          isStreaming={false}
          isTerminal
        />,
      )
      await Promise.resolve()
    })

    expect(screen.queryByRole('combobox', { name: 'Build step' })).toBeNull()
    expect(
      screen.getByRole('region', { name: 'Build log output' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Download raw logs' }),
    ).toBeTruthy()
  })

  it('opens the complete log for a finished successful build', () => {
    expect(
      defaultSelectedStep(
        [
          {
            name: 'Checkout',
            status: 'succeeded',
            logs: [{ sequence: 1, content: 'Cloning', stream: 'stderr' }],
          },
          {
            name: 'Build Android',
            status: 'succeeded',
            logs: [{ sequence: 2, content: 'Assembling', stream: 'stdout' }],
          },
        ],
        null,
      ),
    ).toBe('all')
  })

  it('does not treat stderr transport as error severity', () => {
    expect(isErrorLine('Receiving objects: 100% (25/25)')).toBe(false)
    expect(isErrorLine('fatal: repository could not be cloned')).toBe(true)
    expect(isErrorLine('$ flutter analyze --no-fatal-infos')).toBe(false)
  })

  it('reports terminal log loading as a busy status', () => {
    render(
      <TerminalLogViewer
        logs={[]}
        stepResults={[]}
        isStreaming={false}
        isLoading
        isTerminal
      />,
    )

    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true')
  })
})
