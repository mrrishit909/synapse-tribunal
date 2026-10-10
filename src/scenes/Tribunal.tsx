import { Suspense, lazy, useRef, useState } from 'react'
import { findFeasibleFlip } from '../engine/counterfactual'
import { featureLabel, formatProbability, formatValue } from '../engine/format'
import { groupAttributionByFeature, logisticAttribution, logisticProba } from '../engine/model'
import type { CounterfactualResult, ModelManifest, RawCase, TestFixtureRow } from '../engine/types'
import { useFixtures } from '../engine/useFixtures'
import { useChapterReveal } from '../motion/useChapterReveal'
import { useReducedMotion } from '../motion/useReducedMotion'
import ChapterNav from './ChapterNav'
import IntroSequence from './IntroSequence'
import WebGLErrorBoundary from '../webgl/WebGLErrorBoundary'
import { useIsMobileViewport } from '../webgl/useIsMobileViewport'
import { useScrollProgress } from '../webgl/useScrollProgress'
import '../webgl/WebGLStage.css'

// Lazy-loaded so Three.js/@react-three/fiber (the bulk of the WebGL stack) are a
// separate chunk, fetched after the 2D chapter shell's own initial render commits, per
// docs/PERFORMANCE_BUDGETS.md's "initial JS payload must not block first paint" budget.
const WebGLStage = lazy(() => import('../webgl/WebGLStage'))
import './Tribunal.css'

function clampToBounds(manifest: ModelManifest, feature: string, value: number): number {
  const [lo, hi] = manifest.numeric_observed_bounds[feature]
  return Math.min(hi, Math.max(lo, Math.round(value)))
}

