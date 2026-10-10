"""Pure-Python/numpy reimplementation of the logistic pipeline's math, driven only by
`data/precomputed/model_manifest.json`. This exists so the exact same manifest-driven
algorithm can be ported to TypeScript (task #5) and parity-tested against sklearn's own
`predict_proba`, independent of sklearn's internals, it is the thing we actually promise
the browser reproduces, not sklearn's black box.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads((ROOT / "public" / "data" / "precomputed" / "model_manifest.json").read_text())


def transform_row(raw: dict) -> list[float]:
    """Raw feature dict -> the same one-hot + scaled vector sklearn's ColumnTransformer
    produces, in `transformed_feature_order`."""
    scaler = MANIFEST["numeric_scaler"]
    out = []
    for feat, mean, scale in zip(scaler["features"], scaler["mean"], scaler["scale"]):
        out.append((float(raw[feat]) - mean) / scale)
    for col, cats in MANIFEST["categorical_categories"].items():
        val = str(raw[col])
        out.extend(1.0 if c == val else 0.0 for c in cats)
    return out


def logistic_proba(raw: dict) -> float:
    x = transform_row(raw)
    coef = MANIFEST["logistic"]["coef"]
    intercept = MANIFEST["logistic"]["intercept"]
    logit = intercept + sum(c * xi for c, xi in zip(coef, x))
    return 1.0 / (1.0 + math.exp(-logit))


def logistic_attribution(raw: dict) -> list[float]:
    x = transform_row(raw)
    coef = MANIFEST["logistic"]["coef"]
    baseline = MANIFEST["logistic"]["attribution_baseline_transformed"]
    return [c * (xi - b) for c, xi, b in zip(coef, x, baseline)]
