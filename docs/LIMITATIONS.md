# Limitations

Honest, current-state record of what this build does not do. Referenced from code comments
(`src/engine/counterfactual.ts`) and specs (`specifications/INTERACTIONS.yaml`). The release
record is `verification/SYNAPSE_TRIBUNAL_FINAL_ACCEPTANCE_REPORT.md`.

## Analytical

- **Counterfactual search is single-feature only.** `findFeasibleFlip` varies exactly one
  actionable feature, holding every other value fixed, and reports "no feasible flip" if that
  one feature alone cannot cross the threshold within its observed range/categories. A real
  multi-feature nearest-counterfactual (the combination of several smaller changes) may exist
  even when the single-feature search finds none. This scope is stated in the UI itself
  (`.flip-scope-note` in the Tribunal scene), not only in code comments.
- **No live evaluator for the boosting model.** `HistGradientBoostingClassifier`'s tree
  internals are not public sklearn API the way logistic regression's coefficients are, so no
  TypeScript port exists for it. Perturbation (SYN-INT-004) is only ever evaluated against the
  logistic model; switching models clears any active perturbation rather than showing a stale
  or fabricated boosting-model result.
- **Attribution is linear-SHAP, exact only under feature independence.** `attribution_method`
  in `model_manifest.json` states this; correlated features (e.g. education and occupation)
  make it an approximation, not an exact Shapley decomposition, in that case.
- **22% of the test set exactly duplicates a train row** once the `fnlwgt` sampling-weight
  column is dropped (see `model_manifest.json.leakage_check`). Reported test AUROC/Brier are
  somewhat optimistic for that subset. Adult's AUROC is well-established at 0.90-0.93 in the
  literature independent of this specific split, so the effect is judged unlikely to be large;
  a grouped train/test split that removes the duplicates is the honest fix and is recorded here
  as future work, not applied.
- **1994 US Census data.** Income thresholds and occupational categories reflect that period's
  economy, not current ones.

## Interface

All 6 interactions, all 6 chapters, the cinematic intro, and the persistent WebGL stage are
built and tested in Chromium, Firefox and WebKit. What remains limited:

- **Mobile has no WebGL scene.** Below 768px the WebGL chunk is never fetched (an Atlas
  requirement for this project, and a measured performance fix: mobile Lighthouse went from 60
  to 96-98). Mobile gets a static gradient background instead of the evidence chamber.
- **Mobile controls are larger, not re-architected.** The phone composition has its own nav (a
  fixed bottom tab bar), a live verdict strip, and 44px minimum touch targets, but the
  perturbation controls are still the same slider/select stack as tablet, not a bottom-sheet.
  The Atlas stack guidance mentions bottom-sheet controls; that specific pattern is not built.
- **Chapter bodies reflow by column count.** The three compositions differ in navigation, the
  live verdict strip, touch sizing and whether the WebGL scene loads; inside each chapter the
  layout is the same content reflowing (e.g. the feature reader goes 3, 2, 1 columns).
- **Sliders keep the browser's native track.** `accent-color` makes the filled part and thumb
  the case-file red, but Chromium and Firefox still draw the unfilled track near-white; a fully
  custom range style was not built.
- **The WebGL scene can show faintly through panels.** Panels are 0.97 opaque, so a bright
  wireframe line behind chapter 6's closing text is visible (text contrast stays above AA; the
  live-site verification read it as readable). Playwright's WebKit also draws no backdrop blur.
- **Desktop Lighthouse varies run to run on this machine** (71/97/100 across three identical
  runs, traced to CPU contention from unrelated processes). See `PERFORMANCE_BUDGETS.md`.
- **The live verdict strip (tablet/mobile) is `aria-hidden`.** It duplicates the chapter 1
  verdict badge, which is already a `role="status"` live region; screen-reader users get the
  badge's announcement, not two.

## Not deployed

Stage B (public repository, GitHub Pages, portfolio integration) has not happened and needs
separate explicit authorization (`specifications/SPEC_LOCK.md` section 3). The Vite `base` path
(`/synapse-tribunal/`) and the Pages workflow are in place; see `docs/DEPLOYMENT.md`.

## Process

- `specifications/REQUIREMENTS.yaml`, `README.md`, `execution/RESUME.md`, and this file are
  maintained by hand, and each has been caught stale at least once during this build. `npm run
  release:check` mechanically checks that no requirement is left `unstarted`/`blocked` and that
  the required docs exist, not that every sentence in them is current.
- No `execution/tasks.json` machine-readable task ledger (the V2 directive's fuller controller).
