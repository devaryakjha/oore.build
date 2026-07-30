export const CLOUDFLARE_IMAGE_WIDTHS = [720, 1200, 1440] as const

export function cloudflareImageUrl(path: string, width: number) {
  return `/cdn-cgi/image/width=${width},quality=90,format=auto${path}`
}

export function cloudflareImageSrcset(
  path: string,
  enabled = import.meta.env.PROD,
) {
  if (!enabled) return undefined

  return CLOUDFLARE_IMAGE_WIDTHS.map(
    (width) => `${cloudflareImageUrl(path, width)} ${width}w`,
  ).join(', ')
}
