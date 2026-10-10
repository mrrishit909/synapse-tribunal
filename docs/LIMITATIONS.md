# Limitations

Honest, current-state record of what this build does not do, referenced from code comments
(`src/engine/counterfactual.ts`) and specs (`specifications/INTERACTIONS.yaml`) rather than left
as a dangling citation. Updated as the build progresses; this is not a final release document
(see `verification/` once SYN-RELEASE-001 closes for that).

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

## Interface (current build: vertical slice only)

- Only SYN-INT-001 (select case) and SYN-INT-004 (perturb + single-feature flip search) are
  implemented. SYN-INT-002/003/005/006 do not exist yet.
- Only one scene exists (the flagship "Tribunal" interaction); none of the six narrative
  chapters or the cinematic intro are built yet.
- **Mobile is a single-column reflow of the desktop layout**, not yet the deliberately distinct
  touch-first composition the Atlas stack guidance calls for (bottom-sheet controls, reframed
  camera/spatial treatment). Functional and legible, verified by real screenshot, but not yet a
  separately art-directed mobile composition. Scoped to the full responsive-design pass.
- No cross-browser testing yet (Chromium only via Playwright's default project).

## Process

- No automated `release:check` auditor or `execution/tasks.json` ledger exists yet (the V2
  directive's full machine-readable controller). `specifications/REQUIREMENTS.yaml` is
  maintained by hand; an independent review already caught one row (SYN-INT-001) that was
  incorrectly marked `unstarted` despite being implemented, so treat this file's status as
  indicative, not infallible, until the full suite closes and a release auditor exists to check
  it mechanically.
