# Resume contract

**Latest verified commit:** `072a203` "Fix stale flip result on threshold change; add
threshold reset; Brier/ROC reconciliation tests" (14 commits deep from bootstrap).
69/69 pytest, 24/24 vitest, 11/11 Playwright, clean tsc/oxlint/vite build.

**Active milestone:** M2 complete (six scene architecture with real state and reset) for
the single-scene "laboratory" stage; M4 (motion choreography) and the six-chapter
restructuring have not started. Gates: SYN-DATA-001 and SYN-MATH-001 `implemented`;
SYN-UX-001 `implemented` (6/6 controls, 2/6 independently reviewed); SYN-MOTION-001 and
SYN-RELEASE-001 `unstarted`. See `specifications/REQUIREMENTS.yaml` for per-requirement
detail. Session task list (not durable, recreate if lost): #1-8 done (task #8's "6 controls"
half; its "6 narrative chapters" half is NOT done and should probably become its own task),
#9-12 pending.

**What exists now:**
- Full analytical foundation (Python + TS engines, cross-verified, 4 fixtures), see the
  earlier section of this file's history in git log for that detail; unchanged since.
- `src/scenes/Tribunal.tsx`: ONE scene (not yet six chapters) implementing all 6 required
  interactions (SYN-INT-001 through 006) as a flat stack of 9 panels: case browser, model
  switch, feature evidence, perturbation + feasible-flip search, decision threshold +
  confusion matrix, calibration bins, case comparison, attribution bars, contradictory case.
- `src/engine/useFixtures.ts` loads all 4 browser fixtures (manifest, ~300-case sample,
  threshold sweep, calibration) in one `Promise.all`.
- GSAP entrance: one quick (<350ms) fade-up on the whole panel group, not a long per-panel
  cascade, an earlier version's 1.2s stagger left panels invisible in a real screenshot
  while every functional test still passed (opacity:0 isn't "hidden" to Playwright); fixed,
  and the e2e suite now asserts opacity===1 explicitly so this can't regress silently.
- `e2e/tribunal.spec.ts` (11 tests) and `src/scenes/Tribunal.test.tsx` (10 tests, mocking
  fetch with the real fixture files) cover all 6 interactions, keyboard operability,
  reduced motion, and 3-breakpoint screenshots with no horizontal overflow.
- An independent worktree-isolated review (no access to this session) passed the vertical
  slice (SYN-INT-001, 004) with 0 P0 / 3 P1, all fixed and reverified: UI never disclosed
  the counterfactual search's single-feature scope (now shown inline), the categorical
  search picked the most-decisive flip instead of the minimal one (contradicted its own
  SPEC_LOCK description, fixed with a brute-force regression test in both languages), and
  SYN-INT-001 was marked `unstarted` in the ledger despite being fully built and untested
  (both fixed). SYN-INT-002/003/005/006 have NOT yet had an independent review pass.
- `docs/LIMITATIONS.md` created (was a dangling citation from 3 places).

**Deliberate decision, not an oversight:** no WebGL/persistent 3D renderer. SPEC_LOCK.md
section 2 locks the Atlas's forensic 2D identity over the "Everswap-level persistent WebGL
stage" language in later pasted directives, reasoning from the Atlas's own "3D only where
analytically justified" / "do not force every element into a perspective-transformed world"
and the CASCADIA/CTY precedent (the no-3D build scored cleanly on performance). An advisor
consultation flagged this as a possible contract violation under a literal reading of the
Everswap directive; the decision was reaffirmed, not reopened, given it's recorded reasoning
against a real precedent rather than an accident. If the user wants it reopened, that's a
material decision for them to make explicitly, not something to flip silently.

**Next eligible task:** restructure the single flat scene into the Atlas's actual 6
narrative chapters (dossier names: Prediction / training context / feature attribution /
thresholding / calibration / verdict) plus the 0-12s cinematic intro (sealed dossier -> model
vote -> evidence unfolds -> confidence challenged/inspector opens), each with its own
distinct composition (not 6 copies of the same panel style), entry/exit/reverse-scroll/
reduced-motion treatment. A candidate chapter mapping is in the independent-review advisor
notes (not yet written into SPEC_LOCK, do that first, same precedence process as every
other spec decision in this file's history).

**Known defects:** none open as of this commit.

**Process debt (intentionally deferred, not forgotten):** no `execution/tasks.json` machine-
readable ledger or automated `release:check` auditor (V2 directive's full controller)
`specifications/REQUIREMENTS.yaml` is maintained by hand and has already been caught out of
sync with reality once (see above). Build the real ledger/auditor before final acceptance at
the latest, ideally before the chapter restructuring generates more rows to track by hand.
No Everswap visual-forensics document (`docs/EVERSWAP_VISUAL_FORENSICS.md`) exists, skipped
because the 2D identity decision above makes most of its findings inapplicable (camera/
material/lighting techniques for a 3D world this build isn't building), not because it was
overlooked; if the renderer decision is ever reopened, that document becomes a prerequisite
again, not optional.

**Required commands:**
```
cd ~/synapse-tribunal
export SSL_CERT_FILE=$(.venv/bin/python -c "import certifi; print(certifi.where())")
.venv/bin/python -I -m pytest tests/unit -q   # 69 tests
npx tsc -b && npx oxlint && npx vitest run && npx vite build && npx playwright test
```

**Active worktrees:** none (the independent-review worktree was cleaned up after its report).

**Safe cleanup:** none pending; `research/data/raw/_cache/` is the sklearn fetch cache, safe
to delete and refetch if ever suspected stale.

**Exact next action:** write the chapter mapping into `SPEC_LOCK.md`, then restructure
`Tribunal.tsx`'s single scene into six chapter components sharing the engine/fixtures but
each with its own composition, per `docs/projects/PROJECT_03.md`'s chapter list and
`MOTION_REQUIREMENTS.md`'s "distinct composition... while sharing typography and
interaction tokens."
