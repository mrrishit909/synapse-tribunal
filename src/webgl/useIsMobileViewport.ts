import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

/** Atlas stack requirement (PROJECT_03.md): "Mobile: touch-first bottom-sheet controls,
 * large targets, 2D fallback, no hover-only functionality." A real measured reason too:
 * the WebGL chunk (Three.js + R3F + Drei, ~900KB) pushed mobile Lighthouse Performance
 * to 60 (budget: >=80) with a 1.68s total blocking time on a throttled mobile CPU
 * profile -- see docs/PERFORMANCE_BUDGETS.md and verification/lighthouse-mobile.json.
 * Below this breakpoint, the WebGL chunk is never even requested (see WebGLStage's
 * caller in Tribunal.tsx), not merely hidden after loading. */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}
