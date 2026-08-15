import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

import { DirectRunnerPolicyPanelView } from './direct-runner-policy-panel'

interface TestMocks {
  permissions: { read: boolean; write: boolean }
  preferencesQuery: {
    data?: {
      key_storage_mode: 'keychain'
      direct_macos_runner_paused: boolean
    }
    error: Error | null
    isLoading: boolean
    refetch: Mock<() => Promise<{ data?: never; error: Error | null }>>
  }
  updatePreferences: {
    isPending: boolean
    mutate: Mock<
      (
        data: {
          key_storage_mode: 'keychain' | 'file'
          direct_macos_runner_paused: boolean
        },
        options: { onError: (error: Error) => void; onSuccess: () => void },
      ) => void
    >
  }
}

const mocks = vi.hoisted<TestMocks>(() => ({
  permissions: {
    read: true,
    write: true,
  },
  preferencesQuery: {
    data: {
      key_storage_mode: 'keychain',
      direct_macos_runner_paused: true,
    },
    error: null,
    isLoading: false,
    refetch: vi.fn(async () => ({ data: undefined, error: null })),
  },
  updatePreferences: {
    isPending: false,
    mutate: vi.fn(),
  },
}))

function renderPanel() {
  return render(
    <DirectRunnerPolicyPanelView
      canRead={mocks.permissions.read}
      canWrite={mocks.permissions.write}
      preferencesQuery={mocks.preferencesQuery}
      updatePreferences={mocks.updatePreferences}
    />,
  )
}

describe('DirectRunnerPolicyPanel', () => {
  beforeEach(() => {
    mocks.permissions.read = true
    mocks.permissions.write = true
    mocks.preferencesQuery.data = {
      key_storage_mode: 'keychain' as const,
      direct_macos_runner_paused: true,
    }
    mocks.preferencesQuery.error = null
    mocks.preferencesQuery.isLoading = false
    mocks.preferencesQuery.refetch.mockReset()
    mocks.updatePreferences.isPending = false
    mocks.updatePreferences.mutate.mockReset()
  })

  it('omits the admin policy and preferences queries without instance settings access', () => {
    mocks.permissions.read = false
    mocks.permissions.write = false

    renderPanel()

    expect(screen.queryByLabelText('Direct runner policy')).toBeNull()
  })

  it('updates the instance-wide policy from the labeled Runners control', () => {
    renderPanel()

    fireEvent.click(
      screen.getByRole('switch', { name: 'Allow approved repositories' }),
    )

    expect(mocks.updatePreferences.mutate).toHaveBeenCalledWith(
      {
        key_storage_mode: 'keychain',
        direct_macos_runner_paused: false,
      },
      expect.any(Object),
    )
  })

  it('shows a retry path instead of a false disabled state when loading fails', () => {
    mocks.preferencesQuery.data = undefined
    mocks.preferencesQuery.error = new Error('service unavailable')

    renderPanel()

    expect(screen.queryByRole('switch')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.preferencesQuery.refetch).toHaveBeenCalledOnce()
  })
})
