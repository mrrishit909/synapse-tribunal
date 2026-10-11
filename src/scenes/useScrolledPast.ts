import { useEffect, useState } from 'react'

/** True once the element with `id` has scrolled entirely above the viewport. Same
 * rAF-throttled scroll-listener pattern as ChapterNav's scrollspy. */
export function useScrolledPast(id: string): boolean {
  const [past, setPast] = useState(false)

  useEffect(() => {
    let ticking = false
    const update = () => {
      ticking = false
      const el = document.getElementById(id)
      setPast(!!el && el.getBoundingClientRect().bottom < 0)
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
  }, [id])

  return past
}
