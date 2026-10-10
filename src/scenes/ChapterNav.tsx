import { useEffect, useState } from 'react'
import './ChapterNav.css'

const CHAPTERS = [
  { id: 'chapter-1', label: '01 Prediction' },
  { id: 'chapter-2', label: '02 Training context' },
  { id: 'chapter-3', label: '03 Feature attribution' },
  { id: 'chapter-4', label: '04 Thresholding' },
  { id: 'chapter-5', label: '05 Calibration' },
  { id: 'chapter-6', label: '06 Verdict' },
]

const ACTIVE_LINE_PX = 160 // distance from the top of the viewport that counts as "current"

/** Fixed chapter rail. Native anchor links (`<a href="#chapter-N">`), keyboard-operable
 * by default; the browser's own hash-scroll honors `prefers-reduced-motion` via the
 * `scroll-behavior: auto` override in index.css, no custom scroll-animation JS needed.
 *
 * Active-chapter tracking is a scroll listener, not IntersectionObserver: an earlier
 * version picked the intersecting entry with the smallest `boundingClientRect.top`,
 * which is wrong once a chapter scrolls mostly off-screen above the viewport -- its top
 * becomes a large NEGATIVE number, smaller than a chapter actually near the top edge,
 * so the nav stuck on the chapter the user had already scrolled past. Caught by an e2e
 * test that scrolled through all 6 chapters and asserted each became active in turn.
 * Classic scrollspy logic (last chapter whose top has crossed the active line) has no
 * such ambiguity. */
export default function ChapterNav() {
  const [activeId, setActiveId] = useState('chapter-1')

  useEffect(() => {
    const elements = CHAPTERS.map((c) => document.getElementById(c.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (elements.length === 0) return

    let ticking = false
    const update = () => {
      ticking = false
      // At the bottom of the page there may not be enough scrollable distance left to
      // bring the final chapter(s) up to the active line (nothing further down to
      // scroll past), so a chapter near the end could never register as "current" by
      // the line-crossing rule alone. Standard scrollspy fix: pin to the last chapter
      // once the page is scrolled to its end.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) {
        setActiveId(elements[elements.length - 1].id)
        return
      }
      let current = elements[0].id
      for (const el of elements) {
        if (el.getBoundingClientRect().top <= ACTIVE_LINE_PX) current = el.id
      }
      setActiveId(current)
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

  return (
    <nav className="chapter-nav" aria-label="Chapters">
      <ul>
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`} aria-current={activeId === c.id ? 'true' : undefined}>
              {c.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
