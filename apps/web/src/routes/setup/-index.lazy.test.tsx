import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BootstrapTokenStepView } from './index.lazy'

const verifyBootstrapToken = vi.fn()

describe('BootstrapTokenStep', () => {
  beforeEach(() => {
    verifyBootstrapToken.mockReset()
  })

  it('keeps required validation hidden until an explicit submit', async () => {
    render(
      <BootstrapTokenStepView
        bootstrapTokenPrefill={null}
        onVerified={vi.fn()}
        sessionToken={null}
        verificationError={null}
        verificationPending={false}
        verifyBootstrapToken={verifyBootstrapToken}
      />,
    )

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
    expect(verifyBootstrapToken).not.toHaveBeenCalled()
  })
})
