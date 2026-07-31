import {
  ClientOnly,
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'

import StaticSearchDialog from '@/components/search'
import appCss from '@/styles.css?url'
import type { SharedProps } from 'fumadocs-ui/components/dialog/search'

const defaultDescription =
  'Documentation for installing, operating, and integrating Oore CI.'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: 'Oore CI docs' },
      { name: 'description', content: defaultDescription },
      { property: 'og:site_name', content: 'Oore CI docs' },
      { property: 'og:type', content: 'website' },
      {
        property: 'og:image',
        content: 'https://docs.oore.build/og-image.png',
      },
      { name: 'twitter:card', content: 'summary_large_image' },
      {
        name: 'twitter:image',
        content: 'https://docs.oore.build/og-image.png',
      },
      { name: 'theme-color', content: '#92400e' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
      { rel: 'alternate icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ SearchDialog: ClientSearchDialog }}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  )
}

function ClientSearchDialog(props: SharedProps) {
  return (
    <ClientOnly>
      <StaticSearchDialog {...props} />
    </ClientOnly>
  )
}
