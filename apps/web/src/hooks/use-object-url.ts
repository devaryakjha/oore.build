import { useEffect, useRef, useState } from 'react'

function useObjectUrl(input?: Blob | MediaSource) {
  const ref = useRef(input)
  const [url, setUrl] = useState<string | undefined>()

  useEffect(() => {
    ref.current = input

    const nextUrl = ref.current ? URL.createObjectURL(ref.current) : undefined

    setUrl(nextUrl)

    return () => {
      if (!nextUrl) return
      return URL.revokeObjectURL(nextUrl)
    }
  }, [input])

  return url
}

export { useObjectUrl }
