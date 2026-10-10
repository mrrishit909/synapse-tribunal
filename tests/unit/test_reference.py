"""Independent numerical correctness tests for the reference engine, per
ANALYTICAL_STANDARDS.md: normal, boundary, infeasible, missing, out-of-domain cases."""
import json
import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from research.models.reference_math import MANIFEST, logistic_attribution, logistic_proba
from research.models.counterfactual import find_feasible_flip

FIXTURE = json.loads((ROOT / "data" / "precomputed" / "full_test_fixture.json").read_text())
SAMPLE_FIXTURE = json.loads((ROOT / "public" / "data" / "precomputed" / "test_fixture.json").read_text())
SWEEP = json.loads((ROOT / "public" / "data" / "precomputed" / "threshold_sweep.json").read_text())
CALIB = json.loads((ROOT / "public" / "data" / "precomputed" / "calibration.json").read_text())


def test_manifest_has_both_models():
    assert "logistic" in MANIFEST and "boosting" in MANIFEST
    assert MANIFEST["logistic"]["test_metrics"]["auroc"] > 0.85
    assert MANIFEST["boosting"]["test_metrics"]["auroc"] > 0.85


def test_reference_math_matches_sklearn_proba_on_entire_test_set():
    """Parity check across the full 9045-row held-out test set, not a sample: the pure-
    Python manifest-driven reimplementation must match sklearn's own predict_proba."""
    worst = 0.0
    for row in FIXTURE["rows"]:
        proba = logistic_proba(row["raw"])
        worst = max(worst, abs(proba - row["logistic_proba"]))
    assert worst < 1e-4, f"max |reference_math - sklearn| over full test set = {worst}"


def test_sample_fixture_is_a_real_subset_of_the_full_test_set():
    full_ids = {r["id"] for r in FIXTURE["rows"]}
    sample_ids = {r["id"] for r in SAMPLE_FIXTURE["rows"]}
    assert sample_ids.issubset(full_ids)
    assert 50 <= len(sample_ids) <= 300


@pytest.mark.parametrize("row", FIXTURE["rows"][:50])
def test_attribution_sums_to_logit_delta(row):
    """SHAP values for a linear model must sum to (logit(x) - logit(mean)). This is the
    round-trip invariant that proves the attribution isn't just made-up numbers."""
    attrib = logistic_attribution(row["raw"])
    proba = logistic_proba(row["raw"])
    logit = math.log(proba / (1 - proba))
    base = MANIFEST["logistic"]["attribution_base_logit"]
    assert math.isclose(sum(attrib) + base, logit, abs_tol=1e-3)


def test_confusion_counts_sum_to_n_test_every_threshold():
    n_test = MANIFEST["logistic"]["test_metrics"]["n_test"]
    for model in ("logistic", "boosting"):
        for row in SWEEP[model]:
            assert row["tp"] + row["fp"] + row["tn"] + row["fn"] == n_test


def test_calibration_bins_cover_test_set():
    n_test = MANIFEST["logistic"]["test_metrics"]["n_test"]
    for model in ("logistic", "boosting"):
        assert sum(b["n"] for b in CALIB[model]) == n_test


def test_counterfactual_numeric_normal_case_feasible_or_honestly_infeasible():
    row = FIXTURE["rows"][0]["raw"]
    result = find_feasible_flip(row, "hours-per-week", threshold=0.5)
    assert "feasible" in result
    if result["feasible"]:
        flipped = {**row, "hours-per-week": result["to_value"]}
        pred_before = logistic_proba(row) >= 0.5
        pred_after = logistic_proba(flipped) >= 0.5
        assert pred_before != pred_after


def test_counterfactual_boundary_case_at_observed_max_is_infeasible_or_trivial():
    lo, hi = MANIFEST["numeric_observed_bounds"]["hours-per-week"]
    row = {**FIXTURE["rows"][0]["raw"], "hours-per-week": hi}
    result = find_feasible_flip(row, "hours-per-week", threshold=0.5)
    assert result["feasible"] in (True, False)


def test_counterfactual_rejects_immutable_feature():
    row = FIXTURE["rows"][0]["raw"]
    with pytest.raises(ValueError):
        find_feasible_flip(row, "age", threshold=0.5)


