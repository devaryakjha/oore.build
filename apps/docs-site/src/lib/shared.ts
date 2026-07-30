export const siteUrl = 'https://docs.oore.build'

export function canonicalUrl(slugs: string[]) {
  const pathname = slugs.length === 0 ? '/' : `/${slugs.join('/')}`
  return new URL(pathname, siteUrl).toString()
}
