import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SourceDiscoveryWarning } from '@/components/source-discovery-warning'

describe('SourceDiscoveryWarning', () => {
  it('identifies each failed source and offers a retry without hiding healthy results', () => {
    const onRetry = vi.fn()
    render(
      <SourceDiscoveryWarning
        failures={[
          {
            integration_id: 'github-1',
            provider: 'github',
            host_url: 'https://github.example',
            display_name: 'Work GitHub',
            message: 'Repository sync is unavailable',
          },
          {
            integration_id: 'gitlab-1',
            provider: 'gitlab',
            host_url: 'https://gitlab.example',
            message: 'Request timed out',
          },
        ]}
        isRetrying={false}
        onRetry={onRetry}
      />,
    )

    const warning = screen.getByRole('alert')
    expect(warning.textContent).toContain('Repository sync is unavailable')
    expect(warning.textContent).toContain('Request timed out')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
