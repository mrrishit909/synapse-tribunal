import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useReducedMotion } from '../motion/useReducedMotion'
import './IntroSequence.css'

const BEATS = [
  { label: 'Sealed dossier', body: 'A case file, closed.' },
  { label: 'Model vote', body: 'A classifier renders a verdict.' },
  { label: 'Evidence unfolds', body: 'Every feature that shaped it, laid open.' },
  { label: 'Confidence challenged', body: 'The inspector opens.' },
]

/**
 * 0-12s cinematic opening (PROJECT_03.md storyboard: 0-3s sealed dossier, 3-6s model
 * vote, 6-9s evidence unfolds, 9-12s confidence challenged/inspector opens). Hands off
 * into chapter 1 by fading out, per the Design Principles handoff rule ("the hero visual
 * must persist or morph into the functional scene, never disappear into an unrelated
 * UI") -- the same dossier typography and palette the intro uses IS chapter 1's own.
 * Reduced motion skips straight to the dismissed state (dossier contract requirement).
 */
export default function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const reducedMotion = useReducedMotion()
  const [dismissed, setDismissed] = useState(reducedMotion)
  const containerRef = useRef<HTMLDivElement>(null)
  const beatRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (reducedMotion) {
      onComplete()
      return
    }
  }, [reducedMotion, onComplete])

  useEffect(() => {
    if (reducedMotion || dismissed || !containerRef.current) return
    const tl = gsap.timeline({
      onComplete: () => {
        setDismissed(true)
        onComplete()
      },
    })
    BEATS.forEach((_, i) => {
      const el = beatRefs.current[i]
      if (!el) return
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5 }, i * 3)
      tl.to(el, { opacity: 0, duration: 0.5 }, i * 3 + 2.5)
    })
    return () => {
      tl.kill()
    }
  }, [reducedMotion, dismissed, onComplete])

  if (reducedMotion || dismissed) return null

  function handleSkip() {
    setDismissed(true)
    onComplete()
  }

  return (
    <div className="intro-sequence" ref={containerRef} role="region" aria-label="Opening sequence">
      {BEATS.map((beat, i) => (
        <div
          className="intro-beat"
          key={beat.label}
          ref={(el) => {
            beatRefs.current[i] = el
          }}
        >
          <p className="intro-beat-label">{beat.label}</p>
          <p className="intro-beat-body">{beat.body}</p>
        </div>
      ))}
      <button type="button" className="intro-skip" onClick={handleSkip}>
        Skip intro
      </button>
    </div>
  )
}
