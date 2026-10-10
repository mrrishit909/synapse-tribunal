# SPEC_LOCK, Synapse Tribunal

Resolves the places where the Atlas dossier (`docs/projects/PROJECT_03.md`, Build Book p.13),
the executable contract (p.92), and the three pasted directives for this project disagree.
Precedence per `EXECUTION_PROTOCOL.md` p.78: verified user brief and approved reference images >
approved project-specific contract > execution protocol > original dossier > creative
inspirations. The contract (p.92, authoritative IDs) wins over the dossier's flavor text whenever
they conflict; the dossier fills in meaning where the contract is terse.

## 1. Interaction ID mapping (contract ID -> dossier flavor text -> final meaning)

| Contract ID | Contract behavior | Dossier flavor text | Locked meaning |
|---|---|---|---|
| SYN-INT-001 | Select case | "select sample > recompute display > dossier" | Pick a test-set case; recomputes its prediction, probability, and attribution panel. |
| SYN-INT-002 | Switch model | "Choose model > swap genuine predictions > evidence" | Toggle between the two real trained classifiers (logistic regression, gradient-boosted boosting); recomputes the same case's prediction under the other model. |
| SYN-INT-003 | Change threshold | "change threshold > confusion counts > precision/recall" | Slider over decision threshold; recomputes confusion-matrix counts and precision/recall live from the held-out test set. |
| SYN-INT-004 | Perturb valid feature | "perturb allowed feature > model inference/fixture > probabilities" | Edit one actionable feature within its valid domain; live TS model evaluation recomputes probability + attribution. This is the flagship interaction, see below. |
| SYN-INT-005 | View calibration | "inspect probability bin > draw calibration cohorts" | Click/select a probability bin; shows the real cohort of test cases in that bin and their observed outcome rate (reliability diagram). |
| SYN-INT-006 | Compare explanations | "request feasible counterfactual > candidate search > path" | **Resolved conflict**, see below. |

### The SYN-INT-006 conflict

The contract's ID (006, "compare explanations") and the dossier's own flavor text in that position
("feasible counterfactual search") describe two different features. Per precedence, the contract's
behavior label wins for what INT-006 *is*. But counterfactual search is not optional scope: the
dossier's "Methods" section names "valid counterfactual constraints" as a required method, and the
Validation section requires a test for "plausible counterfactual constraints." Dropping it would
violate a named analytical requirement.

**Resolution (revised after review):** INT-006 is implemented as "compare explanations" between
**two selected cases under the logistic model only**, diffing their per-feature attribution bars
side by side. The earlier draft of this lock also offered "a case under both models" as a second
mode; that mode is dropped because it is not implementable honestly: the boosting model has no
per-case attribution (`attribution_available: false`, see `model_manifest.json`), so there is
nothing real to diff it against. Showing a fabricated attribution for the boosting model to fill
that mode would violate the project's own labeling rule. Counterfactual search is folded into
**INT-004** as its second mode: after perturbing a feature, a "find nearest feasible flip" action
runs a real constrained search (only actionable features move, values stay in observed-domain
bounds, integer features snap to an integer and are re-verified) and returns the minimal-change
path that would cross the decision threshold, or an honest infeasibility reason if none exists.
This keeps all 6 contract IDs literal while still shipping the dossier's mandatory counterfactual
method, and reuses INT-004's live TS evaluator rather than requiring a second one.

## 2. Visual identity conflict

The Atlas dossier fixes the palette (#101116 / #DF514B / #F0EEE9, forensic typography,
documentary paper, red precision marks) as a **contract-level** requirement (Design Principles
p.80: hex values are a locked design token, not a suggestion). The "Everswap-level" directive's
"luminous computational landscape"/neural-terrain visual metaphor is explicitly framed in its own
text as a *suggested, provisional* direction ("subject to the actual Atlas requirements... These
are artistic possibilities, not permission to change the project's specified functionality") and
that same directive instructs avoiding generic neon/neural-network stock imagery.

**Resolution:** the Atlas forensic-dossier identity (#101116/#DF514B/#F0EEE9, documentary paper,
red precision marks, asymmetric editorial grid) is the locked design system. Everswap is read for
*craft techniques*, camera continuity, persistent world, material/lighting sophistication, motion
grammar, applied to the forensic identity, not for its color story or landscape metaphor. The
spatial world is a courtroom/evidence-room architecture (sealed dossier -> model vote -> evidence
unfolding -> inspector), not a terrain/neural landscape.

## 3. Scope boundary: Stage A vs Stage B

Per the CTY/CASCADIA precedent and the "preapproved development scope" section of the first
pasted directive: this work is authorized as local, reversible development inside
`~/synapse-tribunal` only. GitHub repo creation, public push, and Pages deployment are **Stage B**
and require separate explicit authorization, exactly as they did for Counterfactual City. Nothing
in this build will push publicly or deploy without that separate ask.

## 4. Persistent execution

No new LaunchAgent/launchd runner is installed without asking first, CASCADIA's own
`automation/com.cascadia.overnight-runner.plist` exists as precedent but installing a new one is
system configuration, not reversible local dev work. This session's own background-job execution
model is the persistence mechanism; `execution/RESUME.md` is the cold-resume contract if this
session ends mid-build.

## 5. Dataset

**Locked: Adult Income (OpenML id 1590, v2)**, 48,842 rows, public-domain US Census source,
license/provenance recorded in `research/data/raw/MANIFEST.json` and
`specifications/DATA_CONTRACT.yaml`. Binary task (income <=/>50K). Actionable features: workclass,
education-num, occupation, capital-gain, capital-loss, hours-per-week. Immutable (never perturbed,
never a counterfactual lever): age, marital-status, relationship, race, sex, native-country.
`fnlwgt` dropped (sampling weight, not a feature of the individual); `education` dropped as
redundant with `education-num`. Full reasoning per-field in `DATA_CONTRACT.yaml`.
