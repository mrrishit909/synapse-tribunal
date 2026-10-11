# Synapse Tribunal: Final Acceptance Report (Stage A, local)

**Verified code commit:** `6c82a86`. This report and the matching ledger/doc updates are in the
commit that adds this version of the file; `npm run release:check` is run against that commit.
**Date:** 2026-10-11
**Verdict: ACCEPTED for Stage A (local release).** Stage B (public deployment) has not happened
and needs separate authorization (section 13).

This report supersedes the version written at `f6eed4c`, which said mobile/tablet were a reflow
and quoted 84 Playwright tests. Both changed since.

---

## 1. Milestones

| Milestone | Result |
|---|---|
| Spec lock from the Atlas dossier | `specifications/SPEC_LOCK.md` |
| Analytical foundation (Python + TypeScript engines, cross-verified) | Done |
| Vertical slice (SYN-INT-004), independent review 1 | 0 P0, 3 P1, all fixed |
| All 6 interactions, 6 chapters, cinematic intro | Done |
| Persistent WebGL stage (user-directed) | Done |
| Cross-browser (Chromium/Firefox/WebKit) + axe-core | Done |
| Full-integration independent review 2 | NOT ACCEPTED at `421dcc5`: 0 P0, 2 P1 plus doc/ledger staleness, mobile reflow |
| Remediation: P1 fixes, docs, release auditor, three responsive compositions, intro contrast | Done |
| Remediation recheck, independent review 3 (at `bc9b237`) | All blocking findings resolved in all 3 engines; no new P0/P1; P2s fixed in `d4dfeac` |

## 2. Requirement coverage

All 6 `SYN-INT-*` requirements and the 5 gates (`SYN-DATA-001`, `SYN-MATH-001`, `SYN-UX-001`,
`SYN-MOTION-001`, `SYN-RELEASE-001`) are in `specifications/REQUIREMENTS.yaml`. All 6 interactions
and `SYN-UX-001`, `SYN-MOTION-001`, `SYN-RELEASE-001` are `independently_verified`;
`SYN-DATA-001` and `SYN-MATH-001` are `implemented`, with their evidence re-derived from scratch
by two independent cold retrains (section 4). `SYN-RELEASE-001` covers the local half only.

## 3. Dataset provenance

Adult Income, OpenML 1590 v2, public-domain US Census data. License, access date and SHA-256 in
`research/data/raw/MANIFEST.json`; refetched and matched by independent reviewers. Field-level
actionable/immutable reasoning in `specifications/DATA_CONTRACT.yaml`; see `docs/DATA_SOURCES.md`.

## 4. Model validation

- Logistic regression: CV AUROC 0.9040, test AUROC 0.9045, Brier 0.1049.
- Gradient-boosted trees: CV AUROC 0.9270, test AUROC 0.9260, Brier 0.0916.
- Retrained cold by independent reviewers 2 and 3: fixtures byte-identical.
- The TypeScript logistic port matches sklearn `predict_proba` to <1e-4 over all 9,045 test rows.
- Attribution (closed-form linear SHAP) round-trips: `sum(attribution) + base_logit = logit(x)`
  within 1e-3 in both languages; labelled as exact only under feature independence.
- The boosting model never shows an attribution (it has none; nothing is fabricated).
- Leakage disclosed: 1,977 of 9,045 test rows (21.9%) duplicate a training row after `fnlwgt` is
  dropped. The manifest's own note now says "somewhat optimistic", not the earlier "mildly".
- AUROC/PR-AUC/Brier and every threshold-sweep and calibration row are recomputed from raw
  per-row data in `tests/unit/test_reference.py`, independently of `train.py`.

## 5. Analytical tests

69/69 pytest; 25/25 vitest (including full-test-set parity and the attribution-sum invariant).

## 6. Browser tests

156/156 Playwright: 52 tests x Chromium, Firefox and WebKit. Coverage:
- all 6 interactions;
- intro: skip, keyboard, reduced motion, on-schedule completion under scrolling, hand-off to
  chapter 1 or a deep link;
- forward and reverse chapter reveal; scrollspy nav;
- responsive: 6 screenshot viewports, nav geometry at 9 widths, tap targets, verdict strip
  parity with the badge, bottom bar clearance, top-tab navigation at 768 and 1024px;
- WebGL: lazy chunk, reduced-motion static frame, idle loop, context loss, a crash inside the
  render loop, unrelated errors and rejections not killing the renderer.

Each regression test for a reproduced P1 bug, and each of the newer hand-off, deep-link and
render-loop tests, was confirmed to fail against the defective code before being trusted.

## 7. Accessibility

axe-core: zero violations at page load, in each of the 6 chapters (scoped per chapter), and at
three sampled points mid-way through the intro's beat transitions, in all 3 engines. Independent
review 3 also ran axe 29 times across the intro (0 violations). Fixed during this build:
- a missing `<main>` landmark;
- panel transparency letting the WebGL glow drop text below 4.5:1;
- intro beats fading through 1.84:1 (now a clip-path wipe, always full colour);
- the desktop rail's active item at 3.4:1 over a red evidence plane (now an opaque backing);
- tap targets: rail 24px, mobile 44px including "Skip intro".

Lighthouse accessibility: 100 desktop, 100 mobile.

## 8. Visual QA

All three reviewers took their own screenshots rather than using committed ones. Three
compositions, each with its own navigation model:

| Width | Composition |
|---|---|
| >=1300px | Side rail, full WebGL |
| 768-1299px | Sticky top tabs, live verdict strip, full WebGL |
| <768px | Bottom tab bar, live verdict strip, 44px targets, no WebGL |

