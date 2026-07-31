import { loader } from 'fumadocs-core/source'
import { docs } from 'collections/server'

import { openapi } from '@/lib/openapi'

export const source = loader(
  {
    docs: docs.toFumadocsSource(),
    openapi: await openapi.staticSource({
      baseDir: 'openapi/operations',
    }),
  },
  {
    baseUrl: '/',
    plugins: [openapi.loaderPlugin()],
  },
)
