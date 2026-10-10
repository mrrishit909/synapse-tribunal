import { logisticProba } from './model'
import type { CounterfactualResult, ModelManifest, RawCase } from './types'

/**
 * Port of research/models/counterfactual.py. Deliberately scoped to a single actionable
 * feature (the one the user is already perturbing in SYN-INT-004), not a full multi-
 * feature nearest-counterfactual search -- that scoping is a documented simplification,
 * not a hidden one (see docs/LIMITATIONS.md).
 */

function searchNumeric(
  manifest: ModelManifest,
  raw: RawCase,
  feature: string,
  threshold: number,
  tol = 1e-3,
  maxIter = 60,
): CounterfactualResult {
  if (!manifest.actionable_numeric.includes(feature)) {
    throw new Error(`${feature} is not actionable`)
  }
  const [lo, hi] = manifest.numeric_observed_bounds[feature]
  const current = Number(raw[feature])
  const currentPred = logisticProba(manifest, raw) >= threshold

  const predAt = (v: number): boolean => {
    const trial = { ...raw, [feature]: v }
    return logisticProba(manifest, trial) >= threshold
  }

  if (predAt(lo) === currentPred && predAt(hi) === currentPred) {
    return {
      feasible: false,
      feature,
      reason: 'no value within the observed training range flips the decision',
    }
  }

  const targetBound = predAt(lo) !== currentPred ? lo : hi
  let a = current
  let b = targetBound
  for (let i = 0; i < maxIter; i++) {
    const mid = (a + b) / 2
    if (predAt(mid) === currentPred) a = mid
    else b = mid
    if (Math.abs(b - a) < tol * Math.max(1, Math.abs(hi - lo))) break
  }
  const flipValue = b
  return {
    feasible: true,
    feature,
    from_value: current,
    to_value: Math.round(flipValue * 1e6) / 1e6,
    delta: Math.round((flipValue - current) * 1e6) / 1e6,
    resulting_proba: logisticProba(manifest, { ...raw, [feature]: flipValue }),
  }
}

function searchCategorical(
  manifest: ModelManifest,
  raw: RawCase,
  feature: string,
  threshold: number,
): CounterfactualResult {
  if (!manifest.actionable_categorical.includes(feature)) {
    throw new Error(`${feature} is not actionable`)
  }
  const current = raw[feature]
  const currentPred = logisticProba(manifest, raw) >= threshold
  const candidates: { category: string; resulting_proba: number }[] = []
  for (const cat of manifest.categorical_categories[feature]) {
    if (cat === current) continue
    const trial = { ...raw, [feature]: cat }
    const proba = logisticProba(manifest, trial)
    if ((proba >= threshold) !== currentPred) {
      candidates.push({ category: cat, resulting_proba: proba })
    }
  }
  if (candidates.length === 0) {
    return {
      feasible: false,
      feature,
      reason: 'no observed category for this feature flips the decision',
    }
  }
  const best = candidates.reduce((a, b) =>
    Math.abs(a.resulting_proba - threshold) >= Math.abs(b.resulting_proba - threshold) ? a : b,
  )
  return {
    feasible: true,
    feature,
    from_value: current,
    to_value: best.category,
    resulting_proba: best.resulting_proba,
  }
}

export function findFeasibleFlip(
  manifest: ModelManifest,
  raw: RawCase,
  feature: string,
  threshold = 0.5,
): CounterfactualResult {
  if (manifest.actionable_numeric.includes(feature)) {
    return searchNumeric(manifest, raw, feature, threshold)
  }
  if (manifest.actionable_categorical.includes(feature)) {
    return searchCategorical(manifest, raw, feature, threshold)
  }
  throw new Error(`${feature} is immutable; counterfactual search is only valid on actionable features`)
}
