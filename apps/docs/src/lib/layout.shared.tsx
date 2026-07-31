import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

const navigationLinks: NonNullable<BaseLayoutProps['links']> = [
  {
    text: 'Get started',
    url: '/getting-started/',
    active: 'nested-url',
  },
  {
    text: 'Guides',
    url: '/guides/',
    active: 'nested-url',
  },
  {
    text: 'Reference',
    url: '/reference/',
    active: 'nested-url',
  },
  {
    text: 'Operations',
    url: '/operations/',
    active: 'nested-url',
  },
]

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="size-6" />
          <span>Oore CI</span>
        </span>
      ),
      url: '/',
    },
    links: navigationLinks,
    githubUrl: 'https://github.com/oore-ci/oore.build',
  }
}
