import { HomeLayout } from 'fumadocs-ui/layouts/home'
import { DefaultNotFound } from 'fumadocs-ui/layouts/home/not-found'
import { RootProvider } from 'fumadocs-ui/provider/astro'
import { navigate } from 'astro:transitions/client'

import { baseOptions } from '@/lib/layout.shared'

export function NotFound({
  params,
  pathname,
}: {
  params: Record<string, string | undefined>
  pathname: string
}) {
  return (
    <RootProvider
      pathname={pathname}
      params={params}
      navigate={navigate}
      search={{ enabled: false }}
      theme={{
        defaultTheme: 'system',
        enableSystem: true,
        storageKey: 'oore-docs-theme',
      }}
    >
      <HomeLayout {...baseOptions()}>
        <DefaultNotFound />
      </HomeLayout>
    </RootProvider>
  )
}
