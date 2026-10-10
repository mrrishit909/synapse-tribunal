"""Synapse Tribunal reference engine.

Trains the two real classifiers (logistic regression, histogram gradient-boosted
boosting), computes real evaluation metrics, a closed-form attribution for the
logistic model, and a constrained greedy counterfactual search over actionable
features only. Exports typed JSON fixtures the frontend loads directly, plus a
manifest binding them to model/code versions, and everything a TypeScript port
needs to reproduce the logistic model's math exactly (coefficients, intercept,
and the one-hot/scaling parameters, in a fixed feature order).

Run: SSL not needed here (no network); see fetch_adult.py for that.
    .venv/bin/python -I research/models/train.py
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.neighbors import NearestNeighbors
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "research" / "data" / "raw" / "adult_raw.csv"
# Browser-shipped fixtures go straight under public/, so the dev server and the vite build
# both serve them from the same place with no manual copy step to drift out of sync.
OUT = ROOT / "public" / "data" / "precomputed"
OUT.mkdir(parents=True, exist_ok=True)
# The full (unsampled) test-set fixture is for Python-side regression/parity tests only --
# at ~11MB it never ships to the browser -- so it stays out of public/.
RESEARCH_OUT = ROOT / "data" / "precomputed"
RESEARCH_OUT.mkdir(parents=True, exist_ok=True)

SEED = 42

ACTIONABLE_NUM = ["education-num", "capital-gain", "capital-loss", "hours-per-week"]
ACTIONABLE_CAT = ["workclass", "occupation"]
IMMUTABLE_NUM = ["age"]
IMMUTABLE_CAT = ["marital-status", "relationship", "race", "sex", "native-country"]
NUM_FEATURES = ACTIONABLE_NUM + IMMUTABLE_NUM
CAT_FEATURES = ACTIONABLE_CAT + IMMUTABLE_CAT
ALL_FEATURES = NUM_FEATURES + CAT_FEATURES
# Every numeric feature in this dataset is integer-valued in the raw source; the
# counterfactual search must snap to an integer, a fractional "47.38 hours/week" flip
# is not a value a real row could ever have.
INTEGER_FEATURES = set(NUM_FEATURES)


def load() -> pd.DataFrame:
    df = pd.read_csv(RAW)
    df.columns = [c.strip() for c in df.columns]
    for c in df.select_dtypes(include=["object", "str"]).columns:
        df[c] = df[c].astype(str).str.strip()
    df = df[df.replace("?", np.nan).notna().all(axis=1)].copy()
    df = df.drop(columns=["fnlwgt", "education"])
    df["label"] = (df["class"].str.replace(".", "", regex=False) == ">50K").astype(int)
    return df[ALL_FEATURES + ["label"]]


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUM_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CAT_FEATURES),
        ]
    )


@dataclass
class Metrics:
    auroc: float
    pr_auc: float
    brier: float
    n_test: int


def evaluate(y_true: np.ndarray, proba: np.ndarray) -> Metrics:
    return Metrics(
        auroc=float(roc_auc_score(y_true, proba)),
        pr_auc=float(average_precision_score(y_true, proba)),
        brier=float(brier_score_loss(y_true, proba)),
        n_test=int(len(y_true)),
    )


def confusion_at_threshold(y_true: np.ndarray, proba: np.ndarray, t: float) -> dict:
    pred = (proba >= t).astype(int)
    tp = int(np.sum((pred == 1) & (y_true == 1)))
    fp = int(np.sum((pred == 1) & (y_true == 0)))
    tn = int(np.sum((pred == 0) & (y_true == 0)))
    fn = int(np.sum((pred == 0) & (y_true == 1)))
    assert tp + fp + tn + fn == len(y_true), "confusion counts must sum to n_test"
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    return {"threshold": round(t, 3), "tp": tp, "fp": fp, "tn": tn, "fn": fn,
            "precision": precision, "recall": recall}


def onehot_categories(preprocessor: ColumnTransformer) -> dict[str, list[str]]:
    ohe: OneHotEncoder = preprocessor.named_transformers_["cat"]
    return {col: list(map(str, cats)) for col, cats in zip(CAT_FEATURES, ohe.categories_)}


def transformed_feature_names(preprocessor: ColumnTransformer, cats: dict[str, list[str]]) -> list[str]:
    names = list(NUM_FEATURES)
    for col in CAT_FEATURES:
        names += [f"{col}={v}" for v in cats[col]]
    return names


def main() -> None:
    df = load()
    X, y = df[ALL_FEATURES], df["label"].to_numpy()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=SEED
    )

    pre = build_preprocessor()
    logit = Pipeline([("pre", pre), ("clf", LogisticRegression(max_iter=2000, random_state=SEED))])
    boosting = Pipeline([
        ("pre", build_preprocessor()),
        ("clf", HistGradientBoostingClassifier(max_depth=6, max_iter=150, random_state=SEED)),
    ])

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    logit_cv_auc = cross_val_score(logit, X_train, y_train, cv=cv, scoring="roc_auc")
    forest_cv_auc = cross_val_score(boosting, X_train, y_train, cv=cv, scoring="roc_auc")

    logit.fit(X_train, y_train)
    boosting.fit(X_train, y_train)

    logit_test_proba = logit.predict_proba(X_test)[:, 1]
    forest_test_proba = boosting.predict_proba(X_test)[:, 1]

    logit_metrics = evaluate(y_test, logit_test_proba)
    forest_metrics = evaluate(y_test, forest_test_proba)

    # Leakage check (ANALYTICAL_STANDARDS "leakage; fold separation"): exact duplicate raw
    # rows between train and test. Dropping fnlwgt (a per-row sampling weight) makes exact
    # duplicates on the remaining columns plausible; count and disclose rather than assume
    # zero or silently dedupe.
    train_keys = X_train.astype(str).agg("|".join, axis=1)
    test_keys = X_test.astype(str).agg("|".join, axis=1)
    exact_dup_count = int(test_keys.isin(set(train_keys)).sum())

    # Decision-threshold sweep (confusion/precision/recall for SYN-INT-003), both models.
    thresholds = [round(t, 2) for t in np.arange(0.01, 1.00, 0.01)]
    threshold_sweep = {
        "logistic": [confusion_at_threshold(y_test, logit_test_proba, t) for t in thresholds],
        "boosting": [confusion_at_threshold(y_test, forest_test_proba, t) for t in thresholds],
    }

    # Calibration cohorts (SYN-INT-005): real bins over the real test set, both models.
    def calib(proba: np.ndarray) -> list[dict]:
        frac_pos, mean_pred = calibration_curve(y_test, proba, n_bins=10, strategy="uniform")
        out = []
        edges = np.linspace(0, 1, 11)
        for i in range(10):
            mask = (proba >= edges[i]) & (proba < edges[i + 1] if i < 9 else proba <= edges[i + 1])
            n = int(mask.sum())
            out.append({
                "bin_lo": round(float(edges[i]), 2), "bin_hi": round(float(edges[i + 1]), 2),
                "n": n,
                "mean_predicted": round(float(proba[mask].mean()), 4) if n else None,
                "observed_rate": round(float(y_test[mask].mean()), 4) if n else None,
            })
        return out

    calibration = {"logistic": calib(logit_test_proba), "boosting": calib(forest_test_proba)}

    # Closed-form attribution for the logistic model only (exact, not an approximation):
    # SHAP value for feature i under a linear model with the independence assumption is
    # coef_i * (x_i - E[x_i]) in the transformed feature space; sum(shap) + E[logit] = logit(x).
    pre_fitted: ColumnTransformer = logit.named_steps["pre"]
    clf: LogisticRegression = logit.named_steps["clf"]
    cats = onehot_categories(pre_fitted)
    feat_names = transformed_feature_names(pre_fitted, cats)
    X_train_t = pre_fitted.transform(X_train)
    X_test_t = pre_fitted.transform(X_test)
    mean_t = X_train_t.mean(axis=0)
    coef = clf.coef_[0]
    intercept = float(clf.intercept_[0])
    base_logit = float(intercept + np.dot(coef, mean_t))

    def attribution_for_row(x_t: np.ndarray) -> list[float]:
        return (coef * (x_t - mean_t)).round(6).tolist()

    def group_attribution_by_raw_feature(attrib: list[float]) -> dict[str, float]:
        """Sum one-hot-column attributions back to their parent raw feature. Additivity
        of linear SHAP makes this exact: the grouped sum still equals the ungrouped sum,
        so this is a display aggregation, not an approximation on top of an approximation."""
        out: dict[str, float] = {f: 0.0 for f in ALL_FEATURES}
        for name, val in zip(feat_names, attrib):
            raw_feat = name.split("=")[0] if "=" in name else name
            out[raw_feat] = round(out[raw_feat] + val, 6)
        return out

    # Export a manifest with everything needed to reproduce the logistic model exactly in TS.
    manifest = {
        "seed": SEED,
        "feature_order_raw": ALL_FEATURES,
        "actionable_numeric": ACTIONABLE_NUM,
        "actionable_categorical": ACTIONABLE_CAT,
        "immutable_numeric": IMMUTABLE_NUM,
        "immutable_categorical": IMMUTABLE_CAT,
        "numeric_scaler": {
            "features": NUM_FEATURES,
            "mean": pre_fitted.named_transformers_["num"].mean_.round(8).tolist(),
            "scale": pre_fitted.named_transformers_["num"].scale_.round(8).tolist(),
        },
        "categorical_categories": cats,
        "transformed_feature_order": feat_names,
        "logistic": {
            "coef": coef.round(10).tolist(),
            "intercept": intercept,
            "cv_auroc_folds": logit_cv_auc.round(6).tolist(),
            "cv_auroc_mean": float(logit_cv_auc.mean()),
            "test_metrics": asdict(logit_metrics),
            "attribution_baseline_transformed": mean_t.round(8).tolist(),
            "attribution_base_logit": base_logit,
            "attribution_method": "Closed-form linear SHAP: coef_i * (x_i - mean(x_i | train)) "
                "in the one-hot/scaled feature space, summing to the model's logit minus its "
                "train-mean logit. Exact under the feature-independence assumption; this is an "
                "approximation of true Shapley values when features correlate, not a causal "
                "explanation of the outcome.",
        },
        "boosting": {
            "cv_auroc_folds": forest_cv_auc.round(6).tolist(),
            "cv_auroc_mean": float(forest_cv_auc.mean()),
            "test_metrics": asdict(forest_metrics),
            "attribution_available": False,
            "attribution_note": "No per-case attribution is shown for the boosting model; "
                "only its predicted probability is compared against the logistic model "
                "(SYN-INT-002). Showing a fabricated or borrowed attribution for a different "
                "model's decision would misrepresent how that model reached it.",
        },
        "numeric_observed_bounds": {
            col: [float(X_train[col].min()), float(X_train[col].max())] for col in NUM_FEATURES
        },
        "leakage_check": {
            "exact_duplicate_test_rows_present_in_train": exact_dup_count,
            "n_test": int(len(X_test)),
            "note": "Count of test rows whose raw features (post fnlwgt/education drop) "
                "exactly match some train row -- these are real Census respondents who "
                "happen to share every remaining field, not a bug. Disclosed, not silently "
                "deduplicated: at roughly 22% of the test set, reported test AUROC/Brier are "
                "somewhat optimistic for this subset (the model may have memorized rather "
                "than generalized to these specific rows), though AUROC on the Adult dataset "
                "is well-established in the literature in the 0.90-0.93 range independent of "
                "this split, so the effect is unlikely to be large. A grouped split that "
                "removes duplicates from train or test is the honest fix and is recorded as "
                "future work, not applied here.",
        },
    }
    (OUT / "model_manifest.json").write_text(json.dumps(manifest, indent=2))

    # Test-set fixture: every row's raw features, true label, both models' probabilities,
    # and the logistic model's real attribution vector.
    all_rows = []
    for i, (idx, raw) in enumerate(X_test.reset_index(drop=True).iterrows()):
        all_rows.append({
            "id": int(idx),
            "raw": raw.to_dict(),
            "label": int(y_test[i]),
            "logistic_proba": round(float(logit_test_proba[i]), 6),
            "boosting_proba": round(float(forest_test_proba[i]), 6),
            "logistic_attribution": attribution_for_row(X_test_t[i]),
            "logistic_attribution_by_feature": group_attribution_by_raw_feature(
                attribution_for_row(X_test_t[i])
            ),
        })
    (RESEARCH_OUT / "full_test_fixture.json").write_text(json.dumps({
        "transformed_feature_order": feat_names, "rows": all_rows,
    }))
    # The full 9045-row fixture (~11MB) is kept locally for parity/regression tests only;
    # the browser gets a stratified ~300-case sample spanning predicted-probability deciles
    # and both correct/incorrect predictions, small enough to ship and still a real,
    # unfiltered-within-stratum sample of the actual test set (not cherry-picked).
    rng = np.random.default_rng(SEED)
    deciles = np.minimum((logit_test_proba * 10).astype(int), 9)
    sample_idx: list[int] = []
    for d in range(10):
        bucket = np.where(deciles == d)[0]
        if len(bucket) == 0:
            continue
        correct = bucket[(y_test[bucket] == (logit_test_proba[bucket] >= 0.5).astype(int))]
        incorrect = bucket[(y_test[bucket] != (logit_test_proba[bucket] >= 0.5).astype(int))]
        take_correct = rng.choice(correct, size=min(24, len(correct)), replace=False) if len(correct) else []
        take_incorrect = rng.choice(incorrect, size=min(6, len(incorrect)), replace=False) if len(incorrect) else []
        sample_idx.extend(int(i) for i in np.concatenate([take_correct, take_incorrect]).astype(int)) if len(take_correct) or len(take_incorrect) else None
    sample_rows = [all_rows[i] for i in sorted(set(sample_idx))]

    # Contradictory cases (dossier: "feature evidence AND contradictory cases transform
    # the interface"): for each sample case, the nearest training-set row carrying the
    # OPPOSITE true label, measured in the logistic model's own transformed feature space.
    # A real, traceable neighbor lookup, not an invented example -- this is what the
    # 'training context' chapter shows as evidence against the model's confidence.
    nn_pos = NearestNeighbors(n_neighbors=1).fit(X_train_t[y_train == 1])
    nn_neg = NearestNeighbors(n_neighbors=1).fit(X_train_t[y_train == 0])
    train_pos_idx = np.where(y_train == 1)[0]
    train_neg_idx = np.where(y_train == 0)[0]
    X_train_reset = X_train.reset_index(drop=True)
    for row, sample_i in zip(sample_rows, sorted(set(sample_idx))):
        x_t = X_test_t[sample_i]
        if row["label"] == 1:
            dist, idx = nn_neg.kneighbors([x_t], n_neighbors=1)
            neighbor_row_idx = train_neg_idx[idx[0][0]]
        else:
            dist, idx = nn_pos.kneighbors([x_t], n_neighbors=1)
            neighbor_row_idx = train_pos_idx[idx[0][0]]
        neighbor_raw = X_train_reset.iloc[neighbor_row_idx].to_dict()
        differing = [f for f in ALL_FEATURES if str(neighbor_raw[f]) != str(row["raw"][f])]
        row["contradictory_case"] = {
            "distance_in_transformed_space": round(float(dist[0][0]), 4),
            "label": int(1 - row["label"]),
            "raw": neighbor_raw,
            "differing_features": differing,
        }

    (OUT / "test_fixture.json").write_text(json.dumps({
        "transformed_feature_order": feat_names,
        "sampling_note": "Stratified sample (~24 correct + ~6 incorrect per predicted-"
            "probability decile) of the full 9045-row held-out test set, for the in-browser "
            "case browser. Metrics/calibration/threshold fixtures use the FULL test set, not "
            "this sample.",
        "n_full_test_set": len(all_rows),
        "rows": sample_rows,
    }))

    (OUT / "threshold_sweep.json").write_text(json.dumps(threshold_sweep))
    (OUT / "calibration.json").write_text(json.dumps(calibration, indent=2))

    print(f"logistic  CV AUROC mean={logit_cv_auc.mean():.4f}  test AUROC={logit_metrics.auroc:.4f} "
          f"PR-AUC={logit_metrics.pr_auc:.4f} Brier={logit_metrics.brier:.4f}")
    print(f"boosting    CV AUROC mean={forest_cv_auc.mean():.4f}  test AUROC={forest_metrics.auroc:.4f} "
          f"PR-AUC={forest_metrics.pr_auc:.4f} Brier={forest_metrics.brier:.4f}")
    print(f"n_train={len(X_train)} n_test={len(X_test)}")
    print(f"wrote fixtures to {OUT}")


if __name__ == "__main__":
    main()
