"""Constrained single-feature counterfactual search: 'if only this one actionable feature
were different, would the decision flip?' Deliberately scoped to the feature the user is
already perturbing (SYN-INT-004's second mode), not a full multi-feature nearest-counterfactual
search, labeled as such. Only actionable features are ever searched.
"""
from __future__ import annotations

import math

from .reference_math import MANIFEST, logistic_proba

ACTIONABLE_NUMERIC = set(MANIFEST["actionable_numeric"])
ACTIONABLE_CATEGORICAL = set(MANIFEST["actionable_categorical"])
# Every numeric feature in this dataset is integer-valued in the raw source (see train.py's
# INTEGER_FEATURES); a found flip must be snapped to an integer and re-checked, a fractional
# "47.38 hours/week" is not a value a real row could ever have.
INTEGER_FEATURES = set(MANIFEST["numeric_scaler"]["features"])


def search_numeric(raw: dict, feature: str, threshold: float, tol: float = 1e-3, max_iter: int = 60) -> dict:
    assert feature in ACTIONABLE_NUMERIC, f"{feature} is not actionable"
    lo, hi = MANIFEST["numeric_observed_bounds"][feature]
    current = float(raw[feature])
    current_pred = logistic_proba(raw) >= threshold

    def pred_at(v: float) -> bool:
        trial = dict(raw)
        trial[feature] = v
        return logistic_proba(trial) >= threshold

    if pred_at(lo) == current_pred and pred_at(hi) == current_pred:
        return {"feasible": False, "feature": feature, "reason":
                "no value within the observed training range flips the decision"}

    target_bound = lo if pred_at(lo) != current_pred else hi
    a, b = current, target_bound
    for _ in range(max_iter):
        mid = (a + b) / 2
        if pred_at(mid) == current_pred:
            a = mid
        else:
            b = mid
        if abs(b - a) < tol * max(1.0, abs(hi - lo)):
            break
    flip_value = b
    if feature in INTEGER_FEATURES:
        # Snap to the nearest integer on the side of `flip_value` that keeps the decision
        # flipped (round toward b, away from a, re-checking rather than assuming).
        snapped = math.ceil(flip_value) if b > a else math.floor(flip_value)
        if pred_at(snapped) == current_pred:
            # the snap rounded back across the boundary; step one more unit outward
            snapped = snapped + 1 if b > a else snapped - 1
        if lo <= snapped <= hi and pred_at(snapped) != current_pred:
            flip_value = snapped
        else:
            return {"feasible": False, "feature": feature, "reason":
                     "no integer value within the observed training range flips the decision "
                     "(a fractional flip exists but this feature is integer-valued)"}
    return {
        "feasible": True, "feature": feature,
        "from_value": current, "to_value": round(flip_value, 6),
        "delta": round(flip_value - current, 6),
        "resulting_proba": round(logistic_proba({**raw, feature: flip_value}), 6),
    }


def search_categorical(raw: dict, feature: str, threshold: float) -> dict:
    assert feature in ACTIONABLE_CATEGORICAL, f"{feature} is not actionable"
    current = raw[feature]
    current_pred = logistic_proba(raw) >= threshold
    candidates = []
    for cat in MANIFEST["categorical_categories"][feature]:
        if cat == current:
            continue
        trial = {**raw, feature: cat}
        if (logistic_proba(trial) >= threshold) != current_pred:
            candidates.append({"category": cat, "resulting_proba": round(logistic_proba(trial), 6)})
    if not candidates:
        return {"feasible": False, "feature": feature, "reason":
                "no observed category for this feature flips the decision"}
    # Minimal change: the candidate whose resulting probability is CLOSEST to the
    # threshold (just barely flips it), matching search_numeric's bisection-to-the-
    # boundary semantics. An earlier version picked the farthest/most-decisive
    # candidate instead, silently diverging from SPEC_LOCK.md's "minimal-change path"
    # description; fixed, not just relabeled.
    best = min(candidates, key=lambda c: abs(c["resulting_proba"] - threshold))
    return {"feasible": True, "feature": feature, "from_value": current,
            "to_value": best["category"], "resulting_proba": best["resulting_proba"]}


def find_feasible_flip(raw: dict, feature: str, threshold: float = 0.5) -> dict:
    if feature in ACTIONABLE_NUMERIC:
        return search_numeric(raw, feature, threshold)
    if feature in ACTIONABLE_CATEGORICAL:
        return search_categorical(raw, feature, threshold)
    raise ValueError(f"{feature} is immutable; counterfactual search is only valid on "
                      f"actionable features")
