import { useEffect, useState } from 'react'

/** Normalized 0-1 scroll progress across the full scrollable document height. Drives the
 * WebGL camera's position so "where you are in the story" and "what the camera shows"
 * stay locked together -- a single rAF-throttled scroll listener, the same pattern
 * ChapterNav's scrollspy uses, not a second competing scroll-tracking mechanism. */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let ticking = false
    const update = () => {
      ticking = false
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0)
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return progress
}
