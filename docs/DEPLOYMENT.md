# Deployment

**Status: deployed** (Stage B, authorized by the user 2026-10-11).

| | |
|---|---|
| Live site | https://mrrishit909.github.io/synapse-tribunal/ |
| Repository | https://github.com/mrrishit909/synapse-tribunal (public) |
| Case study | https://mrrishit909.github.io/projects/synapse-tribunal/ |
| Record | `verification/SYNAPSE_TRIBUNAL_PUBLICATION_REPORT.md` |

## Production build

```bash
npm run build    # tsc -b && vite build, outputs to dist/
npm run preview  # serves dist/ locally for a final smoke check before any real deploy
```

Verified repeatedly this session: clean build from a clean `dist/`, clean typecheck, production
preview serves correctly, and every Playwright e2e test in this project runs against exactly this
production build (never a dev server) -- `npx playwright test` passing is itself a real
build-correctness check.

## Base path

`vite.config.ts` sets `base: '/synapse-tribunal/'`, matching the GitHub Pages project URL.
`src/engine/useFixtures.ts` builds fixture URLs from `import.meta.env.BASE_URL`, so nothing else
depends on the path. The e2e suite navigates relative to its `baseURL`
(`http://localhost:4173/synapse-tribunal/` by default), so every local run already exercises the
base path, and `LIVE_URL=<deployed url> npx playwright test` runs the same suite against a
deployed copy (screenshots then go to `verification/LIVE_SCREENSHOTS/`).

## CI

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci`, typecheck, lint, Vitest,
build, then publishes `dist/` with `actions/deploy-pages`. The repository's Pages source must be set to
"GitHub Actions" once (Settings, Pages, Source; or `gh api -X POST repos/<owner>/<repo>/pages -f
build_type=workflow`), or the first deploy job fails. Only the deploy job has `pages: write` and
`id-token: write`; the build job, which runs npm install scripts, is read-only. It does not run Playwright or pytest;
`npm run release:check` covers those and is run locally against the exact commit before it is
pushed.

## Pre-deployment checklist (all done for the Stage B release)

- [x] `base` in `vite.config.ts` set to match the real target path.
- [x] `npm run build` succeeds with no errors.
- [x] `npm run preview` serves the build correctly: intro plays, all 6 controls produce real
      recomputed results, browser console shows no errors.
- [x] Full test suite green: `npx tsc -b`, `npx oxlint`, `npx vitest run`, `npx playwright test`
      (chromium/firefox/webkit), `.venv/bin/python -I -m pytest tests/unit -q`.
- [x] `docs/LIMITATIONS.md` reflects the actual shipped state.
- [x] Independent, worktree-isolated adversarial review has run against this build and its
      findings are resolved (two rounds: vertical-slice review and full-integration review, both
      with 0 P0, both their P1s fixed and regression-tested).
- [x] After publishing: a real `curl` check against the live URL, and a real screenshot of the
      live page actually loading -- this project's own standing rule (inherited from this
      portfolio's prior projects) is that a deployment is not verified until checked this way,
      not merely "the push succeeded."
- [x] Re-verify fixture fetches resolve under the real base path once set (the exact class of bug
      the base-path change exposed in a prior project in this portfolio, caught via a live
      layout-shift probe -- re-run `npx playwright test` against the base-pathed preview before
      trusting it).

## What this build does NOT include

No CDN, no server-side rendering, no backend of any kind -- fully static (HTML/CSS/JS + static
JSON fixtures + the WebGL chunk), suitable for any static host (GitHub Pages, Netlify, Vercel's
static mode, a plain S3 bucket) with no server-side configuration required. The WebGL chunk
(~912KB, ~242KB gzipped) is lazy-loaded and never fetched on mobile viewports or without WebGL
support, so static hosting doesn't need to do anything special for it beyond serving the file.
