# Synapse Tribunal

A prediction, placed on trial: real classifier attribution, counterfactual search, and
contradictory-case evidence, computed live in the browser against a model trained offline.

Project 03 of the Creative Engineering Atlas. See `specifications/SPEC_LOCK.md` for the
authoritative spec decisions, `specifications/REQUIREMENTS.yaml` for current build status, and
`docs/LIMITATIONS.md` for what this build does and does not do right now.

**Current state:** all 6 required interactions, all 6 narrative chapters, the cinematic intro,
and a persistent WebGL background renderer (React Three Fiber, driven by the same live
analytical state the 2D UI shows) are built and tested across Chromium/Firefox/WebKit, including
an axe-core accessibility sweep. Independently reviewed twice: once on the vertical slice
(SYN-INT-001/004, 0 P0/3 P1, all fixed) and once as a full-integration review of the complete
build (0 P0/2 P1, both fixed with regression tests proven to fail against the defective code
first). Desktop, tablet and mobile are three separate compositions (side rail / sticky top tabs
plus a live verdict strip / bottom tab bar, no WebGL, 44px touch targets); see
`docs/VISUAL_DESIGN.md`. Per-requirement status: `specifications/REQUIREMENTS.yaml`. Full
release record: `verification/SYNAPSE_TRIBUNAL_FINAL_ACCEPTANCE_REPORT.md`. Live at
https://mrrishit909.github.io/synapse-tribunal/ (Stage B, authorized by the user 2026-10-11); publication record:
`verification/SYNAPSE_TRIBUNAL_PUBLICATION_REPORT.md`. Case study:
https://mrrishit909.github.io/projects/synapse-tribunal/. Remaining
limitations: `docs/LIMITATIONS.md`.

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

```bash
npx playwright install chromium firefox webkit   # if not already installed
npx playwright test                               # runs all e2e + axe-core tests, 3 browsers
```

## Stack

React + TypeScript + Vite, GSAP + ScrollTrigger for 2D motion, React Three Fiber/Three.js for
the persistent WebGL background (lazy-loaded, never fetched on mobile viewports or when WebGL
is unavailable), scikit-learn for the offline reference models, a manifest-driven TypeScript
port of the logistic model for live in-browser recomputation (`src/engine/`), Playwright
(Chromium/Firefox/WebKit) + axe-core + Vitest + pytest for testing. See `docs/ARCHITECTURE.md`
for the full system design.
