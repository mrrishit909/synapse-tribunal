import type { ModelManifest, RawCase } from './types'

/**
 * Exact TypeScript port of research/models/reference_math.py, driven by the same
 * model_manifest.json the Python reference engine exported. This is the thing the
 * parity tests (src/engine/model.test.ts) check against sklearn's own predict_proba
 * output recorded in the test fixture -- not a reimplementation we merely hope agrees.
 */

export function transformRow(manifest: ModelManifest, raw: RawCase): number[] {
  const out: number[] = []
  const { features, mean, scale } = manifest.numeric_scaler
  for (let i = 0; i < features.length; i++) {
    const x = Number(raw[features[i]])
    out.push((x - mean[i]) / scale[i])
  }
  for (const col of Object.keys(manifest.categorical_categories)) {
    const cats = manifest.categorical_categories[col]
    const val = String(raw[col])
    for (const c of cats) out.push(c === val ? 1 : 0)
  }
  return out
}

export function logisticProba(manifest: ModelManifest, raw: RawCase): number {
  const x = transformRow(manifest, raw)
  const { coef, intercept } = manifest.logistic
  let logit = intercept
  for (let i = 0; i < coef.length; i++) logit += coef[i] * x[i]
  return 1 / (1 + Math.exp(-logit))
}

/** Closed-form linear-SHAP attribution: coef_i * (x_i - E[x_i | train]) in the one-hot/
 * scaled feature space. Exact under feature independence; an approximation otherwise.
 * See manifest.logistic.attribution_method for the full disclosure shown in the UI. */
export function logisticAttribution(manifest: ModelManifest, raw: RawCase): number[] {
  const x = transformRow(manifest, raw)
  const { coef, attribution_baseline_transformed: baseline } = manifest.logistic
  return coef.map((c, i) => c * (x[i] - baseline[i]))
}

export function isActionable(manifest: ModelManifest, feature: string): boolean {
  return (
    manifest.actionable_numeric.includes(feature) ||
    manifest.actionable_categorical.includes(feature)
  )
}

export function isNumericFeature(manifest: ModelManifest, feature: string): boolean {
  return manifest.numeric_scaler.features.includes(feature)
}
