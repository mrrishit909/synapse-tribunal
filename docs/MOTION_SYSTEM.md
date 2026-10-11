# Motion System

## Three motion layers

1. **The cinematic intro** (`src/scenes/IntroSequence.tsx`): a single GSAP timeline, 4 beats over
   12s (0-3s/3-6s/6-9s/9-12s per the dossier storyboard). Each beat wipes in left to right and
   wipes off to the right via `clip-path` on a content-sized wrapper (a redaction lifting, then
   closing). Not an opacity fade: a fade passes through low contrast by definition, and a cold
   Lighthouse run caught beat 1 at 1.84:1 mid-fade. With the wipe, text is full colour wherever
   it is visible; `e2e/tribunal.spec.ts` audits contrast mid-transition at three points to keep it
   that way. Hands off into chapter 1 by unmounting the fixed-position overlay (never an in-flow
   element, so unmounting it causes zero layout shift -- the CLS lesson from an earlier project in
   this portfolio). Keyboard-skippable (a real `<button>`, natively focusable/activatable).
   `prefers-reduced-motion` skips straight to the dismissed state -- no intro renders at all.

2. **Per-chapter scroll reveal** (`src/motion/useChapterReveal.ts`): each of the 6 `.chapter`
   sections fades/slides in via a GSAP `ScrollTrigger` as it's scrolled to. `toggleActions: 'play
   none none reverse'` -- plays once on entering, stays visible while scrolling further down (an
   earlier version used `'play reverse play reverse'`, which hid each chapter again as soon as the
   user scrolled past it going down, wrong for a long-form reading page), and only reverses if the
   user scrolls back up above where it started (the actual "reversible choreography" requirement).
   Reduced motion renders every chapter at its final state and registers no `ScrollTrigger`s at
   all.

3. **The WebGL camera** (`src/webgl/Scene.tsx`'s `ScrollCamera`): position interpolates along a
   fixed path as `useScrollProgress()` (a plain scroll listener, 0-1 across the full document)
   changes, independent of the GSAP chapter-reveal system but reading the same scroll state.
   `reducedMotion` holds the camera at a single fixed position (one static frame, not merely
   slower motion).

## A real timing bug this system had, and its fix

The intro's GSAP timeline used to depend on an `onComplete` callback prop whose identity changed
on every parent re-render (`Tribunal.tsx` re-renders on every scroll frame, since
`useScrollProgress`'s state feeds the WebGL camera). Scrolling during the intro killed and
restarted the 12s timeline from scratch, repeatedly -- an independent review reproduced this live
(the intro still showing 5+ seconds past its scripted runtime while the page had already scrolled
to 100%). Fixed with a ref holding the latest callback, updated in a `useLayoutEffect` (not during
render -- oxlint's `react(refs)` rule correctly flags mutating a ref's `.current` in the render
body), so the timeline-owning effect no longer depends on the callback's identity. Regression test
in `e2e/tribunal.spec.ts` ("cinematic intro completes on schedule even while the page is scrolled
during it"), verified to fail against the original implementation before being trusted.

## Reversibility and interruptibility

- Chapter reveals reverse on scroll-back (above), tested in `e2e/tribunal.spec.ts`'s "reverse
  scroll" test.
- GSAP timelines are always killed in effect cleanup (`tween.kill()` / `tl.kill()`), verified
  safe under React StrictMode's double-invoke.
- An async computation failing (e.g. no feasible counterfactual flip) never leaves the animation
  system in an inconsistent state -- the result display and the motion system are independent;
  a failed search just renders its own honest "infeasible" message, nothing animates incorrectly.

## What's NOT animated, deliberately

Analytical state transitions (perturbing a feature, switching models, moving the threshold) are
instant, not animated -- the numbers changing IS the content; adding a tween between old and new
values would risk implying an interpolated/simulated intermediate value that was never actually
computed, which the project's own labeling rule forbids.
