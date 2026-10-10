# Resume contract

**Latest verified commit:** see `git log -1 --oneline` (bootstrap baseline, commit 7432e47,
plus dataset/spec-lock additions committed alongside this file).

**Active milestone:** M0 -> M1 (source/dataset viability done; building the reference ML engine
and fixture pipeline, task #4 of the session task list).

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

**Next eligible task:** build the Python reference engine (task #4): train logistic regression
+ bounded gradient-boosted forest with CV inside a single pipeline (fit preprocessing on train
fold only), compute AUROC/PR-AUC/Brier/calibration, closed-form logistic SHAP, and a constrained
counterfactual search over actionable features only. Export typed JSON fixtures + a manifest
binding them to model/code versions.

**Known defects:** none yet, nothing built past data ingestion.

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
