import { defineConfig } from 'orval'

export default defineConfig({
  oore: {
    input: {
      target: '../docs/public/openapi.json',
    },
    output: {
      client: 'fetch',
      mode: 'tags',
      target: './src/lib/api-client/generated/endpoints',
      indexFiles: true,
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
