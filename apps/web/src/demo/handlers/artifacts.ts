import { demoApi } from './api'
import { HttpResponse, delay } from 'msw'
import * as z from 'zod'
import { ago } from '../seed'
import { demoState } from '../state'

export const artifactHandlers = [
  demoApi.generateDownloadLink(async () => {
    await delay(200)
    return HttpResponse.json({
      download_url: '#demo-download',
      expires_at: ago(-3600), // 1 hour from now
    })
  }),
  demoApi.createArtifactInstallLink(async ({ params }) => {
    await delay(200)
    const artifact = Object.values(demoState.artifacts)
      .flatMap((artifacts) => artifacts ?? [])
      .find((candidate) => candidate.id === params.artifact_id)
    const ios = artifact?.artifact_type === 'ipa'
    return HttpResponse.json({
      platform: ios ? 'ios' : 'android',
      install_url: ios
        ? 'itms-services://?action=download-manifest&url=https%3A%2F%2Fdemo.oore.build%2Fmanifest.plist'
        : '#demo-download',
      download_url: '#demo-download',
      manifest_url: ios ? 'https://demo.oore.build/manifest.plist' : undefined,
      expires_at: ago(-3600),
    })
  }),
  demoApi.createScopedDownloadToken(async ({ params, request }) => {
    await delay(200)
    const artifact = Object.values(demoState.artifacts)
      .flatMap((artifacts) => artifacts ?? [])
      .find((candidate) => candidate.id === params.artifact_id)
    if (!artifact) {
      return HttpResponse.json(
        { error: 'Artifact not found', code: 'not_found' },
        { status: 404 },
      )
    }
    const body = z
      .object({
        ttl_secs: z.number().optional(),
        single_use: z.boolean().optional(),
      })
      .parse(await request.json())
    const token = `demo_${crypto.randomUUID().replaceAll('-', '')}`
    return HttpResponse.json({
      id: `artifact-token-${crypto.randomUUID().slice(0, 8)}`,
      download_url: `/v1/artifacts/${artifact.id}/download?token=${token}`,
      token,
      prefix: token.slice(0, 12),
      expires_at: ago(-(body.ttl_secs ?? 86400)),
      single_use: body.single_use ?? false,
    })
  }),
]
