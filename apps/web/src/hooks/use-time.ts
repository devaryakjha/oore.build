import { useEffect, useState } from 'react'

function useTime() {
  const [time, setTime] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      setTime(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return time
}

export { useTime }