Review 3's judgement: "not a cosmetic relabel" for navigation and context; chapter bodies still
reflow by column count (disclosed). The rail no longer overlaps content anywhere; before, it
covered up to 129px of the content column between ~900px and 1280px wide. Screenshots:
`verification/SCREENSHOTS/` (per chapter at 1920x1080, 1440x900, 1024x768, 768x1024, 390x844,
360x740, plus mid-wipe intro frames). All three engines write the same filenames, so the committed set
comes from whichever engine finished last; file-size swings between runs are that, not
regressions. Each per-chapter shot waits until the nav marks that chapter active: an earlier
capture used a minimal scroll and showed chapter 4 under a tab bar still (correctly)
highlighting chapter 3.

## 9. Performance (production build, measured)

| Metric | Budget | Measured |
|---|---|---|
| Lighthouse desktop (perf/a11y/best-practices/SEO) | perf >=90 | 100/100/100/100 this run; perf has varied 71-100 across earlier runs on this shared machine (CPU contention, see `docs/PERFORMANCE_BUDGETS.md`) |
| Lighthouse mobile | perf >=80 | 98/100/100/100 (60 before WebGL was excluded below 768px) |
| LCP desktop / mobile | <=2.5s | 0.7s / 2.3s |
| CLS | <=0.1 | 0 |
| Total blocking time | | 0ms desktop and mobile |
| Frame pacing, headed real GPU | ~60fps, 0 dropped vs idle | ~115-120fps (display refresh), 0 dropped, forward and reverse |
| Idle render loop | none | `frameloop="demand"`, tested |

Raw data: `verification/lighthouse-{desktop,mobile}.json`, `verification/FRAME_PACING.json`.
Lighthouse was measured at `d4dfeac` and frame pacing earlier; the later code change (`6c82a86`)
only moves the desktop rail's right offset from 20px to 8px at >=1300px.

## 10. Independent reviews

1. **Vertical slice:** 0 P0, 3 P1: under-disclosed counterfactual scope; categorical search
   picking the most decisive flip instead of the minimal one; SYN-INT-001 untested and
   mislabelled. All fixed.
2. **Full integration (`421dcc5`), NOT ACCEPTED:**
   - Intro restarting whenever the page scrolled.
   - A global error listener killing the WebGL renderer on any unrelated error.
   - Stale ledger, README and RESUME.
   - Six required docs missing.
   - Mobile/tablet a reflow.
3. **Remediation recheck (`bc9b237`):** each blocker reproduced and confirmed fixed in all three
   engines; no new P0/P1. Its P2s, all fixed in `d4dfeac` or disclosed:
   - rail contrast over the canvas;
   - 34px skip button;
   - landing mid-page after scrolling during the intro;
   - the fallback's dependency on chunking, now pinned by `release:check`;
   - `unhandledrejection` not covered;
   - a stale comment;
   - stale TESTING/RESUME/ledger;
   - WebKit's small native selects (disclosed).

## 11. Fixed defects (by commit)

| Commit | Fixes |
|---|---|
| `8d748d8`, `072a203` | Review 1 findings; stale flip result on threshold change |
| `421dcc5` | WebKit crash on context loss blanking the app; 3 contrast failures; missing `<main>`; touch spacing |
| `a7a131a` | Intro restart under scrolling; unscoped WebGL error listener |
| `a51ab6f`, `7893b1f` | Stale ledger/README/RESUME; six missing docs |
| `cda37b6`, `c8ec0fb` | Release auditor; its own tree-clean ordering bug |
| `96b0a4a` | Three compositions; rail overlap at 900-1280px; rail target size |
| `ab6da96` | Intro contrast (clip-path wipe) |
| `d4dfeac` | Review 3's P2s |
| `6c82a86` | A regression `d4dfeac` itself introduced: the rail's new backing padding overlapped content by 2.2px at exactly 1300px. Caught by `release:check`'s 1300x800 overlap test in all 3 engines, not by review |

## 12. Known limitations

The current list is `docs/LIMITATIONS.md`. In short:
- **Analytical:** counterfactual search is single-feature; no live evaluator for the boosting
  model; linear SHAP is exact only under independence; 22% leakage is disclosed.
- **Data:** the data is from 1994.
- **Mobile:** no WebGL scene, and controls are enlarged rather than moved into a bottom sheet.
- **Layout:** chapter bodies reflow by column count; WebKit draws desktop selects small.
- **Measurement:** desktop Lighthouse varies run to run on this machine.
- **Process:** the ledger and docs are maintained by hand. They have been caught stale three
  times, and `release:check` verifies their structure, not every sentence.

## 13. Build and deployment readiness

- `npm run build` is clean.
- Every e2e test runs against the production preview.
- `npm run release:check` checks, against the committed tree: tree clean, required docs present,
  ledger complete, typecheck, lint, vitest, pytest, build, the chunking invariant, and Playwright
  across 3 engines with axe-core.
- **Not deployed.** The Vite `base` path for GitHub Pages is not set, and no repository exists.
  `docs/DEPLOYMENT.md` lists the steps. Stage B needs the user's explicit authorization
  (`SPEC_LOCK.md` section 3).

## 14. Verdict

**ACCEPTED for Stage A.** All five `EXECUTION_PROTOCOL.md` gates are met with evidence that was
independently re-derived:
- **G1 spec lock:** `specifications/`.
- **G2 analytical truth:** section 4, two cold retrains.
- **G3 functional build:** six real controls, none decorative.
- **G4 creative verification:** three reviewers inspected real screenshots, and there are three
  compositions.
- **G5 release evidence:** this report, the ledger, and `release:check`.

No P0 or P1 remains open. `d4dfeac` (the P2 fixes) was not independently reviewed; its one
regression was caught by `release:check`, which passes at `6c82a86`. The project is not described as deployed, because it is not.
