import { useMutation } from '@tanstack/react-query'

import type { GitHubAppStartRequest } from '@/api/types'
import { githubStart as githubAppStart } from '@/api/integrations'
import { setupOidcStart } from '@/api/setup'
import { resolveRequiredInstanceApiBaseUrl } from '@/lib/instance-url'
import { useActiveInstance } from '@/stores/instance-store'
import { useApiContext } from '@/hooks/use-api-context'

export function usePreviewGitHubAppSetup() {
  const { baseUrl, token } = useApiContext()

  return useMutation({
    mutationFn: (data: GitHubAppStartRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return githubAppStart(data, { baseUrl, token })
    },
  })
}

export function useSetupOidcVerificationStart() {
  const instance = useActiveInstance()

  return useMutation({
    mutationFn: ({
      sessionToken,
      redirectUri,
    }: {
      sessionToken: string
      redirectUri: string
    }) =>
      setupOidcStart(
        { redirect_uri: redirectUri },
        {
          baseUrl: resolveRequiredInstanceApiBaseUrl(instance),
          token: sessionToken,
        },
      ),
  })
}
