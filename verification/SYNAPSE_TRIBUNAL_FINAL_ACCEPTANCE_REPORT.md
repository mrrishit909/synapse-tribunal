# Synapse Tribunal, Final Acceptance Report (Stage A: Local)

**Final commit:** `7a2380c` (26 commits from bootstrap)
**Date:** 2026-10-10
**Verdict: ACCEPTED (Stage A, local release)**, see "What this does NOT cover" for Stage B.

---

## 1. Completed milestones

| Milestone | Status |
|---|---|
| M0: Atlas dossier extraction, spec lock | Done, `specifications/SPEC_LOCK.md` |
| M1: Analytical foundation (Python + TS engines, cross-verified) | Done |
| M2: Vertical slice (SYN-INT-004), independently reviewed | Done, 0 P0, 3 P1 found and fixed |
| M3: All 6 interactions + all 6 chapters + cinematic intro | Done |
| M4: Persistent WebGL renderer (user-directed) | Done |
| M5: Cross-browser (Chromium/Firefox/WebKit) + axe-core accessibility | Done |
| M6: Final independent review of the complete integrated build | Done, 0 P0, 2 P1 found and fixed |
| M7: Release documentation + deterministic auditor | Done |

## 2. Requirement coverage

All 6 `SYN-INT-*` requirements and all 5 release gates (`SYN-DATA-001`, `SYN-MATH-001`,
`SYN-UX-001`, `SYN-MOTION-001`, `SYN-RELEASE-001`) are recorded in
`specifications/REQUIREMENTS.yaml`. Every `SYN-INT-*` row and `SYN-UX-001`/`SYN-MOTION-001` are
`independently_verified`. `SYN-RELEASE-001` is `in_progress` → closed by this report (Stage A
only; Stage B remains separately gated, see section 10).

## 3. Dataset provenance

Adult Income, OpenML id 1590 v2, public-domain US Census source. License, access date, and
SHA-256 checksum recorded in `research/data/raw/MANIFEST.json`, re-verified bit-identical by both
independent reviewers via a cold refetch. Full field-level actionable/immutable reasoning in
`specifications/DATA_CONTRACT.yaml`. See `docs/DATA_SOURCES.md`.

## 4. ML/model validation

- Logistic regression: CV AUROC 0.9040, test AUROC 0.9045, test Brier 0.1049.
- Gradient-boosted trees (`HistGradientBoostingClassifier`): CV AUROC 0.9270, test AUROC 0.9260,
  test Brier 0.0916.
- Both reproduced bit-identically from a cold retrain by the final independent review (own fresh
  `.venv`, own refetch, own retrain).
- TypeScript port of the logistic model matches sklearn's `predict_proba` to <1e-4 across the
  **entire** 9,045-row held-out test set (not a sample).
- Attribution (closed-form linear SHAP) is round-trip tested: `sum(attribution) + base_logit ==
  logit(x)`, both languages, <1e-3.
- The boosting model never receives a fabricated attribution anywhere in the codebase (grepped
  and confirmed by the final review): `attribution_available: false`, `liveResult.attribution`
  hard-nulled when the boosting model is active.
- Leakage disclosed, not hidden: 1,977/9,045 (21.9%) exact test/train duplicate rows after
  dropping `fnlwgt`, confirmed by both independent reviews via cold retrain.
- Metrics independently reconciled: `tests/unit/test_reference.py` recomputes AUROC/PR-AUC/Brier
  and every threshold-sweep/calibration row directly from raw per-row data, not from `train.py`'s
  own computation.

## 5. Analytical test results

- 69/69 pytest (reference engine).
- 25/25 vitest (TypeScript engine + components), including full-test-set parity and
  attribution-sum invariant checks.

## 6. Browser test results

- 84/84 Playwright tests across Chromium, Firefox, and WebKit (28 tests × 3 browsers).
- Covers: all 6 interactions functionally, the cinematic intro (including a scroll-during-intro
  regression test), reduced motion, all-6-chapters forward/reverse reveal, 3-breakpoint
  responsive (no horizontal overflow), WebGL rendering/lazy-loading/reduced-motion/idle-loop/
  context-loss/unrelated-error-isolation.

## 7. Accessibility results

8 axe-core audits × 3 browsers = 24 runs, **zero violations** (page load, each of the 6 chapters
individually scoped, the intro overlay). A `<main>` landmark and WCAG AA contrast (panel opacity
raised from 0.88 to 0.97 after the WebGL scene's glow was found to blend through and occasionally
drop text below 4.5:1) were real, now-fixed findings from this sweep, not assumed clean from the
start.

## 8. Visual QA findings

Two independent reviewers (vertical-slice stage and final-integration stage) both took their own
fresh screenshots rather than trusting committed ones and confirmed: the forensic dossier identity
is genuinely distinctive and consistently applied across all 6 chapters; the WebGL evidence core
and attribution planes visibly respond to real analytical state through the semi-transparent
panels; no broken layouts, clipping, or missing content at any of the 3 breakpoints. See
`verification/SCREENSHOTS/` (36 images, 6 chapters × desktop/tablet/mobile + unprefixed chromium
captures).

## 9. Real performance measurements

