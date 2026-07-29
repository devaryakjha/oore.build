import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BootstrapTokenStep } from './index.lazy'

const { navigate, verifyMutation } = vi.hoisted(() => ({
  navigate: vi.fn(),
  verifyMutation: {
    mutate: vi.fn(),
    error: null,
    isPending: false,
  },
}))

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (options: unknown) => options,
  useNavigate: () => navigate,
}))

vi.mock('@/hooks/use-setup', () => ({
  useSetupStatus: () => ({ data: undefined }),
  useVerifyBootstrapToken: () => verifyMutation,
}))

vi.mock('@/hooks/use-setup-route-transitions', () => ({
  useBootstrapStepTransition: vi.fn(),
}))

describe('BootstrapTokenStep', () => {
  beforeEach(() => {
    navigate.mockReset()
    verifyMutation.mutate.mockReset()
  })

  it('keeps required validation hidden until an explicit submit', async () => {
    render(<BootstrapTokenStep />)

    const token = screen.getByLabelText('Token')
    fireEvent.focus(token)
    fireEvent.blur(token)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(token.getAttribute('aria-invalid')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Verify token' }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(token.getAttribute('aria-invalid')).toBe('true')
    expect(verifyMutation.mutate).not.toHaveBeenCalled()
  })
})
