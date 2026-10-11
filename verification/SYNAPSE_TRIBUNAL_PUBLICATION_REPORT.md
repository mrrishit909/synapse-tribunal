# Synapse Tribunal: Publication Report (Stage B)

**Date:** 2026-10-11. **Authorized by:** the user, in chat, the same day.
**Verdict: PUBLISHED AND INDEPENDENTLY VERIFIED.**

| | |
|---|---|
| Live site | https://mrrishit909.github.io/synapse-tribunal/ |
| Repository | https://github.com/mrrishit909/synapse-tribunal (public) |
| Case study | https://mrrishit909.github.io/projects/synapse-tribunal/ |
| Deployed app commit | `d55fa92` (Pages run 38118845022, success) |

Commits after `d55fa92` change docs and evidence only. Each push redeploys, and the live
JavaScript and CSS are checked byte for byte against the local `dist/` after every deploy.

## 1. Before publication

- **Independent review of everything since the last adversarial review (`bc9b237`):**
  - Verdict PUBLISH, with no P0 or P1.
  - Its P2s were fixed before the first push in `2a139b4`:
    - rail idle text was 4.62:1 against a documented 7.8:1; the backing is now 0.97 and idle
      opacity 0.75, which gives at least 6.34:1 even over a white canvas;
    - the Pages workflow gave deploy permissions to the build job; they are now on the deploy
      job only;
    - `LIVE_SCREENSHOTS/` was not gitignored;
    - five docs said the base path was unset.
- **Release check:** `npm run release:check` passed on the exact commit pushed, every time.
- **Clean clone:** typecheck, lint, Vitest and the build all pass from a fresh clone.
- **Secrets:** a scan of the full history found no secrets.

## 2. Deployments

| Commit | Why | Release check on that commit | Live suite |
|---|---|---|---|
| `7570516` | First publication | PASS | 156/156 |
| `6ae6d6d` | Fixes from the first live verification | PASS | 173/174; the one failure was a timing race in a test, fixed and mutation-checked in `9b11b54` |
| `d55fa92` | Fixes from the live recheck | PASS | **189/189** |

## 3. Live verification of `d55fa92`

- **Full Playwright suite against the public URL:** 189/189 (63 tests in each of Chromium,
  Firefox and WebKit). It includes axe-core in every chapter, WCAG 2.2 AA at 768px and 390px, and
  axe mid-way through the intro.
- **Lighthouse on the public URL:**

  | | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
  |---|---|---|---|---|---|---|---|
  | Mobile | 99 | 100 | 100 | 100 | 1.7s | 0 | 0ms |
  | Desktop | 100 | 100 | 100 | 100 | 0.4s | 0 | 0ms |

  Raw data is in `verification/LIVE_VERIFICATION/`.
- **curl:** every asset, the four JSON fixtures, the WebGL chunk and the favicon return 200.
- **Screenshots:** pages captured from the public site at desktop, tablet and phone widths
  (chapters 1, 3 and 5) are in `verification/LIVE_VERIFICATION/`. They were opened and read.

## 4. Independent live verification

Three passes were run by agents that did not build the site, using their own scripts:

1. **Against `7570516`: VERIFIED, with P2s.**
   - All URLs, controls and figures checked out.
   - The verifier re-implemented the logistic model from the published manifest. It matched all
     300 fixture probabilities to within 5e-7, and the counterfactual searches were confirmed
     minimal.
   - P2s found, all fixed in `f63802f` (deployed as `6ae6d6d`) with regression tests that failed against the deployed
     code first:
     - chapter 6 could compare a case with itself;
     - chapter 3 silently reverted one edit when another was made;
     - chapter 5 had no initial state;
     - native controls were unstyled.
2. **Against `6ae6d6d`: NOT VERIFIED.** Two problems remained, both fixed in `d55fa92` with
   failing-first tests:
   - tablet nav labels were not inside their accessible names, and the number and name were
     glued together;
   - WebKit drew selects 23px tall, failing axe target-size.
3. **Against `d55fa92`: VERIFIED.**
   - Both findings fixed in all three engines.
   - Earlier fixes still pass: 46/46 checks per engine.
   - axe: 0 violations across 24 runs per engine.
   - No console errors, failed requests or horizontal overflow.

## 5. Portfolio

The case study, cover (captured from the real app), motion tile and home-shelf record are live:
- every link on the case study page returns 200;
- searching "synapse" on the shelf finds the record, which opens the case study;
- every figure drawn on the motion tile appears in the case study text.

## 6. Not fixed (P3 or disclosed)

- **Slider tracks:** in Chromium and Firefox the unfilled part of each slider stays near-white
  (listed in `docs/LIMITATIONS.md`).
- **WebGL show-through:** the scene shows faintly through the 0.97-opaque panels. Text stays
  above AA.
- **Tablet tab bar:** at 768px it is 0.96 opaque, so the page subtitle shows faintly through it.
- **Select corners:** WebKit rounds them slightly.
- **CI coverage:** CI does not run Playwright or pytest. The full gate is a local step before
  each push (`docs/LIMITATIONS.md`).
- **Portfolio footer contrast:** the shared case-study footer is 1.95:1 and fails axe on every
  case study. This comes from the portfolio template, not this project, and was left untouched.
- **Commit author:** commits use a local-hostname email, the same as the already-public
  CASCADIA repo.