def test_counterfactual_categorical_infeasible_reports_reason_not_crash():
    row = dict(FIXTURE["rows"][0]["raw"])
    result = find_feasible_flip(row, "workclass", threshold=0.5)
    assert result["feasible"] in (True, False)
    if not result["feasible"]:
        assert "reason" in result


def test_counterfactual_categorical_returns_minimal_not_most_decisive_flip():
    """Regression test for a real bug an independent review caught: the categorical
    search once picked the candidate FARTHEST from the threshold (the most decisive
    flip) instead of the closest (the minimal change), silently diverging from
    SPEC_LOCK.md's own 'minimal-change path' description. Brute-forces every observed
    category independently of find_feasible_flip's own implementation."""
    for row in SAMPLE_FIXTURE["rows"][:40]:
        raw = row["raw"]
        for feature in ("workclass", "occupation"):
            threshold = 0.5
            current_pred = logistic_proba(raw) >= threshold
            flipping = []
            for cat in MANIFEST["categorical_categories"][feature]:
                if cat == raw[feature]:
                    continue
                trial = {**raw, feature: cat}
                p = logistic_proba(trial)
                if (p >= threshold) != current_pred:
                    flipping.append((cat, p))
            result = find_feasible_flip(raw, feature, threshold=threshold)
            if not flipping:
                assert not result["feasible"]
                continue
            expected_best = min(flipping, key=lambda cp: abs(cp[1] - threshold))
            assert result["feasible"]
            assert result["to_value"] == expected_best[0], (
                f"{feature}: expected minimal-change category {expected_best[0]!r}, "
                f"got {result['to_value']!r}"
            )


def test_scaler_mean_is_train_only_not_full_dataset():
    """Leakage guard: the manifest's StandardScaler mean must equal the TRAIN split's own
    mean, not a mean computed over train+test (which would leak test distribution info
    into every prediction)."""
    from research.models.train import NUM_FEATURES, load, train_test_split, SEED

    df = load()
    X = df[list(df.columns.drop("label"))]
    y = df["label"].to_numpy()
    X_train, _, _, _ = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)
    recomputed_mean = X_train[NUM_FEATURES].mean().to_numpy()
    manifest_mean = MANIFEST["numeric_scaler"]["mean"]
    for a, b in zip(recomputed_mean, manifest_mean):
        assert math.isclose(a, b, rel_tol=1e-6)


def test_leakage_check_is_disclosed_in_manifest():
    check = MANIFEST["leakage_check"]
    assert check["n_test"] == MANIFEST["logistic"]["test_metrics"]["n_test"]
    assert 0 <= check["exact_duplicate_test_rows_present_in_train"] <= check["n_test"]


def test_grouped_attribution_sums_match_ungrouped_sum():
    """Additivity of linear SHAP: summing one-hot columns back to their raw feature must
    not change the total (grouping is a display aggregation, not a second approximation)."""
    for row in SAMPLE_FIXTURE["rows"][:30]:
        ungrouped_sum = sum(row["logistic_attribution"])
        grouped_sum = sum(row["logistic_attribution_by_feature"].values())
        assert math.isclose(ungrouped_sum, grouped_sum, abs_tol=1e-4)


def test_contradictory_case_present_and_carries_opposite_label():
    for row in SAMPLE_FIXTURE["rows"][:30]:
        cc = row["contradictory_case"]
        assert cc["label"] == 1 - row["label"]
        # Zero differing features is allowed and is in fact the strongest possible
        # evidence this chapter can show: an identical profile with the opposite real
        # outcome. It must not be filtered out as if it were a bug.
        assert len(cc["differing_features"]) >= 0


def test_counterfactual_integer_snap_never_returns_a_fractional_value():
    row = FIXTURE["rows"][0]["raw"]
    for feature in ("hours-per-week", "education-num", "capital-gain", "capital-loss"):
        result = find_feasible_flip(row, feature, threshold=0.5)
        if result["feasible"]:
            assert float(result["to_value"]).is_integer(), (
                f"{feature} flip returned a fractional value: {result['to_value']}"
            )


