import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { findFeasibleFlip } from '../engine/counterfactual'
import { featureLabel, formatProbability, formatValue } from '../engine/format'
import { groupAttributionByFeature, logisticAttribution, logisticProba } from '../engine/model'
import type { CounterfactualResult, ModelManifest, RawCase, TestFixtureRow } from '../engine/types'
import { useFixtures } from '../engine/useFixtures'
import { useReducedMotion } from '../motion/useReducedMotion'
import './Tribunal.css'

const THRESHOLD = 0.5

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

export default function Tribunal() {
  const fixtures = useFixtures()
  const reducedMotion = useReducedMotion()
  const sceneRef = useRef<HTMLDivElement>(null)

  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [perturbation, setPerturbation] = useState<{ feature: string; value: number | string } | null>(null)
  const [flipResult, setFlipResult] = useState<CounterfactualResult | null>(null)
  const [flipTarget, setFlipTarget] = useState<string>('')

  // Derived defaults once fixtures resolve, rather than an effect that calls setState on
  // mount: the fixture data is the external system being synchronized, and these are pure
  // "pick the first one" defaults, not a reaction to any later external change.
  const effectiveSelectedCaseId =
    selectedCaseId ?? (fixtures.status === 'ready' ? fixtures.fixture.rows[0]?.id ?? null : null)
  const effectiveFlipTarget =
    flipTarget || (fixtures.status === 'ready' ? fixtures.manifest.actionable_numeric[0] ?? '' : '')

  // Dossier entrance: a single quick fade-up on first render, not a long per-panel
  // cascade. An earlier version staggered each of the 6 panels at 0.12s apart (up to
  // 1.2s before the last one reached full opacity) -- Playwright's visibility check
  // doesn't treat opacity:0 as hidden, so the tests passed while a real screenshot
  // showed panels 2-6 effectively blank for over a second. Fixed by animating the
  // whole scene as one group, under 350ms, short enough that nothing is readably
  // "missing" at any point a human or a screenshot would catch it mid-flight.
  // Reduced motion skips straight to the final state (nothing to cancel or reverse).
  useEffect(() => {
    if (fixtures.status !== 'ready' || reducedMotion || !sceneRef.current) return
    const panels = sceneRef.current.querySelectorAll('.dossier-panel')
    const tween = gsap.fromTo(
      panels,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.03, ease: 'power2.out' },
    )
    return () => {
      tween.kill()
    }
  }, [fixtures.status, reducedMotion])

  const caseRow = useMemo(() => {
    if (fixtures.status !== 'ready' || effectiveSelectedCaseId === null) return null
    return fixtures.fixture.rows.find((r) => r.id === effectiveSelectedCaseId) ?? null
  }, [fixtures, effectiveSelectedCaseId])

  const effectiveRaw: RawCase | null = useMemo(() => {
    if (!caseRow) return null
    if (!perturbation) return caseRow.raw
    return { ...caseRow.raw, [perturbation.feature]: perturbation.value }
  }, [caseRow, perturbation])

  const liveResult = useMemo(() => {
    if (fixtures.status !== 'ready' || !effectiveRaw) return null
    if (!perturbation) {
      return {
        proba: caseRow!.logistic_proba,
        attribution: caseRow!.logistic_attribution_by_feature,
      }
    }
    const proba = logisticProba(fixtures.manifest, effectiveRaw)
    const attribution = groupAttributionByFeature(
      fixtures.manifest,
      logisticAttribution(fixtures.manifest, effectiveRaw),
    )
    return { proba, attribution }
  }, [fixtures, effectiveRaw, perturbation, caseRow])

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

  const { manifest, fixture } = fixtures
  const predictedOver50k = liveResult.proba >= THRESHOLD
  const actionableFeatures = [...manifest.actionable_numeric, ...manifest.actionable_categorical]

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

  function handleFindFlip() {
    if (!effectiveRaw || !effectiveFlipTarget) return
    try {
      setFlipResult(findFeasibleFlip(manifest, effectiveRaw, effectiveFlipTarget, THRESHOLD))
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
    <div className="tribunal-scene" ref={sceneRef} data-testid="tribunal-scene">
      <header className="dossier-header">
        <p className="dossier-case-number">CASE No. {String(caseRow.id).padStart(5, '0')}</p>
        <h1>Synapse Tribunal</h1>
        <p className="dossier-subtitle">A prediction, placed on trial.</p>
      </header>

      <section className="dossier-panel" aria-labelledby="case-browser-heading">
        <h2 id="case-browser-heading">01: Select a case</h2>
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
      </section>

      <section className="dossier-panel" aria-labelledby="verdict-heading">
        <h2 id="verdict-heading">02: The model's verdict</h2>
        <p className="verdict-badge" role="status" aria-live="polite" data-predicted={predictedOver50k}>
          {predictedOver50k ? 'PREDICTED: EXCEEDS $50K' : 'PREDICTED: AT OR BELOW $50K'}
        </p>
        <p className="verdict-probability">
          Probability of exceeding $50K: <strong>{formatProbability(liveResult.proba)}</strong>
          {perturbation && <span className="recomputed-note"> (recomputed live after your edit)</span>}
        </p>
        <p className="verdict-ground-truth">
          Historical record: this person's real reported income was{' '}
          <strong>{caseRow.label === 1 ? 'above $50K' : 'at or below $50K'}</strong>.
        </p>
      </section>

      <section className="dossier-panel" aria-labelledby="evidence-heading">
        <h2 id="evidence-heading">03: Feature evidence</h2>
        <RawReader
          manifest={manifest}
          caseRow={caseRow}
          perturbedFeature={perturbation?.feature ?? null}
          perturbedValue={perturbation?.value ?? null}
        />
      </section>

      <section className="dossier-panel" aria-labelledby="perturb-heading">
        <h2 id="perturb-heading">04: Perturb a feature (SYN-INT-004)</h2>
        <div className="perturb-controls">
          {actionableFeatures.map((feature) => {
            const isNumeric = manifest.actionable_numeric.includes(feature)
            const currentValue = perturbation?.feature === feature ? perturbation.value : caseRow.raw[feature]
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
          <select id="flip-target" value={effectiveFlipTarget} onChange={(e) => setFlipTarget(e.target.value)}>
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
          This searches changes to <strong>one feature at a time</strong>, the one selected above,
          with every other value held fixed. It is not a search across every feature at once, so a
          combination of smaller changes across several features may exist even when this search
          reports none.
        </p>
        {flipResult && (
          <p className="flip-result" role="status">
            {flipResult.feasible ? (
              <>
                Changing only {featureLabel(flipResult.feature)} to{' '}
                <strong>{formatValue(flipResult.to_value)}</strong>, with every other feature held
                fixed, would flip the decision (resulting probability{' '}
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
      </section>

      <section className="dossier-panel" aria-labelledby="attribution-heading">
        <h2 id="attribution-heading">05: Attribution (logistic model only)</h2>
        <p className="attribution-caveat">{manifest.logistic.attribution_method}</p>
        <ul className="attribution-bars">
          {Object.entries(liveResult.attribution)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .map(([feature, value]) => (
              <li key={feature} className={value >= 0 ? 'is-positive' : 'is-negative'}>
                <span className="bar-label">{featureLabel(feature)}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${Math.min(100, Math.abs(value) * 40)}%` }} />
                </span>
                <span className="bar-value">{value >= 0 ? '+' : ''}{value.toFixed(3)}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="dossier-panel" aria-labelledby="contradictory-heading">
        <h2 id="contradictory-heading">06: Contradictory case</h2>
        <p className="contradictory-intro">
          The nearest training-set case with the <strong>opposite</strong> real outcome
          (distance {caseRow.contradictory_case.distance_in_transformed_space.toFixed(3)} in the
          model's own feature space):
        </p>
        {caseRow.contradictory_case.differing_features.length === 0 ? (
          <p className="contradictory-identical">
            This neighbor shares every recorded feature with the selected case, yet carries the
            opposite real-world outcome, the strongest evidence this model's confidence has limits.
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
      </section>
    </div>
  )
}
