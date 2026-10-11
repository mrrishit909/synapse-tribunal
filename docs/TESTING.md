# Testing

## Suites

| Suite | Command | Count (as of this write) |
|---|---|---|
| Python reference engine | `.venv/bin/python -I -m pytest tests/unit -q` | 69 |
| TypeScript engine + components | `npx vitest run` | 25 |
| Browser (3 engines: Chromium/Firefox/WebKit) | `npx playwright test` | 150 (50 tests x 3 browsers) |
| Typecheck | `npx tsc -b` | -- |
| Lint | `npx oxlint` | -- |
| Everything above, plus docs/ledger/chunking checks | `npm run release:check` | -- |

All must be clean (0 failures, 0 type errors, 0 lint warnings) before a release commit.
`npm run release:check` (`scripts/release-check.mjs`) runs every one of them and also checks:
the working tree is clean before anything runs, the required docs exist, no requirement is left
`unstarted`/`blocked`, and three's `WebGLRenderer` is bundled only in the `WebGLStage` chunk
(the WebGL error fallback recognises renderer crashes by that chunk name; a vendor split would
silently break it).

## What the Playwright suite covers

- All 6 interactions (SYN-INT-001 through 006), functionally.
- The cinematic intro: plays, is keyboard-skippable, completes on schedule even if the user
  scrolls repeatedly during it, hands off to chapter 1 (or a `#chapter-N` deep link) rather than
  wherever the page drifted under the overlay, and stays above WCAG AA contrast at sampled points
  mid-transition (beats reveal by clip-path wipe, not opacity fade).
- Reduced motion: the intro is skipped entirely; the WebGL camera holds a static position.
- All 6 chapters revealing on forward scroll, with the chapter nav correctly tracking the active
  one; reverse scroll un-reveals a chapter scrolled back above its start.
- Responsive: 6 viewport sets (1920x1080, 1440x900, 1024x768, 768x1024, 390x844, 360x740) with
  zero horizontal overflow and real per-chapter screenshots at each (not `fullPage: true`, see
  below). Separately, nav geometry at nine widths (360 to 1920, including 1299/1300 either side of
  the rail breakpoint): the desktop rail never overlaps content, tap targets are at least 24px
  (44px on phones), the mobile bottom bar never covers the end of chapter 6, the tablet/mobile
  verdict strip shows exactly the chapter-1 badge's recomputed probability, and the rail has an
  opaque backing (its contrast over the WebGL canvas can't be audited by axe).
- WebGL: lazy-loaded separate chunk; reduced-motion static frame; zero idle render loop; genuine
  `webglcontextlost` falls back; a crash thrown inside the render loop falls back without
  blanking the page; an unrelated page error or unhandled rejection does NOT kill the renderer.
- Accessibility: axe-core, zero violations, per chapter (scoped to that chapter's own section,
  since an unscoped scan once flagged a NEIGHBORING chapter still mid-reveal) and on the intro.

## A real `fullPage: true` screenshot bug, and why screenshots are per-chapter now

An earlier version of this suite used `page.screenshot({ fullPage: true })`. One such screenshot
showed a visible fragment of the intro overlay baked into the image even though the live DOM
(confirmed via a standalone debug script) had zero `.intro-sequence` nodes at that point. Root
cause turned out to be a test-helper race (`isVisible()` doesn't auto-wait, so a skip-intro click
right after `goto()` could silently no-op, leaving the intro running its full 12s uninterrupted
through the rest of that test) -- re-verified after fixing the race that a fresh `fullPage`
capture renders cleanly. Kept the per-chapter viewport screenshots regardless of that resolution,
since this project's own CLAUDE.md flags `fullPage` captures as able to conceal scroll defects in
general, and per-chapter shots are better QA evidence anyway (entry state per chapter, not one
flattened composite).

## Mutation-testing discipline for regression tests

Every regression test added for a reproduced bug in this project was verified to actually FAIL
against the defective code before being trusted -- not assumed to catch the bug because it reads
like it should. Two documented examples (see commit `a7a131a`): the intro-scroll-timing test was
reverted against the original closure-based `IntroSequence`/`Tribunal.tsx` code, run, confirmed to
fail, then the fix was restored and the test re-run to confirm it passes. Same process for the
WebGL unrelated-error test against the original unscoped `window` error listener.

## Known environment gotcha

Playwright's `webServer.reuseExistingServer: true` will happily connect to ANY process already
listening on the configured port -- including an unrelated project's own `vite preview` server.
This produced a genuinely confusing set of test failures (unrelated page content, a crash)
traced only after checking `pgrep -fl "vite preview"` and finding a different project's server
squatting on port 4173. Kill stray preview processes before running this suite locally.

## Performance / Lighthouse

See `docs/PERFORMANCE_BUDGETS.md` for budgets, kill criteria, and measured results (including a
disclosed desktop Lighthouse variance across runs, traced to real CPU contention from unrelated
processes on a shared machine, not a build defect) and `verification/FRAME_PACING.json` for real
headed-GPU frame-pacing numbers (not headless/SwiftShader, which this project's own earlier
project in the portfolio established are not trustworthy for this metric).
