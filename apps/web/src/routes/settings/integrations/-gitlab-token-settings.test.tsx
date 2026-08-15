import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GitLabTokenSettingsView } from './-gitlab-token-settings'

const refetch = vi.fn(async () => ({ data: undefined, error: null }))
const replace = vi.fn()

const statusQuery = {
  data: {
    status: 'expired' as const,
    expires_at: 1_786_665_600,
    checked_at: 1_786_752_000,
  },
  error: null,
  isFetching: false,
  isLoading: false,
  refetch,
}

const replaceMutation = { isPending: false, mutate: replace }

function renderSettings() {
  return render(
    <GitLabTokenSettingsView
      canWrite
      replaceMutation={replaceMutation}
      statusQuery={statusQuery}
    />,
  )
}

describe('GitLabTokenSettings', () => {
  beforeEach(() => {
    refetch.mockReset()
    replace.mockReset()
  })

  it('shows the saved token status and expiry', () => {
    renderSettings()

    expect(screen.getByText('Expired')).toBeTruthy()
    expect(screen.getByText('Check again')).toBeTruthy()
    expect(screen.getByText('Replace access token')).toBeTruthy()
  })

  it('submits a replacement without disconnecting the source', async () => {
    renderSettings()

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
