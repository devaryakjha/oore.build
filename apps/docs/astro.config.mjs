// @ts-check
import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { remarkHeading, remarkStructure } from 'fumadocs-core/mdx-plugins'

import { rehypeThemeImages } from './src/lib/rehype-theme-images'

const remarkPlugins =
  /** @type {import('@astrojs/markdown-remark').RemarkPlugins} */ ([
    remarkHeading,
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
    processor: unified({
      remarkPlugins,
      rehypePlugins: [rehypeThemeImages],
    }),
  },
  integrations: [
    react(),
    mdx({
      extendMarkdownConfig: true,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
