'use client'

import { createOpenAPIPage } from 'fumadocs-openapi/ui'
import type { MediaAdapter } from 'fumadocs-openapi'

const gitBinaryMediaAdapter = {
  encode: ({ body }) => body as BodyInit,
  generateExample: () => undefined,
} satisfies MediaAdapter

export const OpenAPIPage = createOpenAPIPage({
  mediaAdapters: {
    'application/x-git-upload-pack-advertisement': gitBinaryMediaAdapter,
    'application/x-git-upload-pack-request': gitBinaryMediaAdapter,
    'application/x-git-upload-pack-result': gitBinaryMediaAdapter,
  },
})
