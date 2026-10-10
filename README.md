# Synapse Tribunal

A prediction, placed on trial: real classifier attribution, counterfactual search, and
contradictory-case evidence, computed live in the browser against a model trained offline.

Project 03 of the Creative Engineering Atlas. See `specifications/SPEC_LOCK.md` for the
authoritative spec decisions, `specifications/REQUIREMENTS.yaml` for current build status, and
`docs/LIMITATIONS.md` for what this build does and does not do right now.

**Current state:** one feature slice built and independently reviewed (SYN-INT-001 select case,
SYN-INT-004 perturb + single-feature counterfactual search). The remaining four interactions,
six narrative chapters, and cinematic intro are not yet built.

## Run it

```bash
npm install
npm run dev          # local dev server
npm run build        # tsc -b && vite build
npm run preview       # serve the production build locally
npm run test          # vitest
npm run test:e2e      # playwright, against the production build
```

The analytical engine (dataset fetch, model training, fixture export) is Python, in a separate
venv:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
export SSL_CERT_FILE=$(.venv/bin/python -c "import certifi; print(certifi.where())")
.venv/bin/python -I research/ingest/fetch_adult.py   # fetches data/raw/adult_raw.csv
.venv/bin/python -I research/models/train.py          # trains both models, exports fixtures
.venv/bin/python -I -m pytest tests/unit -q            # reference-engine test suite
```

## Stack

React + TypeScript + Vite, GSAP for motion, scikit-learn for the offline reference models, a
manifest-driven TypeScript port of the logistic model for live in-browser recomputation
(`src/engine/`), Playwright + Vitest + pytest for testing. See `docs/ARCHITECTURE.md` once it
exists (not yet written at this stage of the build).
