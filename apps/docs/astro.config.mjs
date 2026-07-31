// @ts-check
import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import {
  rehypeCode,
  remarkAdmonition,
  remarkCodeTab,
  remarkHeading,
  remarkNpm,
  remarkStructure,
} from 'fumadocs-core/mdx-plugins'

import { rehypeThemeImages } from './src/lib/rehype-theme-images'

const remarkPlugins =
  /** @type {import('@astrojs/markdown-remark').RemarkPlugins} */ ([
    remarkAdmonition,
    remarkHeading,
    remarkCodeTab,
    remarkNpm,
    [remarkStructure, { exportAs: 'structuredData' }],
  ])

export default defineConfig({
  site: 'https://docs.oore.build',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  markdown: {
    syntaxHighlight: false,
    processor: unified({
      remarkPlugins,
      rehypePlugins: [rehypeCode, rehypeThemeImages],
    }),
  },
  integrations: [
    react(),
    mdx({
      extendMarkdownConfig: true,
      syntaxHighlight: false,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
