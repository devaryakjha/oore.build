import { useEffect, useState } from 'react'

function useObjectUrl(input?: Blob | MediaSource) {
  const [url, setUrl] = useState<string | undefined>()

  useEffect(() => {
    const nextUrl = input ? URL.createObjectURL(input) : undefined

    setUrl(nextUrl)

    return () => {
      if (!nextUrl) return
      return URL.revokeObjectURL(nextUrl)
    }
  }, [input])

  return url
}

export { useObjectUrl }
