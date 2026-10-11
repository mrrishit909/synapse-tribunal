# Resume contract

This file has been caught stale three times during this build. Before trusting anything here,
check `git log --oneline | head` and run `npm run release:check`; those are the ground truth.

**State:** Stage A (local release) ACCEPTED. See
`verification/SYNAPSE_TRIBUNAL_FINAL_ACCEPTANCE_REPORT.md`. Stage B (public repo, GitHub Pages,
portfolio integration) has NOT been done and needs separate explicit authorization from the user
(`specifications/SPEC_LOCK.md` section 3). Do not push or deploy without it.

**Last full verification:** `npm run release:check` PASS on every criterion: 156/156 Playwright
(52 tests x Chromium/Firefox/WebKit, including axe-core), 25/25 vitest, 69/69 pytest, clean
tsc/oxlint/build, required docs present, ledger has nothing `unstarted`/`blocked`, three's renderer
bundled only in the WebGLStage chunk.

**What exists (all real and tested; do not rebuild it):**
- Analytical engine: logistic regression + gradient-boosted trees on Adult Income; Python and
  TypeScript engines cross-verified (<1e-4 parity over the full 9,045-row test set); honest
  leakage/attribution/counterfactual-scope labeling.
- All 6 interactions (SYN-INT-001..006), all 6 chapters, the 12s intro (clip-path wipe beats,
  hands off to chapter 1 or a deep link), in `src/scenes/`.
- Persistent WebGL stage (`src/webgl/`), lazy-loaded, never fetched below 768px or without
  WebGL, `frameloop="demand"`, layered fallback (feature detect, mobile skip, error boundary,
  chunk-scoped `error`/`unhandledrejection` listener, real `webglcontextlost` handling).
- Three responsive compositions: side rail >=1300px; sticky top tabs + live verdict strip
  768-1299px; bottom tab bar + strip, 44px targets, no WebGL <768px.
- Three independent worktree-isolated reviews: vertical slice (0 P0, 3 P1), full integration
  (0 P0, 2 P1, NOT ACCEPTED at 421dcc5), remediation recheck at bc9b237 (all blockers resolved,
  no new P0/P1, P2s then fixed in d4dfeac; a 2px rail overlap that commit introduced at 1300px was caught by release:check and fixed in 6c82a86). Every P1 fix has a regression test confirmed to fail
  against the defective code.

**Known limitations:** `docs/LIMITATIONS.md` is the current list.

**If resuming to do Stage B (only with user authorization):** follow `docs/DEPLOYMENT.md` (set
Vite `base`, rerun the suite against the base-pathed preview, create the repo, deploy via
Actions, verify the live URL with curl + a real screenshot + Playwright against the live site,
then integrate into the portfolio site the same way the earlier Atlas projects were).

**Commands:**
```
cd ~/synapse-tribunal
pkill -f "vite preview"          # another project on this machine has squatted port 4173 before
npm run release:check             # runs everything below and more
export SSL_CERT_FILE=$(.venv/bin/python -c "import certifi; print(certifi.where())")
.venv/bin/python -I -m pytest tests/unit -q
npx tsc -b && npx oxlint && npx vitest run && npx vite build && npx playwright test
```

**Active worktrees:** none expected; confirm with `git worktree list`.
