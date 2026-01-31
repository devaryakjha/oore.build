// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://oore.build',
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    starlight({
      title: 'Oore',
      expressiveCode: {
        shiki: {
          // Map HUML to YAML for syntax highlighting (similar enough)
          langAlias: { huml: 'yaml' },
        },
      },
      description: 'Self-hosted CI/CD for Flutter apps on your own Mac hardware',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/starlight.css'],
      social: {
        github: 'https://github.com/devaryakjha/oore.build',
      },
      editLink: {
        baseUrl: 'https://github.com/devaryakjha/oore.build/edit/master/site/',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'docs/introduction' },
            { label: 'Quick Start', slug: 'docs/quickstart' },
            { label: 'Architecture', slug: 'docs/architecture' },
            { label: 'Roadmap', slug: 'docs/roadmap' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'Environment Variables', slug: 'docs/configuration' },
            { label: 'Pipeline Configuration', slug: 'docs/guides/pipelines' },
            { label: 'Service Management', slug: 'docs/guides/service-management' },
            { label: 'Troubleshooting', slug: 'docs/guides/troubleshooting' },
          ],
        },
        {
          label: 'Integrations',
          items: [
            { label: 'GitHub', slug: 'docs/integrations/github' },
            { label: 'GitLab', slug: 'docs/integrations/gitlab' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'API', slug: 'docs/reference/api' },
          ],
        },
        {
          label: 'Development',
          items: [
            { label: 'Contributing', slug: 'docs/guides/contributing' },
            { label: 'Demo Mode', slug: 'docs/guides/demo-mode' },
          ],
        },
      ],
      head: [
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://oore.build/og-image.png',
          },
        },
      ],
    }),
  ],
});
