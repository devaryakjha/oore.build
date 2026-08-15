import { defineConfig } from 'orval'

export default defineConfig({
  oore: {
    input: {
      target: '../docs/public/openapi.json',
      filters: {
        mode: 'include',
        tags: ['Projects', 'Project Members'],
      },
    },
    output: {
      client: 'fetch',
      mode: 'tags-split',
      target: './src/lib/api-client/generated/endpoints',
      schemas: './src/lib/api-client/generated/models',
      clean: true,
      formatter: 'oxfmt',
      namingConvention: 'kebab-case',
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: './src/lib/api-client/transport.ts',
          name: 'ooreRequest',
        },
      },
    },
  },
})
