import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RuntimeOverview } from './preferences-runtime-overview'

describe('Preferences deferred surfaces', () => {
  it('keeps a supervised backend update failure visible with its log path', () => {
    render(
      <RuntimeOverview
        backendUpdatePhase="failed"
        backendVersionLabel="1.2.3-alpha.1"
        frontendUpdatePhase="idle"
        isOwner
        runtimeUpdates={
          {
            backendHealth: { data: { channel: 'alpha' } },
            backendRelease: {
              data: {
                latest_version: '1.2.3-alpha.2',
                update_available: true,
              },
            },
            backendUpdate: {
              data: {
                error: 'Candidate readiness check failed; rollback completed.',
                managed_service: true,
                phase: 'failed',
              },
            },
            frontendRelease: { data: undefined },
            startBackendUpdate: {
              isPending: false,
              mutate: vi.fn(),
            },
            frontendHealth: { data: { channel: 'alpha' } },
          } as never
        }
        webVersionLabel="1.2.3-alpha.1"
      />,
    )

    const failure = screen.getByRole('alert')
    expect(failure.textContent).toContain(
      'Candidate readiness check failed; rollback completed.',
    )
    expect(failure.textContent).toContain(
      '<install root>/logs/update-supervisor.log',
    )
    expect(
      screen
        .getByRole('button', { name: 'Retry backend update' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })

  it('keeps unmanaged backends out of the in-app update path', () => {
    render(
      <RuntimeOverview
        backendUpdatePhase="idle"
        backendVersionLabel="1.2.3-alpha.1"
        frontendUpdatePhase="idle"
        isOwner
        runtimeUpdates={
          {
            backendHealth: { data: { channel: 'alpha' } },
            backendRelease: {
              data: {
                channel: 'alpha',
                latest_version: '1.2.3-alpha.2',
                update_available: true,
              },
            },
            backendUpdate: {
              data: {
                managed_service: false,
                phase: 'idle',
              },
            },
            frontendRelease: { data: undefined },
            startBackendUpdate: {
              isPending: false,
              mutate: vi.fn(),
            },
            frontendHealth: { data: { channel: 'alpha' } },
          } as never
        }
        webVersionLabel="1.2.3-alpha.1"
      />,
    )

    const updateAction = screen.getByRole('button', {
      name: 'Update backend',
    })
    expect(updateAction.hasAttribute('disabled')).toBe(true)
  })
})
