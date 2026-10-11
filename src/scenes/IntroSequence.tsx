import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

  // A real bug an independent review reproduced live: the caller (Tribunal.tsx) passes
  // `onComplete={() => setIntroDone(true)}`, a NEW closure every render. Tribunal
  // re-renders on every scroll frame (useScrollProgress's rAF-throttled state feeds the
  // WebGL camera), and the GSAP-timeline effect below used to depend on `onComplete`
  // directly -- so scrolling during the intro killed and restarted the 12s timeline from
  // scratch, repeatedly, while the page had already scrolled out from under the still-
  // showing overlay. A ref holds the latest callback without the effect depending on its
  // identity, so the timeline survives re-renders; only reducedMotion/dismissed (real
  // state this component owns) can legitimately restart or skip it.
  const onCompleteRef = useRef(onComplete)
  // Updated in an effect, not during render (oxlint react(refs) correctly flags mutating
  // a ref's .current in the render body as a side effect in render); useLayoutEffect
  // runs synchronously right after each render/before paint, so the ref is always
  // current by the time any later effect or event handler reads it.
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete
  })

  useEffect(() => {
    if (reducedMotion) {
      onCompleteRef.current()
      return
    }
  }, [reducedMotion])

  useEffect(() => {
    if (reducedMotion || dismissed || !containerRef.current) return
    const tl = gsap.timeline({
      onComplete: () => {
        setDismissed(true)
        onCompleteRef.current()
      },
    })
    // Each beat is revealed by a left-to-right wipe and leaves by wiping off to the right
    // (a redaction lifting, then closing), not an opacity fade. An opacity fade passes
    // through low contrast by definition -- a cold Lighthouse run caught beat 1 at 1.84:1
    // mid-fade. With a clip-path wipe the text is always full colour wherever it shows.
    const HIDDEN_LEFT = 'inset(0% 100% 0% 0%)'
    const SHOWN = 'inset(0% 0% 0% 0%)'
    const HIDDEN_RIGHT = 'inset(0% 0% 0% 100%)'
    BEATS.forEach((_, i) => {
      const el = beatRefs.current[i]
      if (!el) return
      tl.fromTo(el, { clipPath: HIDDEN_LEFT }, { clipPath: SHOWN, duration: 0.5, ease: 'power2.out' }, i * 3)
      tl.to(el, { clipPath: HIDDEN_RIGHT, duration: 0.5, ease: 'power2.in' }, i * 3 + 2.5)
    })
    return () => {
      tl.kill()
    }
  }, [reducedMotion, dismissed])

  if (reducedMotion || dismissed) return null

  function handleSkip() {
    setDismissed(true)
    onCompleteRef.current()
  }

  return (
    <div className="intro-sequence" ref={containerRef} role="region" aria-label="Opening sequence">
      {BEATS.map((beat, i) => (
        <div className="intro-beat" key={beat.label}>
          {/* The clip is animated on this content-sized wrapper, not the full-screen
              .intro-beat: a wipe across the whole viewport width only crosses the text
              (centred, about a third of the width) for a fraction of its duration. */}
          <div
            className="intro-beat-inner"
            ref={(el) => {
              beatRefs.current[i] = el
            }}
          >
            <p className="intro-beat-label">{beat.label}</p>
            <p className="intro-beat-body">{beat.body}</p>
          </div>
        </div>
      ))}
      <button type="button" className="intro-skip" onClick={handleSkip}>
        Skip intro
      </button>
    </div>
  )
}
