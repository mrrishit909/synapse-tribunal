# Visual Design

## Identity (locked, `specifications/SPEC_LOCK.md` section 2)

Forensic dossier: a case file placed on trial, not a generic AI dashboard. Palette:

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#101116` | Base background |
| `--paper` | `#f0eee9` | Body text |
| `--accent` | `#df514b` | Headings, active states, verdict stamps, the evidence core's color |
| `--paper-dim` | `#c9c6bd` | Secondary text, inactive nav links |
| `--ink-line` | `#2a2b31` | Borders, dividers |

Typography is entirely web-safe (no external font fetch, a deliberate LCP/performance choice over
a marginal typographic upgrade): `Courier New`/`IBM Plex Mono` for data/labels (the "typewritten
case file" register), Georgia/Times New Roman for body prose, system-ui for interactive controls.

## Motifs

- **Stamps**: `not editable` / `perturbed` tags on feature-evidence rows, styled like a rubber
  stamp (bordered, uppercase, small-caps letterform).
- **Precision marks**: the red accent border on the verdict badge, drawn like a case-file
  annotation, not a rounded modern "card."
- **Redaction-adjacent language**: immutable features are never rendered as disabled-looking
  inputs; they render as plain text with a stamp, because a disabled `<input>` implies "you could
  edit this if something changed," which is false for a protected-characteristic feature.

## Six distinct chapter compositions (not six copies of one panel style)

| Chapter | Composition | Visual distinction |
|---|---|---|
| 1 Prediction | Hero | Thick accent border, the verdict stamp as the focal point |
| 2 Training context | Editorial two-column split | Contradictory case / data provenance side by side |
| 3 Feature attribution | Inspector | Left accent bar (flagship chapter), dense control cluster |
| 4 Thresholding | Diagnostic | Darker background (`#0a0a0d`), confusion-matrix grid |
| 5 Calibration | Grid | Chip-grid of 10 calibration bins |
| 6 Verdict | Comparative | Side-by-side attribution comparison, closing prose |

## The WebGL layer as a visual element, not decoration

The persistent evidence-core/attribution-plane scene (`src/webgl/Scene.tsx`) is visible through
the semi-transparent chapter panels (`background: rgba(16, 17, 22, 0.97)` -- raised from an
initial 0.88 after axe-core caught a real WCAG contrast failure: the scene's bright red glow
could blend through and drop text contrast below 4.5:1 depending on what the scene happened to be
rendering at that moment). The panels now guarantee text contrast is never a function of live
scene content, while the gaps between panels (header, margins) remain the main place the
persistent world is visible.

## Responsive compositions

Three deliberate compositions, each with its own navigation model, not one layout reflowing:

| Width | Navigation | Verdict while editing | Scene | Touch |
|---|---|---|---|---|
| >=1300px (desktop) | Fixed side rail in the right margin | Chapter 1 badge only; the wide layout keeps context close | Full WebGL evidence chamber | 24px rail targets |
| 768-1299px (tablet/laptop) | Sticky top tab bar, short labels, active tab underlined | Live verdict strip pinned under the tab bar once chapter 1 scrolls away | Full WebGL | 46px tabs |
| <768px (mobile) | Fixed bottom tab bar, chapter numbers only, thumb-reachable | Live verdict strip pinned to the top | No WebGL (never fetched), static gradient | 44px minimum on every control |

Why the verdict strip exists: on a narrow screen the perturbation controls (chapter 3) and the
threshold (chapter 4) are several screens below the verdict badge, so editing a feature used to
mean scrolling back up to see what it did. The strip shows the same `liveResult.proba` the badge
does, so the effect of an edit is visible where the edit happens.

Why the rail starts at 1300px: the earlier layout put the fixed rail at every width above 900px.
Measured, it overlapped the 920px content column by up to 129px anywhere from ~900px to 1280px
(laptop widths no test viewport had covered). The rail now only appears where the margin can hold
it, and `e2e/tribunal.spec.ts` checks rail/content overlap at nine widths from 360 to 1920.

What mobile still lacks is listed in `docs/LIMITATIONS.md` (no WebGL scene; controls enlarged
rather than moved into a bottom sheet).

## Reference inspiration, not imitation

The Everswap-reference direction (camera continuity, persistent visual world, material/lighting
sophistication) is applied through this project's own forensic identity and 2D/WebGL hybrid
staging -- no proprietary artwork, branding, or layout was copied; see `SPEC_LOCK.md` section 7
for the full reasoning on how that reference was read as technique, not template.
