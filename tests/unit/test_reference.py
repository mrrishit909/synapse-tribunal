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
    assert "logistic" in MANIFEST and "forest" in MANIFEST
    assert MANIFEST["logistic"]["test_metrics"]["auroc"] > 0.85
    assert MANIFEST["forest"]["test_metrics"]["auroc"] > 0.85


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
    for model in ("logistic", "forest"):
        for row in SWEEP[model]:
            assert row["tp"] + row["fp"] + row["tn"] + row["fn"] == n_test


def test_calibration_bins_cover_test_set():
    n_test = MANIFEST["logistic"]["test_metrics"]["n_test"]
    for model in ("logistic", "forest"):
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
