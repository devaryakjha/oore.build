import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GitLabTokenSettings } from './-gitlab-token-settings'

const refetch = vi.fn()
const replace = vi.fn()

vi.mock('@/hooks/use-integrations', () => ({
  useGitLabTokenStatus: () => ({
    data: {
      status: 'expired',
      expires_at: 1_786_665_600,
      checked_at: 1_786_752_000,
    },
    error: null,
    isFetching: false,
    isLoading: false,
    refetch,
  }),
  useReplaceGitLabToken: () => ({
    isPending: false,
    mutate: replace,
  }),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('GitLabTokenSettings', () => {
  beforeEach(() => {
    refetch.mockReset()
    replace.mockReset()
  })

  it('shows the saved token status and expiry', () => {
    render(<GitLabTokenSettings canWrite integrationId="gitlab-source" />)

    expect(screen.getByText('Expired')).toBeTruthy()
    expect(screen.getByText('Check again')).toBeTruthy()
    expect(screen.getByText('Replace access token')).toBeTruthy()
  })

  it('submits a replacement without disconnecting the source', async () => {
    render(<GitLabTokenSettings canWrite integrationId="gitlab-source" />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Replace access token' }),
    )
    fireEvent.change(screen.getByLabelText('New access token'), {
      target: { value: 'glpat-new-token' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Replace token' }))

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        { access_token: 'glpat-new-token' },
        expect.any(Object),
      )
    })
  })
})
