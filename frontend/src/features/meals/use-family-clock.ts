import { useEffect, useState } from 'react'
// Refresh on exact minute boundaries and on return from a suspended/background tab.
export function useFamilyClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(new Date())
      clearTimeout(timer)
      timer = setTimeout(tick, 60000 - (Date.now() % 60000))
    }
    tick()
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return now
}
