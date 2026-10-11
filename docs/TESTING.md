# Testing

## Suites

| Suite | Command | Count (as of this write) |
|---|---|---|
| Python reference engine | `.venv/bin/python -I -m pytest tests/unit -q` | 69 |
| TypeScript engine + components | `npx vitest run` | 25 |
| Browser (3 engines: Chromium/Firefox/WebKit) | `npx playwright test` | 84 (28 tests x 3 browsers) |
| Typecheck | `npx tsc -b` | -- |
| Lint | `npx oxlint` | -- |

All must be clean (0 failures, 0 type errors, 0 lint warnings) before any commit in this
project's history -- verified every time, not assumed.

## What the Playwright suite covers

- All 6 interactions (SYN-INT-001 through 006), functionally.
- The cinematic intro: plays, is keyboard-skippable, hands off correctly, and (a real regression
  test) completes on schedule even if the user scrolls repeatedly during it.
- Reduced motion: the intro is skipped entirely; the WebGL camera holds a static position.
- All 6 chapters revealing on forward scroll, with the chapter nav correctly tracking the active
  one; reverse scroll un-reveals a chapter scrolled back above its start.
- Responsive: 3 breakpoints (1440x900 / 768x1024 / 390x844), asserted to have zero horizontal
  overflow, with real per-chapter screenshots at each (not `fullPage: true` -- see the note below).
- WebGL: renders as a lazy-loaded separate chunk; reduced-motion static frame; zero idle render
  loop; genuine `webglcontextlost` recovery; and (a real regression test) an unrelated page error
  does NOT kill the renderer.
- Accessibility: axe-core, zero violations, audited per-chapter (scoped to that chapter's own
  section -- an unscoped whole-page scan was once caught flagging a NEIGHBORING chapter still
  mid-reveal-animation, not the chapter under test) and on the intro overlay.

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
