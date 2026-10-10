export interface ModelMetrics {
  auroc: number
  pr_auc: number
  brier: number
  n_test: number
}

export interface LogisticManifest {
  coef: number[]
  intercept: number
  cv_auroc_folds: number[]
  cv_auroc_mean: number
  test_metrics: ModelMetrics
  attribution_baseline_transformed: number[]
  attribution_base_logit: number
  attribution_method: string
}

export interface BoostingManifest {
  cv_auroc_folds: number[]
  cv_auroc_mean: number
  test_metrics: ModelMetrics
  attribution_available: false
  attribution_note: string
}

export interface ModelManifest {
  seed: number
  feature_order_raw: string[]
  actionable_numeric: string[]
  actionable_categorical: string[]
  immutable_numeric: string[]
  immutable_categorical: string[]
  numeric_scaler: { features: string[]; mean: number[]; scale: number[] }
  categorical_categories: Record<string, string[]>
  transformed_feature_order: string[]
  logistic: LogisticManifest
  boosting: BoostingManifest
  numeric_observed_bounds: Record<string, [number, number]>
  leakage_check: {
    exact_duplicate_test_rows_present_in_train: number
    n_test: number
    note: string
  }
}

/** A raw case: every manifest.feature_order_raw key, numeric features as numbers,
 * categorical features as their string category. */
export type RawCase = Record<string, number | string>

export interface ContradictoryCase {
  distance_in_transformed_space: number
  label: 0 | 1
  raw: RawCase
  differing_features: string[]
}

export interface TestFixtureRow {
  id: number
  raw: RawCase
  label: 0 | 1
  logistic_proba: number
  boosting_proba: number
  logistic_attribution: number[]
  logistic_attribution_by_feature: Record<string, number>
  contradictory_case: ContradictoryCase
}

export interface TestFixture {
  transformed_feature_order: string[]
  sampling_note: string
  n_full_test_set: number
  rows: TestFixtureRow[]
}

export interface ThresholdRow {
  threshold: number
  tp: number
  fp: number
  tn: number
  fn: number
  precision: number
  recall: number
}

export interface ThresholdSweep {
  logistic: ThresholdRow[]
  boosting: ThresholdRow[]
}

export interface CalibrationBin {
  bin_lo: number
  bin_hi: number
  n: number
  mean_predicted: number | null
  observed_rate: number | null
}

export interface CalibrationFixture {
  logistic: CalibrationBin[]
  boosting: CalibrationBin[]
}

export type CounterfactualResult =
  | { feasible: true; feature: string; from_value: number | string; to_value: number | string; delta?: number; resulting_proba: number }
  | { feasible: false; feature: string; reason: string }