function RawReader({
  manifest,
  caseRow,
  perturbedFeature,
  perturbedValue,
}: {
  manifest: ModelManifest
  caseRow: TestFixtureRow
  perturbedFeature: string | null
  perturbedValue: number | string | null
}) {
  return (
    <dl className="dossier-fields">
      {manifest.feature_order_raw.map((feature) => {
        const isActionable =
          manifest.actionable_numeric.includes(feature) || manifest.actionable_categorical.includes(feature)
        const isPerturbed = feature === perturbedFeature
        const displayValue = isPerturbed ? perturbedValue! : caseRow.raw[feature]
        return (
          <div
            key={feature}
            className={`dossier-field${isActionable ? ' is-actionable' : ' is-immutable'}${isPerturbed ? ' is-perturbed' : ''}`}
          >
            <dt>{featureLabel(feature)}</dt>
            <dd>
              {formatValue(displayValue)}
              {!isActionable && <span className="redacted-stamp">not editable</span>}
              {isPerturbed && <span className="perturbed-stamp">perturbed</span>}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function AttributionBars({ attribution }: { attribution: Record<string, number> }) {
  return (
    <ul className="attribution-bars">
      {Object.entries(attribution)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .map(([feature, value]) => (
          <li key={feature} className={value >= 0 ? 'is-positive' : 'is-negative'}>
            <span className="bar-label">{featureLabel(feature)}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${Math.min(100, Math.abs(value) * 40)}%` }} />
            </span>
            <span className="bar-value">
              {value >= 0 ? '+' : ''}
              {value.toFixed(3)}
            </span>
          </li>
        ))}
    </ul>
  )
}

export default function Tribunal() {
  const fixtures = useFixtures()
  const reducedMotion = useReducedMotion()
  const scrollProgress = useScrollProgress()
  const isMobileViewport = useIsMobileViewport()
  const sceneRef = useRef<HTMLElement>(null)
  const [introDone, setIntroDone] = useState(false)

  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [activeModel, setActiveModel] = useState<'logistic' | 'boosting'>('logistic')
  const [threshold, setThreshold] = useState(0.5)
  const [perturbation, setPerturbation] = useState<{ feature: string; value: number | string } | null>(null)
  const [flipResult, setFlipResult] = useState<CounterfactualResult | null>(null)
  const [flipTarget, setFlipTarget] = useState<string>('')
  const [comparisonCaseId, setComparisonCaseId] = useState<number | null>(null)
  const [calibrationBinIndex, setCalibrationBinIndex] = useState<number | null>(null)

  // Derived defaults once fixtures resolve, rather than an effect that calls setState on
  // mount: the fixture data is the external system being synchronized, and these are pure
  // "pick the first one" defaults, not a reaction to any later external change.
  const effectiveSelectedCaseId =
    selectedCaseId ?? (fixtures.status === 'ready' ? fixtures.fixture.rows[0]?.id ?? null : null)
  const effectiveFlipTarget =
    flipTarget || (fixtures.status === 'ready' ? fixtures.manifest.actionable_numeric[0] ?? '' : '')

  // Scroll-driven, reversible per-chapter entrance (src/motion/useChapterReveal.ts).
  // Replaces an earlier on-mount-only fade; now each of the 6 chapters animates in as
  // it's scrolled to and reverses on scrolling back past it, not just once at page load.
  useChapterReveal(sceneRef, fixtures.status === 'ready' && !reducedMotion)

  const caseRow = (() => {
    if (fixtures.status !== 'ready' || effectiveSelectedCaseId === null) return null
    return fixtures.fixture.rows.find((r) => r.id === effectiveSelectedCaseId) ?? null
  })()

  const comparisonRow = (() => {
    if (fixtures.status !== 'ready' || comparisonCaseId === null) return null
    return fixtures.fixture.rows.find((r) => r.id === comparisonCaseId) ?? null
  })()

  const effectiveRaw: RawCase | null = (() => {
    if (!caseRow) return null
    if (!perturbation || activeModel !== 'logistic') return caseRow.raw
    return { ...caseRow.raw, [perturbation.feature]: perturbation.value }
  })()

  // SYN-INT-002 cross-control rule (INTERACTIONS.yaml): a perturbation is only ever
  // evaluated against the logistic model -- there is no live TS evaluator for the
  // boosting model's tree internals (see docs/LIMITATIONS.md). Switching to boosting
  // shows that model's own precomputed fixture probability, never a fabricated one.
  const liveResult = (() => {
    if (fixtures.status !== 'ready' || !caseRow) return null
    if (activeModel === 'boosting') {
      return { proba: caseRow.boosting_proba, attribution: null as Record<string, number> | null }
    }
    if (!perturbation || !effectiveRaw) {
      return { proba: caseRow.logistic_proba, attribution: caseRow.logistic_attribution_by_feature }
    }
    const proba = logisticProba(fixtures.manifest, effectiveRaw)
    const attribution = groupAttributionByFeature(
      fixtures.manifest,
      logisticAttribution(fixtures.manifest, effectiveRaw),
    )
    return { proba, attribution }
  })()

  if (fixtures.status === 'loading') {
    return (
      <div className="tribunal-status" role="status" aria-live="polite">
        Opening the case file…
      </div>
    )
  }
  if (fixtures.status === 'error') {
    return (
      <div className="tribunal-status tribunal-status--error" role="alert">
        <p>The case file could not be loaded: {fixtures.message}</p>
        <button type="button" onClick={fixtures.retry}>
          Retry
        </button>
      </div>
    )
  }
  if (!caseRow || !liveResult) return null

  const { manifest, fixture, thresholdSweep, calibration } = fixtures
  const predictedOver50k = liveResult.proba >= threshold
  const actionableFeatures = [...manifest.actionable_numeric, ...manifest.actionable_categorical]
  const confusionRow = thresholdSweep[activeModel].find((r) => Math.abs(r.threshold - threshold) < 1e-6)
  const activeCalibration = calibration[activeModel]

  function handlePerturb(feature: string, rawValue: string) {
    if (manifest.actionable_numeric.includes(feature)) {
      setPerturbation({ feature, value: clampToBounds(manifest, feature, Number(rawValue)) })
    } else {
      setPerturbation({ feature, value: rawValue })
    }
    setFlipResult(null)
  }

  function handleReset() {
    setPerturbation(null)
    setFlipResult(null)
  }

  function handleSwitchModel(model: 'logistic' | 'boosting') {
    setActiveModel(model)
    setPerturbation(null)
    setFlipResult(null)
  }

  function handleThresholdChange(value: number) {
    setThreshold(Math.round(value * 100) / 100)
    // A flip result computed against the old threshold would misrepresent the new one
    // (e.g. "flips at 73.8%" displayed after the threshold moved to 90%) -- stale derived
    // state is exactly the bug class SYN-INT-003/004 interacting was meant to guard
    // against, so clear it rather than let it silently go out of sync.
    setFlipResult(null)
  }

  function handleFindFlip() {
    if (!effectiveRaw || !effectiveFlipTarget) return
    try {
      setFlipResult(findFeasibleFlip(manifest, effectiveRaw, effectiveFlipTarget, threshold))
    } catch (err) {
      setFlipResult({ feasible: false, feature: effectiveFlipTarget, reason: (err as Error).message })
    }
  }

  function handleApplyFlip() {
    if (flipResult?.feasible) {
      setPerturbation({ feature: flipResult.feature, value: flipResult.to_value })
      setFlipResult(null)
    }
  }

  return (
    <>
      {isMobileViewport ? (
        <div className="webgl-fallback" data-testid="webgl-fallback" aria-hidden="true" />
      ) : (
        <WebGLErrorBoundary
          fallback={<div className="webgl-fallback" data-testid="webgl-fallback" aria-hidden="true" />}
        >
          <Suspense fallback={null}>
            <WebGLStage
              proba={liveResult.proba}
              attribution={liveResult.attribution ?? {}}
              scrollProgress={scrollProgress}
              reducedMotion={reducedMotion}
            />
          </Suspense>
        </WebGLErrorBoundary>
      )}
      {!introDone && <IntroSequence onComplete={() => setIntroDone(true)} />}
      <ChapterNav />
      <main className="tribunal-scene" ref={sceneRef} data-testid="tribunal-scene">
        <header className="dossier-header">
          <p className="dossier-case-number">CASE No. {String(caseRow.id).padStart(5, '0')}</p>
          <h1>Synapse Tribunal</h1>
          <p className="dossier-subtitle">A prediction, placed on trial.</p>
        </header>

        <section
          id="chapter-1"
          className="chapter dossier-panel chapter--hero"
          aria-labelledby="chapter-1-heading"
        >
          <h2 id="chapter-1-heading">Chapter 1: Prediction</h2>

          <label htmlFor="case-select">Test-set case ({fixture.rows.length} in this sample)</label>
          <select
            id="case-select"
            value={effectiveSelectedCaseId ?? ''}
            onChange={(e) => {
              setSelectedCaseId(Number(e.target.value))
              setPerturbation(null)
              setFlipResult(null)
            }}
          >
            {fixture.rows.map((row) => (
              <option key={row.id} value={row.id}>
                Case {row.id}, true label: {row.label === 1 ? '>$50K' : '<=$50K'}
              </option>
            ))}
          </select>

          <div className="model-switch" role="group" aria-label="Switch model (SYN-INT-002)">
            {(['logistic', 'boosting'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={m === activeModel ? 'model-tab is-active' : 'model-tab'}
                aria-pressed={m === activeModel}
                onClick={() => handleSwitchModel(m)}
              >
                {m === 'logistic' ? 'Logistic regression' : 'Gradient-boosted trees'}
              </button>
            ))}
          </div>
          {activeModel === 'boosting' && perturbation === null && (
            <p className="model-switch-note">
              No live evaluator exists for this model (see chapter 3); shown here is its real
              precomputed probability for this case, never a perturbed or fabricated one.
            </p>
          )}

          <p className="verdict-badge" role="status" aria-live="polite" data-predicted={predictedOver50k}>
            {predictedOver50k ? 'PREDICTED: EXCEEDS $50K' : 'PREDICTED: AT OR BELOW $50K'}
          </p>
          <p className="verdict-probability">
            Probability of exceeding $50K: <strong>{formatProbability(liveResult.proba)}</strong>
            {perturbation && activeModel === 'logistic' && (
              <span className="recomputed-note"> (recomputed live after your edit)</span>
            )}
          </p>
          <p className="verdict-ground-truth">
            Historical record: this person's real reported income was{' '}
            <strong>{caseRow.label === 1 ? 'above $50K' : 'at or below $50K'}</strong>.
          </p>
        </section>

        <section
          id="chapter-2"
          className="chapter dossier-panel chapter--editorial"
          aria-labelledby="chapter-2-heading"
        >
          <h2 id="chapter-2-heading">Chapter 2: Training context</h2>
          <div className="editorial-grid">
            <div>
              <h3>The nearest contradictory case</h3>
              <p className="contradictory-intro">
                The nearest training-set case with the <strong>opposite</strong> real outcome
                (distance {caseRow.contradictory_case.distance_in_transformed_space.toFixed(3)} in
                the model's own feature space):
              </p>
              {caseRow.contradictory_case.differing_features.length === 0 ? (
                <p className="contradictory-identical">
                  This neighbor shares every recorded feature with the selected case, yet carries
                  the opposite real-world outcome, the strongest evidence this model's confidence
                  has limits.
                </p>
              ) : (
                <ul className="contradictory-diff">
                  {caseRow.contradictory_case.differing_features.map((f) => (
                    <li key={f}>
                      {featureLabel(f)}: {formatValue(caseRow.raw[f])} →{' '}
                      {formatValue(caseRow.contradictory_case.raw[f])}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Data provenance</h3>
              <p className="leakage-note">
                {manifest.leakage_check.exact_duplicate_test_rows_present_in_train} of{' '}
                {manifest.leakage_check.n_test} held-out test rows exactly duplicate a training
                row once the sampling-weight column is dropped. Reported test metrics are
                somewhat optimistic for that subset; disclosed here rather than hidden.
              </p>
              <p className="leakage-note">
                This is 1994 US Census data: income thresholds reflect that period's economy, not
                a current one.
              </p>
            </div>
          </div>
        </section>

        <section
          id="chapter-3"
          className="chapter dossier-panel chapter--inspector"
          aria-labelledby="chapter-3-heading"
        >
          <h2 id="chapter-3-heading">Chapter 3: Feature attribution</h2>

          <RawReader
            manifest={manifest}
            caseRow={caseRow}
            perturbedFeature={perturbation?.feature ?? null}
            perturbedValue={perturbation?.value ?? null}
          />

          {activeModel === 'boosting' ? (
            <p className="model-switch-note">
              Perturbation is disabled while the boosting model is active: switch back to logistic
              regression in chapter 1 to edit features.
            </p>
          ) : (
            <>
              <div className="perturb-controls">
                {actionableFeatures.map((feature) => {
                  const isNumeric = manifest.actionable_numeric.includes(feature)
                  const currentValue =
                    perturbation?.feature === feature ? perturbation.value : caseRow.raw[feature]
                  if (isNumeric) {
                    const [lo, hi] = manifest.numeric_observed_bounds[feature]
                    return (
                      <div className="perturb-row" key={feature}>
                        <label htmlFor={`perturb-${feature}`}>{featureLabel(feature)}</label>
                        <input
                          id={`perturb-${feature}`}
                          type="range"
                          min={lo}
                          max={hi}
                          step={1}
                          value={Number(currentValue)}
                          onChange={(e) => handlePerturb(feature, e.target.value)}
                        />
                        <output>{formatValue(currentValue)}</output>
                      </div>
                    )
                  }
                  const categories = manifest.categorical_categories[feature]
                  return (
                    <div className="perturb-row" key={feature}>
                      <label htmlFor={`perturb-${feature}`}>{featureLabel(feature)}</label>
                      <select
                        id={`perturb-${feature}`}
                        value={String(currentValue)}
                        onChange={(e) => handlePerturb(feature, e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>

              <div className="flip-search">
                <label htmlFor="flip-target">Find the nearest feasible flip for</label>
                <select
                  id="flip-target"
                  value={effectiveFlipTarget}
                  onChange={(e) => setFlipTarget(e.target.value)}
                >
                  {actionableFeatures.map((f) => (
                    <option key={f} value={f}>
                      {featureLabel(f)}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={handleFindFlip}>
                  Search
                </button>
              </div>
              <p className="flip-scope-note">
                This searches changes to <strong>one feature at a time</strong>, the one selected
                above, with every other value held fixed. It is not a search across every feature
                at once, so a combination of smaller changes across several features may exist
                even when this search reports none.
              </p>
              {flipResult && (
                <p className="flip-result" role="status">
                  {flipResult.feasible ? (
                    <>
                      Changing only {featureLabel(flipResult.feature)} to{' '}
                      <strong>{formatValue(flipResult.to_value)}</strong>, with every other
                      feature held fixed, would flip the decision (resulting probability{' '}
                      {formatProbability(flipResult.resulting_proba)}).{' '}
                      <button type="button" onClick={handleApplyFlip}>
                        Apply this flip
                      </button>
                    </>
                  ) : (
                    <>No single-feature flip found: {flipResult.reason}</>
                  )}
                </p>
              )}

              <button type="button" className="reset-button" onClick={handleReset} disabled={!perturbation}>
                Reset scenario
              </button>
            </>
          )}

          <p className="attribution-caveat">{manifest.logistic.attribution_method}</p>
          {liveResult.attribution ? (
            <AttributionBars attribution={liveResult.attribution} />
          ) : (
            <p className="model-switch-note">{manifest.boosting.attribution_note}</p>
          )}
        </section>

        <section
          id="chapter-4"
          className="chapter dossier-panel chapter--diagnostic"
          aria-labelledby="chapter-4-heading"
        >
          <h2 id="chapter-4-heading">Chapter 4: Thresholding</h2>
          <div className="perturb-row">
            <label htmlFor="threshold-slider">Classify as "exceeds $50K" when probability ≥</label>
            <input
              id="threshold-slider"
              type="range"
              min={0.01}
              max={0.99}
              step={0.01}
              value={threshold}
              onChange={(e) => handleThresholdChange(Number(e.target.value))}
            />
            <output>{threshold.toFixed(2)}</output>
          </div>
          <button
            type="button"
            className="reset-button"
            onClick={() => handleThresholdChange(0.5)}
            disabled={threshold === 0.5}
          >
            Reset threshold to 0.50
          </button>
          {confusionRow && (
            <div className="confusion-grid">
              <div className="confusion-cell">
                <span className="confusion-label">True positive</span>
                <span className="confusion-value">{confusionRow.tp}</span>
              </div>
              <div className="confusion-cell">
                <span className="confusion-label">False positive</span>
                <span className="confusion-value">{confusionRow.fp}</span>
              </div>
              <div className="confusion-cell">
                <span className="confusion-label">False negative</span>
                <span className="confusion-value">{confusionRow.fn}</span>
              </div>
              <div className="confusion-cell">
                <span className="confusion-label">True negative</span>
                <span className="confusion-value">{confusionRow.tn}</span>
              </div>
              <div className="confusion-cell confusion-cell--wide">
                <span className="confusion-label">Precision / Recall</span>
                <span className="confusion-value">
                  {(confusionRow.precision * 100).toFixed(1)}% / {(confusionRow.recall * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
          <p className="attribution-caveat">
            Computed over the full 9,045-row held-out test set for the{' '}
            {activeModel === 'logistic' ? 'logistic' : 'boosting'} model, not the ~300-case
            browser sample.
          </p>
        </section>

        <section
          id="chapter-5"
          className="chapter dossier-panel chapter--grid"
          aria-labelledby="chapter-5-heading"
        >
          <h2 id="chapter-5-heading">Chapter 5: Calibration</h2>
          <ul className="calibration-bins" role="list">
            {activeCalibration.map((bin, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={i === calibrationBinIndex ? 'calibration-bin is-active' : 'calibration-bin'}
                  onClick={() => setCalibrationBinIndex(i === calibrationBinIndex ? null : i)}
                  aria-pressed={i === calibrationBinIndex}
                >
                  {(bin.bin_lo * 100).toFixed(0)}–{(bin.bin_hi * 100).toFixed(0)}%
                </button>
              </li>
            ))}
          </ul>
          {calibrationBinIndex !== null &&
            (() => {
              const bin = activeCalibration[calibrationBinIndex]
              return bin.n === 0 ? (
                <p className="calibration-detail">No test cases fell in this probability range.</p>
              ) : (
                <p className="calibration-detail">
                  {bin.n} test cases predicted {(bin.bin_lo * 100).toFixed(0)}–
                  {(bin.bin_hi * 100).toFixed(0)}%: mean predicted probability{' '}
                  <strong>{((bin.mean_predicted ?? 0) * 100).toFixed(1)}%</strong>, real observed
                  rate <strong>{((bin.observed_rate ?? 0) * 100).toFixed(1)}%</strong>.
                </p>
              )
            })()}
        </section>

        <section
          id="chapter-6"
          className="chapter dossier-panel chapter--comparative"
          aria-labelledby="chapter-6-heading"
        >
          <h2 id="chapter-6-heading">Chapter 6: Verdict</h2>
          <label htmlFor="comparison-select">Compare case {caseRow.id} against</label>
          <select
            id="comparison-select"
            value={comparisonCaseId ?? ''}
            onChange={(e) => setComparisonCaseId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select a case to compare</option>
            {fixture.rows
              .filter((r) => r.id !== caseRow.id)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  Case {row.id}, true label: {row.label === 1 ? '>$50K' : '<=$50K'}
                </option>
              ))}
          </select>
          {comparisonRow && (
            <div className="comparison-grid">
              <div>
                <h3>Case {caseRow.id}</h3>
                <AttributionBars attribution={caseRow.logistic_attribution_by_feature} />
              </div>
              <div>
                <h3>Case {comparisonRow.id}</h3>
                <AttributionBars attribution={comparisonRow.logistic_attribution_by_feature} />
              </div>
            </div>
          )}
          <p className="attribution-caveat">
            Both sides are the logistic model's own precomputed attribution for each case,
            unperturbed.
          </p>
          <p className="closing-note">
            A prediction is a fitted estimate, not a verdict of fact: attribution shows what moved
            this model's output, a feasible flip shows how fragile that output is to one feature,
            and the contradictory case in chapter 2 shows this model has been wrong on profiles
            like this one before. Trust it accordingly.
          </p>
        </section>
      </main>
    </>
  )
}
