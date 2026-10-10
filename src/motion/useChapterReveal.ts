import { useEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/** Scroll-driven entrance for each `.chapter` section inside `containerRef`: fades/slides
 * up on entering the viewport, reverses on scrolling back past it (toggleActions
 * play/reverse/play/reverse), so the choreography is reversible and interruptible per
 * MOTION_REQUIREMENTS.md rather than a one-shot mount animation. Reduced motion renders
 * every chapter at its final state and registers no ScrollTriggers at all -- nothing to
 * cancel or reverse because nothing animates. */
export function useChapterReveal(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return
    const sections = containerRef.current.querySelectorAll<HTMLElement>('.chapter')
    const triggers = Array.from(sections).map((section) =>
      gsap.fromTo(
        section,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 88%',
            // onEnter: play. onLeave (scrolled past, still going down): stay visible --
            // this is a long-form reading page, not pinned scenes, so content the user
            // already read must not fade back out just because they kept scrolling.
            // onEnterBack: stay visible. onLeaveBack (scrolled back up above the start):
            // reverse -- this is the actual reversible/interruptible behavior
            // MOTION_REQUIREMENTS asks for, scroll back up and the chapter you haven't
            // reached yet fades back out, rather than every direction toggling it.
            toggleActions: 'play none none reverse',
          },
        },
      ),
    )
    return () => {
      triggers.forEach((t) => t.scrollTrigger?.kill())
      triggers.forEach((t) => t.kill())
    }
  }, [containerRef, active])
}
