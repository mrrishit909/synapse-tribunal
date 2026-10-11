# Deployment

**Status: NOT deployed.** Stage B (public GitHub repo + Pages deployment + portfolio
integration) requires separate explicit authorization per `specifications/SPEC_LOCK.md` section
3, which has not been given in this project's history. This document records deployment
readiness and the steps that WOULD be taken, following this portfolio's own established pattern
(CASCADIA, The Counterfactual City) -- it is not a claim that deployment has happened.

## Production build

```bash
npm run build    # tsc -b && vite build, outputs to dist/
npm run preview  # serves dist/ locally for a final smoke check before any real deploy
```

Verified repeatedly this session: clean build from a clean `dist/`, clean typecheck, production
preview serves correctly, and every Playwright e2e test in this project runs against exactly this
production build (never a dev server) -- `npx playwright test` passing is itself a real
build-correctness check.

## Base path (not yet set)

Unlike this portfolio's prior two projects, `vite.config.ts` does NOT currently set a `base`
path for GitHub Pages -- because no target repository name has been decided (Stage B hasn't
started). Before any real deployment: set `base: '/synapse-tribunal/'` (or whatever the actual
repo name ends up being) in `vite.config.ts`, matching the pattern CASCADIA and The
Counterfactual City both used, and re-verify `public/data/precomputed/*.json` fixture fetches
still resolve correctly under that base path (`src/engine/useFixtures.ts` already builds its
fetch URLs from `import.meta.env.BASE_URL`, so no other code should need to change -- this is the
exact pattern that worked cleanly for both prior projects).

## Pre-deployment checklist (for whenever Stage B is authorized)

- [ ] `base` in `vite.config.ts` set to match the real target path.
- [x] `npm run build` succeeds with no errors.
- [x] `npm run preview` serves the build correctly: intro plays, all 6 controls produce real
      recomputed results, browser console shows no errors.
- [x] Full test suite green: `npx tsc -b`, `npx oxlint`, `npx vitest run`, `npx playwright test`
      (chromium/firefox/webkit), `.venv/bin/python -I -m pytest tests/unit -q`.
- [x] `docs/LIMITATIONS.md` reflects the actual shipped state.
- [x] Independent, worktree-isolated adversarial review has run against this build and its
      findings are resolved (two rounds: vertical-slice review and full-integration review, both
      with 0 P0, both their P1s fixed and regression-tested).
- [ ] After publishing: a real `curl` check against the live URL, and a real screenshot of the
      live page actually loading -- this project's own standing rule (inherited from this
      portfolio's prior projects) is that a deployment is not verified until checked this way,
      not merely "the push succeeded."
- [ ] Re-verify fixture fetches resolve under the real base path once set (the exact class of bug
      the base-path change exposed in a prior project in this portfolio, caught via a live
      layout-shift probe -- re-run `npx playwright test` against the base-pathed preview before
      trusting it).

## What this build does NOT include

No CDN, no server-side rendering, no backend of any kind -- fully static (HTML/CSS/JS + static
JSON fixtures + the WebGL chunk), suitable for any static host (GitHub Pages, Netlify, Vercel's
static mode, a plain S3 bucket) with no server-side configuration required. The WebGL chunk
(~912KB, ~242KB gzipped) is lazy-loaded and never fetched on mobile viewports or without WebGL
support, so static hosting doesn't need to do anything special for it beyond serving the file.