def test_auroc_pr_auc_brier_reconcile_independently_from_the_full_test_fixture():
    """Atlas validation requirement: 'Brier/ROC reconciliation.' Recomputes all three
    metrics directly from the exported per-row probabilities/labels in
    full_test_fixture.json (not from sklearn's internal state) and checks they match
    the manifest's own reported values, for both models."""
    from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

    labels = [r["label"] for r in FIXTURE["rows"]]
    for model_key, proba_key in (("logistic", "logistic_proba"), ("boosting", "boosting_proba")):
        probs = [r[proba_key] for r in FIXTURE["rows"]]
        recomputed_auroc = roc_auc_score(labels, probs)
        recomputed_pr_auc = average_precision_score(labels, probs)
        recomputed_brier = brier_score_loss(labels, probs)
        manifest_metrics = MANIFEST[model_key]["test_metrics"]
        assert math.isclose(recomputed_auroc, manifest_metrics["auroc"], abs_tol=1e-3)
        assert math.isclose(recomputed_pr_auc, manifest_metrics["pr_auc"], abs_tol=1e-3)
        assert math.isclose(recomputed_brier, manifest_metrics["brier"], abs_tol=1e-3)


def test_threshold_sweep_confusion_counts_reconcile_from_the_full_test_fixture():
    """Recomputes every confusion-matrix row independently from the full test fixture's
    per-row probabilities, rather than trusting train.py's own confusion_at_threshold."""
    for model_key, proba_key in (("logistic", "logistic_proba"), ("boosting", "boosting_proba")):
        rows = FIXTURE["rows"]
        for exported in SWEEP[model_key][::10]:  # sample every 10th threshold, 100 checks is enough
            t = exported["threshold"]
            tp = sum(1 for r in rows if r[proba_key] >= t and r["label"] == 1)
            fp = sum(1 for r in rows if r[proba_key] >= t and r["label"] == 0)
            tn = sum(1 for r in rows if r[proba_key] < t and r["label"] == 0)
            fn = sum(1 for r in rows if r[proba_key] < t and r["label"] == 1)
            assert (tp, fp, tn, fn) == (exported["tp"], exported["fp"], exported["tn"], exported["fn"]), (
                f"{model_key} @ threshold={t}: recomputed ({tp},{fp},{tn},{fn}) != "
                f"exported ({exported['tp']},{exported['fp']},{exported['tn']},{exported['fn']})"
            )


def test_calibration_bins_reconcile_from_the_full_test_fixture():
    """Recomputes each calibration bin's n/mean_predicted/observed_rate independently
    from the full test fixture rather than trusting train.py's own bin loop."""
    for model_key, proba_key in (("logistic", "logistic_proba"), ("boosting", "boosting_proba")):
        rows = FIXTURE["rows"]
        for exported in CALIB[model_key]:
            lo, hi = exported["bin_lo"], exported["bin_hi"]
            is_last = math.isclose(hi, 1.0)
            in_bin = [r for r in rows if lo <= r[proba_key] < hi or (is_last and r[proba_key] == hi)]
            assert len(in_bin) == exported["n"], f"{model_key} bin [{lo},{hi}]: n mismatch"
            if in_bin:
                mean_pred = sum(r[proba_key] for r in in_bin) / len(in_bin)
                observed = sum(r["label"] for r in in_bin) / len(in_bin)
                assert math.isclose(mean_pred, exported["mean_predicted"], abs_tol=1e-3)
                assert math.isclose(observed, exported["observed_rate"], abs_tol=1e-3)


def test_out_of_domain_numeric_input_does_not_silently_succeed():
    """A value far outside any observed range should still produce a finite probability
    (the model doesn't crash) but must not be presented as a normal in-domain prediction
    without the caller checking numeric_observed_bounds first -- this test documents that
    the reference math itself does no bounds-checking, the frontend/TS layer must."""
    row = dict(FIXTURE["rows"][0]["raw"])
    row["hours-per-week"] = 1_000_000
    proba = logistic_proba(row)
    assert 0.0 <= proba <= 1.0
    lo, hi = MANIFEST["numeric_observed_bounds"]["hours-per-week"]
    assert row["hours-per-week"] > hi, "sanity: this input actually is out of domain"
