import { useMutation } from '@tanstack/react-query'

import type { GitHubAppStartRequest } from '@oore/client/models'
import {
  githubStart as githubAppStart,
  setupOidcStart,
} from '@oore/client/operations'
import { resolveRequiredInstanceApiBaseUrl } from '@/lib/instance-url'
import { createWebOoreClient } from '@/lib/api-client/client'
import { useActiveInstance } from '@/stores/instance-store'
import { useApiContext } from '@/hooks/use-api-context'

export function usePreviewGitHubAppSetup() {
  const { baseUrl, client, token } = useApiContext()

  return useMutation({
    mutationFn: (data: GitHubAppStartRequest) => {
      if (!baseUrl || !token) {
        return Promise.reject(new Error('Not authenticated'))
      }
      return githubAppStart({ body: data, client })
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
    }) => {
      const client = createWebOoreClient({
        baseUrl: resolveRequiredInstanceApiBaseUrl(instance),
        token: sessionToken,
      })
      return setupOidcStart({ body: { redirect_uri: redirectUri }, client })
    },
  })
}
