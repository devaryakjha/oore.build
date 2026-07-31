import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

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
    githubUrl: 'https://github.com/oore-ci/oore.build',
    themeSwitch: {
      mode: 'light-dark-system',
    },
  }
}
