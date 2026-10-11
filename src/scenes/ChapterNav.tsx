import { useEffect, useState } from 'react'
import './ChapterNav.css'

// `short` must be a case-insensitive substring of `name`: the tablet tab bar shows
// `num + short` while each link's aria-label is `num + name`, and WCAG 2.5.3 (label in
// name) requires the accessible name to contain the visible text.
const CHAPTERS = [
  { id: 'chapter-1', num: '01', name: 'Prediction', short: 'Prediction' },
  { id: 'chapter-2', num: '02', name: 'Training context', short: 'Training' },
  { id: 'chapter-3', num: '03', name: 'Feature attribution', short: 'Attribution' },
  { id: 'chapter-4', num: '04', name: 'Thresholding', short: 'Threshold' },
  { id: 'chapter-5', num: '05', name: 'Calibration', short: 'Calibration' },
  { id: 'chapter-6', num: '06', name: 'Verdict', short: 'Verdict' },
]

const ACTIVE_LINE_PX = 160 // distance from the top of the viewport that counts as "current"

/** Chapter navigation, three deliberate compositions (see ChapterNav.css): a side rail
 * on wide desktop, a sticky top tab bar on tablet/laptop, a fixed bottom tab bar on
 * mobile. Native anchor links, keyboard-operable by default; the browser's own hash
 * scroll honors `prefers-reduced-motion` via index.css, no custom scroll JS.
 *
 * Active-chapter tracking is a scroll listener, not IntersectionObserver: an earlier
 * version picked the intersecting entry with the smallest `boundingClientRect.top`, which
 * is wrong once a chapter scrolls mostly off-screen above the viewport (its top becomes a
 * large negative number). Classic scrollspy logic (last chapter whose top has crossed an
 * active line) has no such ambiguity. */
export default function ChapterNav({ inert = false }: { inert?: boolean }) {
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
      // bring the final chapter(s) up to the active line, so pin to the last chapter
      // once the page is scrolled to its end (standard scrollspy fix).
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
    <nav className="chapter-nav" aria-label="Chapters" inert={inert}>
      <ul>
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              aria-label={`${c.num} ${c.name}`}
              aria-current={activeId === c.id ? 'true' : undefined}
            >
              {/* A real space, not margin: the visible text then reads "01 Prediction",
                  matching the aria-label (WCAG 2.5.3 label in name). */}
              <span className="nav-num">{c.num}</span>{' '}
              <span className="nav-name">{c.name}</span>
              <span className="nav-short">{c.short}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
