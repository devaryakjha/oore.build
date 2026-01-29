import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.oore.build',
  integrations: [
    starlight({
      title: 'Oore',
      description: 'Self-hosted CI/CD for Flutter apps on your own Mac hardware',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/custom.css'],
      social: {
        github: 'https://github.com/devaryakjha/oore.build',
      },
      editLink: {
        baseUrl: 'https://github.com/devaryakjha/oore.build/edit/master/docs/',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'introduction' },
            { label: 'Quick Start', slug: 'quickstart' },
            { label: 'Architecture', slug: 'architecture' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'Environment Variables', slug: 'configuration' },
            { label: 'Pipeline Configuration', slug: 'guides/pipelines' },
            { label: 'Service Management', slug: 'guides/service-management' },
          ],
        },
        {
          label: 'Integrations',
          items: [
            { label: 'GitHub', slug: 'integrations/github' },
            { label: 'GitLab', slug: 'integrations/gitlab' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'CLI', slug: 'reference/cli' },
            { label: 'API', slug: 'reference/api' },
          ],
        },
        {
          label: 'Development',
          items: [
            { label: 'Demo Mode', slug: 'guides/demo-mode' },
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
