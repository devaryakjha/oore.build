import { useEffect, useState, type ComponentProps } from 'react'
import { cloudflareImageSrcset } from '../../../../shared/media/cloudflare-images'

function darkImagePath(path: string) {
  return path.replace(/(\.[^./]+)$/, '-dark$1')
}

export function ThemeImage({ alt, src, ...props }: ComponentProps<'img'>) {
  const [dark, setDark] = useState(false)
  const lightSrc = typeof src === 'string' ? src : undefined
  const darkSrc = lightSrc ? darkImagePath(lightSrc) : undefined

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setDark(root.classList.contains('dark'))
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributeFilter: ['class'], attributes: true })
    sync()
    return () => observer.disconnect()
  }, [])

  if (!lightSrc || !darkSrc) return <img src={src} alt={alt} {...props} />

  const selectedSrc = dark ? darkSrc : lightSrc
  const srcSet = cloudflareImageSrcset(selectedSrc)

  return (
    <picture>
      {srcSet ? <source srcSet={srcSet} sizes="100vw" /> : null}
      <img
        {...props}
        src={selectedSrc}
        alt={alt}
        width={1440}
        height={900}
        decoding="async"
        loading="lazy"
        onError={(event) => {
          const image = event.currentTarget
          if (!image.currentSrc.includes('/cdn-cgi/image/')) return
          image.parentElement?.querySelector('source')?.remove()
          image.src = selectedSrc
        }}
      />
    </picture>
  )
}
