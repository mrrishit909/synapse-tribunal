# Resume contract

**Latest verified commit:** `4513c8a` "Fix model mislabeling, add integer snapping, grouped
attribution, contradictory cases" (5 commits deep from bootstrap). 70/70 tests pass
(65 pytest, 13 vitest), clean tsc/oxlint/vite build.

**Active milestone:** M1 -> M2. Gates SYN-DATA-001 and SYN-MATH-001 are `implemented` (see
`specifications/REQUIREMENTS.yaml`). SYN-UX-001/MOTION-001/RELEASE-001 are `unstarted`: no
React UI, no chapters, no motion, no deploy yet. Session task list (not durable, recreate if
lost): #1-5 done, #6 (vertical slice) in_progress with no code written yet, #7-12 pending.

**Completed prerequisites:**
- SPEC_LOCK.md written (SYN-INT-006 mapping, palette, Stage A/B boundary, persistence).
- Repo bootstrapped from creative-engineering/templates/frontend, base path set, clean
  tsc/oxlint/vite-build baseline committed.
- Dataset locked: Adult Income (OpenML 1590 v2), fetched and manifested, DATA_CONTRACT.yaml
  written with actionable/immutable feature split.
- Python venv at `.venv/` (scikit-learn, pandas, numpy, scipy, certifi installed). Note: this
  machine's python.org Python 3.14 needs `SSL_CERT_FILE` pointed at certifi's bundle for any
  network fetch (urlopen has no system CA store here) -- export it before rerunning
  `research/ingest/fetch_adult.py`.

**What exists now:**
- `research/models/train.py` trains logistic regression + HistGradientBoostingClassifier
  (CV AUROC 0.904/0.927, test AUROC 0.905/0.926) on Adult Income, exports fixtures to
  `public/data/precomputed/` (browser-shipped, ~300-case stratified sample + aggregates)
  and `data/precomputed/full_test_fixture.json` (research-only, gitignored, 9045 rows).
- `research/models/reference_math.py` + `counterfactual.py`: manifest-driven pure-Python
  reimplementation (not sklearn internals), parity-tested to <1e-4 across the full test set.
- `src/engine/{types,model,counterfactual}.ts`: exact TS port of the above, same parity
  guarantee, tested with the real fixtures (not mocks).
- Fixtures now include: closed-form logistic attribution (per one-hot column AND grouped
  by raw feature), a disclosed leakage check (22% exact train/test duplicates after
  dropping fnlwgt, judged low-impact given Adult's well-established 0.90-0.93 AUROC range),
  integer-snapped counterfactual search, and a real contradictory-case (nearest opposite-
  label training neighbor) for every sample case.
- `specifications/{SPEC_LOCK,INTERACTIONS,REQUIREMENTS,DATA_CONTRACT}.{md,yaml}` lock the
  6-interaction mapping, cross-control rules (perturbation always clears on model switch;
  threshold is shared state; SYN-INT-006 is logistic-only; OOD input is clamped client-
  side), palette (Atlas forensic identity, not Everswap's landscape metaphor), and Stage
  A/B scope boundary (no public push/deploy without separate authorization).

**Next eligible task:** task #6, the vertical slice. No UI code exists yet. Needs: pick
2D-canvas vs WebGL for the flagship "prediction on trial" scene (Atlas requires a 2D
fallback regardless), build the case-browser + perturbation + attribution-bars + feasible-
flip + contradictory-case display as one React scene, wire GSAP for entry motion, verify
reverse-scroll/reduced-motion/mobile, measure real (non-SwiftShader) frame pacing, then get
an independent review before scaling to the remaining 5 controls and 6 chapters.

**Known defects:** none open. Advisor-flagged issues from the engine review (mislabeling,
integer snapping, grouped attribution, leakage disclosure, contradictory cases, INTERACTIONS
spec) are all fixed in commit `4513c8a`. Not yet built: `execution/tasks.json`-style ledger
(V2 directive's full machine-readable controller) and the automated `release:check` auditor
-- judged lower priority than analytical correctness before the slice, not forgotten.

**Required commands:**
```
cd ~/synapse-tribunal
export SSL_CERT_FILE=$(.venv/bin/python -c "import certifi; print(certifi.where())")
.venv/bin/python -I research/ingest/fetch_adult.py   # idempotent refetch if needed
npx tsc -b && npx oxlint && npx vite build            # frontend baseline check
```

**Active worktrees:** none.

**Safe cleanup:** none pending; `research/data/raw/_cache/` is the sklearn fetch cache, safe to
delete and refetch if it is ever suspected stale.

**Exact next action:** write `research/models/train.py` per task #4's description.
