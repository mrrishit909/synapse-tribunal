# Resume contract

**Latest verified commit:** see `git log -1 --oneline` on `main` (as of this write: `a7a131a`
"Fix two P1 defects found by the final independent review", 16 commits deep from bootstrap).
84/84 Playwright (chromium+firefox+webkit, including axe-core), 25/25 vitest, 69/69 pytest,
clean tsc/oxlint/vite build.

**Active milestone:** task #11 (final independent review + remediation) essentially complete --
both P1s it found are fixed and regression-tested. Task #12 (release docs + final acceptance
report) is in progress now. SYN-RELEASE-001 is `in_progress` (not yet `independently_verified`):
the required docs set and `verification/SYNAPSE_TRIBUNAL_FINAL_ACCEPTANCE_REPORT.md` are what's
still outstanding.

**What exists now (do not re-derive this from scratch -- it is all real and tested):**
- Full analytical foundation: logistic regression + gradient-boosted trees on Adult Income,
  cross-verified Python/TS engines (parity <1e-4 across the full 9045-row test set), honest
  leakage (22% disclosed)/attribution/counterfactual-scope labeling.
- All 6 required interactions (SYN-INT-001 through 006) in `src/scenes/Tribunal.tsx`, each
  independently verified (see `specifications/REQUIREMENTS.yaml`).
- All 6 narrative chapters with distinct compositions (hero/editorial-split/inspector/
  diagnostic/grid/comparative) and the 0-12s cinematic intro, scroll-driven reveal via
  `src/motion/useChapterReveal.ts`.
- A persistent WebGL background renderer (`src/webgl/`, React Three Fiber): an evidence core
  and attribution planes driven by the SAME live analytical state the 2D UI reads, camera tied
  to scroll progress, lazy-loaded (never fetched below 768px viewport or without WebGL support),
  `frameloop="demand"` (no idle render loop), with a layered fallback (WebGLErrorBoundary +
  a WebGL-chunk-scoped `window` error listener + genuine `webglcontextlost` handling).
- Cross-browser (Chromium/Firefox/WebKit) and axe-core accessibility coverage, 0 violations.
- Two independent reviews, both worktree-isolated with no session access: one on the vertical
  slice (0 P0, 3 P1, all fixed), one full-integration final review (0 P0, 2 P1, both fixed with
  regression tests proven to fail against the defective code before being trusted -- see the
  `a7a131a` commit message for the exact repro/fix/verify sequence for each).

**Known, disclosed (not hidden) limitations, current as of this commit:**
- Mobile has its own composition (bottom tab bar, live verdict strip, 44px targets) but no WebGL
  scene and no bottom-sheet controls. See `docs/LIMITATIONS.md` for the current list.
- No `execution/tasks.json`/`release:check` automated auditor exists; this file and
  `specifications/REQUIREMENTS.yaml` are maintained by hand. The ledger has been caught stale
  twice now (once on SYN-INT-001's own status, once on this whole file plus README.md not
  reflecting the WebGL build) -- treat any status claim in these files as indicative, cross-check
  against `git log` and the actual code before trusting it for anything load-bearing.
- No public deployment (Stage B). Requires separate explicit authorization per
  `SPEC_LOCK.md` section 3.

**Next eligible task:** finish task #12 -- write the remaining required docs
(`docs/ARCHITECTURE.md`, `VISUAL_DESIGN.md`, `MOTION_SYSTEM.md`, `DATA_SOURCES.md`, `TESTING.md`,
`DEPLOYMENT.md`), then write `verification/SYNAPSE_TRIBUNAL_FINAL_ACCEPTANCE_REPORT.md` with a
real ACCEPTED/NOT ACCEPTED verdict grounded in actual evidence, not an assumed one.

**Required commands:**
```
cd ~/synapse-tribunal
export SSL_CERT_FILE=$(.venv/bin/python -c "import certifi; print(certifi.where())")
.venv/bin/python -I -m pytest tests/unit -q
npx tsc -b && npx oxlint && npx vitest run && npx vite build && npx playwright test
```

**Active worktrees:** none (both independent-review worktrees were cleaned up after their reports;
confirm with `git worktree list` before assuming otherwise, since this file itself has been
caught stale before).

**Safe cleanup:** `research/data/raw/_cache/` is the sklearn fetch cache, safe to delete and
refetch if ever suspected stale. Kill any stray `vite preview --port 4173` processes before
running Playwright locally -- a real debugging session this build went through found an
UNRELATED project's own preview server squatting on that port, which `reuseExistingServer: true`
silently connected to instead of this project's server, producing confusing unrelated test
failures until traced to the actual cause.