| Metric | Budget | Measured |
|---|---|---|
| Desktop Lighthouse Performance | ≥90 | 71–100 across 3 runs (variance traced to real CPU contention from unrelated processes on a shared machine, confirmed via `ps aux`, not a build defect); independently spot-checked by the final review at a cold 100 |
| Mobile Lighthouse Performance | ≥80 | 96–97 (after fixing a real regression: 60 before disabling WebGL below 768px) |
| Desktop/Mobile LCP | ≤2.5s | 0.8–1.0s / 2.4s |
| CLS | ≤0.1 | 0 |
| Frame pacing (real GPU, headed, not SwiftShader) | ~60fps, 0 dropped vs idle | ~115–120fps (display refresh rate), 0 dropped frames forward and reverse |
| Idle render loop | zero sustained rAF when idle | Verified via `frameloop="demand"` + e2e test |

Full detail and the kill-criteria this was measured against: `docs/PERFORMANCE_BUDGETS.md`,
`verification/lighthouse-{desktop,mobile}.json`, `verification/FRAME_PACING.json`.

## 10. Independent review conclusions

**Review 1 (vertical slice, SYN-INT-001/004):** 0 P0, 3 P1 (undisclosed counterfactual-search
scope, categorical search picking the wrong candidate relative to its own spec, SYN-INT-001
undertested/mislabeled in the ledger). All fixed, with a regression test added for the
categorical-minimality fix in both Python and TypeScript.

**Review 2 (full-integration, final):** 0 P0, 2 P1, both reproduced adversarially (not found by
inspection) and fixed:
1. Intro could get stuck well past its 12s runtime under scrolling (unstable `onComplete` closure
   identity restarting the GSAP timeline). Fixed with a ref + `useLayoutEffect` + `useCallback`.
   Regression test proven to fail against the original code before being trusted.
2. The WebKit context-loss fix was an unscoped `window` error listener that could permanently
   kill the WebGL renderer on any unrelated page error. Fixed by scoping to errors originating
   from the WebGL chunk (filename/stack check). Regression test proven to fail against the
   unscoped version before being trusted.

Both reviews' 2 P2 (cosmetic, non-blocking) findings are recorded in their respective commit
messages and `docs/LIMITATIONS.md`; neither was treated as release-blocking.

## 11. Fixed defects (summary)

See commit messages for full detail: `8d748d8`, `072a203` (vertical-slice review fixes);
`a7a131a` (final-review fixes: intro-scroll bug, WebGL error-scope bug); `421dcc5` (cross-browser/
axe findings: WebKit crash-on-context-loss, 3 WCAG contrast failures, missing `<main>` landmark,
missing mobile touch-target spacing); `a51ab6f` (stale ledger/README/RESUME.md, the same
class of defect caught twice, see `docs/TESTING.md`'s "mutation-testing discipline" note and
`execution/RESUME.md`'s explicit warning about trusting these files blindly going forward).

## 12. Known limitations (disclosed, not hidden)

- **Mobile/tablet is a single-column reflow**, not yet a deliberately distinct composition
  (bottom-sheet controls, reframed camera). Functional, legible, zero accessibility violations,
  but not art-directed separately from desktop. Disclosed consistently in `docs/LIMITATIONS.md`
  and `docs/VISUAL_DESIGN.md` across both independent reviews, not newly discovered and not
  silently dropped.
- 22% train/test exact-duplicate leakage (disclosed, judged low-impact given Adult's
  well-established literature AUROC range; a grouped split is recorded as the honest future fix).
- No live TypeScript evaluator for the boosting model (tree internals aren't public sklearn API);
  it only ever shows its real precomputed fixture probability.
- Counterfactual search is single-feature only (disclosed in the UI itself, not just code
  comments, after the vertical-slice review caught it being under-disclosed).
- Desktop Lighthouse variance across runs on this shared machine (documented, not cherry-picked).
- No `execution/tasks.json` machine-readable task ledger exists (V2 directive's fuller
  controller); `specifications/REQUIREMENTS.yaml` is hand-maintained and has been caught stale
  twice, `scripts/release-check.mjs` (this report's own evidence source) is the closest thing to
  an automated check on it, verifying no row is left `unstarted`/`blocked`, not full semantic
  correctness of every row's detail.

## 13. Production build and deployment readiness

- `npm run build` succeeds cleanly (`tsc -b && vite build`).
- `npm run preview` serves the build correctly; every Playwright test runs against this exact
  production build, never a dev server.
- `npm run release:check` (the deterministic auditor) reports a full, genuine `PASS` on every
  criterion against the committed state (see the run preceding commit `7a2380c`).
- **Not yet deployed.** `docs/DEPLOYMENT.md` records exact readiness and the steps that would be
  taken. Stage B (public GitHub repo, Pages deployment, portfolio integration) requires separate
  explicit authorization per `specifications/SPEC_LOCK.md` section 3, which has not been given in
  this project's history. This report's ACCEPTED verdict covers Stage A (local release) only.

## 14. Final verdict

**ACCEPTED** for Stage A (local release). All mandatory local release criteria from
`EXECUTION_PROTOCOL.md`'s five gates are met with real, independently-verified evidence:

- G1 Spec lock, `specifications/{SPEC_LOCK,INTERACTIONS,REQUIREMENTS,DATA_CONTRACT}.{md,yaml}`.
- G2 Analytical truth, section 4 above; cross-verified by two independent cold retrains.
- G3 Functional build, all 6 controls real and tested, no decorative/fake controls found by
  either independent review.
- G4 Creative verification, section 8 above; two independent reviewers inspected real
  screenshots.
- G5 Release evidence, this report, `scripts/release-check.mjs`'s genuine PASS, full
  requirement traceability in `REQUIREMENTS.yaml`.

No unresolved P0 or P1 defects remain. The project is not represented as publicly deployed
because it is not; Stage B remains an explicit, separate decision for the user.
