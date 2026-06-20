import json
import time
import numpy as np
import pandas as pd
import hdbscan
import joblib
from pathlib import Path
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
import lightgbm as lgb
import xgboost as xgb
from catboost import CatBoostRegressor
from lightgbm import LGBMRegressor
from sklearn.ensemble import RandomForestRegressor

from .pipeline import run_pipeline
from .model import FEATURE_COLUMNS, CATEGORICAL_FEATURES
from .config import HDBSCAN_MIN_CLUSTER_SIZE, HDBSCAN_MIN_SAMPLES, MODEL_DIR

OUTPUT_DIR = Path(__file__).parent.parent / "parksense" / "public" / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def np_default(obj):
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    raise TypeError(f"Not serializable: {type(obj)}")


def prepare_data(df):
    coords_rad = np.radians(df[["latitude", "longitude"]].values)
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=HDBSCAN_MIN_CLUSTER_SIZE,
        min_samples=HDBSCAN_MIN_SAMPLES,
        metric="haversine",
        core_dist_n_jobs=-1,
    )
    df["hdbscan_cluster"] = clusterer.fit_predict(coords_rad)
    print(f"  HDBSCAN: {len(set(df['hdbscan_cluster']) - {-1})} clusters, {(df['hdbscan_cluster'] == -1).mean():.1%} noise")

    feature_df = df[FEATURE_COLUMNS].copy()
    for col in CATEGORICAL_FEATURES:
        if col in df.columns:
            feature_df[col] = df[col].astype("category").cat.codes
    feature_df["hdbscan_cluster"] = df["hdbscan_cluster"]

    target = df["congestion_score"].values

    n = len(df)
    train_end = int(n * 0.7)
    val_end = int(n * 0.85)

    X_train = feature_df.iloc[:train_end]
    y_train = target[:train_end]
    X_val = feature_df.iloc[train_end:val_end]
    y_val = target[train_end:val_end]
    X_test = feature_df.iloc[val_end:]
    y_test = target[val_end:]

    return X_train, y_train, X_val, y_val, X_test, y_test


class VotingEnsemble:
    """Simple average of pre-fitted models."""
    def __init__(self, models):
        self.models = models

    def predict(self, X):
        preds = [m.predict(X) for m in self.models]
        return np.mean(preds, axis=0)


class StackingEnsemble:
    """Stack pre-fitted base models with a Ridge meta-learner."""
    def __init__(self, models, meta_learner):
        self.models = models
        self.meta_learner = meta_learner

    def predict(self, X):
        base_preds = np.column_stack([m.predict(X) for m in self.models])
        return self.meta_learner.predict(base_preds)


def train_lightgbm(X_train, y_train, X_val, y_val):
    model = LGBMRegressor(
        n_estimators=1000, num_leaves=63, learning_rate=0.05,
        feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=5,
        random_state=42, n_jobs=-1, verbose=-1,
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)],
              callbacks=[lgb.early_stopping(50), lgb.log_evaluation(0)])
    return model


def train_xgboost(X_train, y_train, X_val, y_val):
    model = xgb.XGBRegressor(
        n_estimators=1000, max_depth=8, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0,
        random_state=42, n_jobs=-1, early_stopping_rounds=50, eval_metric="mae",
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    return model


def train_catboost(X_train, y_train, X_val, y_val):
    model = CatBoostRegressor(
        iterations=1000, depth=8, learning_rate=0.05, l2_leaf_reg=3.0,
        random_seed=42, verbose=0, early_stopping_rounds=50,
    )
    model.fit(X_train, y_train, eval_set=(X_val, y_val))
    return model


def train_random_forest(X_train, y_train):
    model = RandomForestRegressor(
        n_estimators=500, max_depth=15, min_samples_split=10,
        min_samples_leaf=5, random_state=42, n_jobs=-1,
    )
    model.fit(X_train, y_train)
    return model


def build_voting_ensemble(models):
    return VotingEnsemble(models)


def build_stacking_ensemble(models, X_val, y_val):
    base_preds = np.column_stack([m.predict(X_val) for m in models])
    meta = Ridge(alpha=1.0)
    meta.fit(base_preds, y_val)
    return StackingEnsemble(models, meta)


def evaluate(name, model, X_val, y_val, X_test, y_test):
    y_pred_val = model.predict(X_val)
    y_pred_test = model.predict(X_test)

    val_mae = mean_absolute_error(y_val, y_pred_val)
    val_rmse = float(np.sqrt(mean_squared_error(y_val, y_pred_val)))
    val_r2 = r2_score(y_val, y_pred_val)

    test_mae = mean_absolute_error(y_test, y_pred_test)
    test_rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))
    test_r2 = r2_score(y_test, y_pred_test)

    return {
        "name": name,
        "val_mae": round(val_mae, 4),
        "val_rmse": round(val_rmse, 4),
        "val_r2": round(val_r2, 4),
        "test_mae": round(test_mae, 4),
        "test_rmse": round(test_rmse, 4),
        "test_r2": round(test_r2, 4),
    }


def time_series_cv(df, n_splits=5):
    """Time-series cross-validation — no future data leakage."""
    coords_rad = np.radians(df[["latitude", "longitude"]].values)
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=HDBSCAN_MIN_CLUSTER_SIZE,
        min_samples=HDBSCAN_MIN_SAMPLES,
        metric="haversine", core_dist_n_jobs=-1,
    )
    df = df.copy()
    df["hdbscan_cluster"] = clusterer.fit_predict(coords_rad)

    feature_df = df[FEATURE_COLUMNS].copy()
    for col in CATEGORICAL_FEATURES:
        if col in df.columns:
            feature_df[col] = df[col].astype("category").cat.codes
    feature_df["hdbscan_cluster"] = df["hdbscan_cluster"]
    target = df["congestion_score"].values

    tscv = TimeSeriesSplit(n_splits=n_splits)
    fold_results = []

    for fold, (train_idx, test_idx) in enumerate(tscv.split(feature_df)):
        X_tr, y_tr = feature_df.iloc[train_idx], target[train_idx]
        X_te, y_te = feature_df.iloc[test_idx], target[test_idx]

        model = LGBMRegressor(
            n_estimators=500, num_leaves=63, learning_rate=0.05,
            feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=5,
            random_state=42, n_jobs=-1, verbose=-1,
        )
        model.fit(X_tr, y_tr)
        y_pred = model.predict(X_te)

        fold_results.append({
            "fold": fold + 1,
            "train_size": len(train_idx),
            "test_size": len(test_idx),
            "mae": round(float(mean_absolute_error(y_te, y_pred)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_te, y_pred))), 4),
            "r2": round(float(r2_score(y_te, y_pred)), 4),
        })

    return fold_results


def segment_analysis(model, X_test, y_test, df_test):
    """Performance by hour, congestion level, junction status."""
    y_pred = model.predict(X_test)
    residuals = y_test - y_pred

    segments = {}

    # By congestion level
    levels = {}
    for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        mask = df_test["congestion_level"].values == level
        if mask.sum() > 10:
            levels[level] = {
                "count": int(mask.sum()),
                "mae": round(float(mean_absolute_error(y_test[mask], y_pred[mask])), 4),
                "r2": round(float(r2_score(y_test[mask], y_pred[mask])), 4) if mask.sum() > 5 else None,
                "mean_pred": round(float(y_pred[mask].mean()), 4),
                "mean_actual": round(float(y_test[mask].mean()), 4),
            }
    segments["by_level"] = levels

    # By hour buckets
    hours = {}
    hour_buckets = {"morning_rush": range(7, 10), "daytime": range(10, 17),
                    "evening_rush": range(17, 20), "night": list(range(20, 24)) + list(range(0, 7))}
    for name, hr_range in hour_buckets.items():
        mask = df_test["hour"].isin(hr_range).values
        if mask.sum() > 10:
            hours[name] = {
                "count": int(mask.sum()),
                "mae": round(float(mean_absolute_error(y_test[mask], y_pred[mask])), 4),
                "mean_pred": round(float(y_pred[mask].mean()), 4),
                "mean_actual": round(float(y_test[mask].mean()), 4),
            }
    segments["by_time"] = hours

    # By junction status
    junction = {}
    for is_j, label in [(1, "at_junction"), (0, "no_junction")]:
        mask = df_test["is_at_junction"].values == is_j
        if mask.sum() > 10:
            junction[label] = {
                "count": int(mask.sum()),
                "mae": round(float(mean_absolute_error(y_test[mask], y_pred[mask])), 4),
                "mean_pred": round(float(y_pred[mask].mean()), 4),
                "mean_actual": round(float(y_test[mask].mean()), 4),
            }
    segments["by_junction"] = junction

    return segments


def residual_analysis(y_test, y_pred):
    """Residual stats to check for bias."""
    residuals = y_test - y_pred
    return {
        "mean_residual": round(float(residuals.mean()), 4),
        "std_residual": round(float(residuals.std()), 4),
        "median_residual": round(float(np.median(residuals)), 4),
        "pct_within_1": round(float((np.abs(residuals) < 1).mean()), 4),
        "pct_within_5": round(float((np.abs(residuals) < 5).mean()), 4),
        "overestimate_pct": round(float((residuals < 0).mean()), 4),
    }


def save_all_models(models_dict, feature_cols):
    """Save models for API inference."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, model in models_dict.items():
        if name == "Stacking Ensemble":
            joblib.dump(model, MODEL_DIR / f"{name.lower().replace(' ', '_')}.pkl")
        elif name == "Voting Ensemble":
            joblib.dump(model, MODEL_DIR / f"{name.lower().replace(' ', '_')}.pkl")
        elif name == "LightGBM":
            model.booster_.save_model(str(MODEL_DIR / "lightgbm_regressor.txt"))
        elif name == "XGBoost":
            joblib.dump(model, MODEL_DIR / "xgboost_regressor.pkl")
        elif name == "CatBoost":
            model.save_model(str(MODEL_DIR / "catboost_regressor.cbm"))
        elif name == "Random Forest":
            joblib.dump(model, MODEL_DIR / "random_forest.pkl")
    joblib.dump(feature_cols, MODEL_DIR / "feature_columns.pkl")
    print(f"  Saved models to {MODEL_DIR}")


def main():
    print("=" * 60)
    print("MULTI-MODEL ENSEMBLE TRAINING")
    print("=" * 60)

    print("\n[1/8] Running pipeline...")
    df = run_pipeline()

    print("\n[2/8] Preparing data...")
    X_train, y_train, X_val, y_val, X_test, y_test = prepare_data(df)
    print(f"  Train: {len(X_train):,} | Val: {len(X_val):,} | Test: {len(X_test):,}")

    n = len(df)
    train_end = int(n * 0.7)
    val_end = int(n * 0.85)
    df_test = df.iloc[val_end:]

    results = []
    all_models = {}

    # LightGBM
    print("\n[3/8] Training LightGBM...")
    t0 = time.time()
    lgb_model = train_lightgbm(X_train, y_train, X_val, y_val)
    lgb_time = time.time() - t0
    r = evaluate("LightGBM", lgb_model, X_val, y_val, X_test, y_test)
    r["train_time_sec"] = round(lgb_time, 2)
    results.append(r)
    all_models["LightGBM"] = lgb_model
    print(f"  MAE={r['test_mae']:.4f}  R²={r['test_r2']:.4f}  ({lgb_time:.1f}s)")

    # XGBoost
    print("\n[4/8] Training XGBoost...")
    t0 = time.time()
    xgb_model = train_xgboost(X_train, y_train, X_val, y_val)
    xgb_time = time.time() - t0
    r = evaluate("XGBoost", xgb_model, X_val, y_val, X_test, y_test)
    r["train_time_sec"] = round(xgb_time, 2)
    results.append(r)
    all_models["XGBoost"] = xgb_model
    print(f"  MAE={r['test_mae']:.4f}  R²={r['test_r2']:.4f}  ({xgb_time:.1f}s)")

    # CatBoost
    print("\n[5/8] Training CatBoost...")
    t0 = time.time()
    cat_model = train_catboost(X_train, y_train, X_val, y_val)
    cat_time = time.time() - t0
    r = evaluate("CatBoost", cat_model, X_val, y_val, X_test, y_test)
    r["train_time_sec"] = round(cat_time, 2)
    results.append(r)
    all_models["CatBoost"] = cat_model
    print(f"  MAE={r['test_mae']:.4f}  R²={r['test_r2']:.4f}  ({cat_time:.1f}s)")

    # Random Forest
    print("\n[6/8] Training Random Forest...")
    t0 = time.time()
    rf_model = train_random_forest(X_train, y_train)
    rf_time = time.time() - t0
    r = evaluate("Random Forest", rf_model, X_val, y_val, X_test, y_test)
    r["train_time_sec"] = round(rf_time, 2)
    results.append(r)
    all_models["Random Forest"] = rf_model
    print(f"  MAE={r['test_mae']:.4f}  R²={r['test_r2']:.4f}  ({rf_time:.1f}s)")

    # Voting Ensemble
    print("\n[7/8] Building Voting Ensemble...")
    t0 = time.time()
    voting_model = build_voting_ensemble(list(all_models.values()))
    voting_time = time.time() - t0
    r = evaluate("Voting Ensemble", voting_model, X_val, y_val, X_test, y_test)
    r["train_time_sec"] = round(voting_time, 2)
    results.append(r)
    all_models["Voting Ensemble"] = voting_model
    print(f"  MAE={r['test_mae']:.4f}  R²={r['test_r2']:.4f}  ({voting_time:.1f}s)")

    # Stacking Ensemble
    print("\n[8/8] Building Stacking Ensemble...")
    t0 = time.time()
    stacking_model = build_stacking_ensemble(list(all_models.values())[:4], X_val, y_val)
    stacking_time = time.time() - t0
    r = evaluate("Stacking Ensemble", stacking_model, X_val, y_val, X_test, y_test)
    r["train_time_sec"] = round(stacking_time, 2)
    results.append(r)
    all_models["Stacking Ensemble"] = stacking_model
    print(f"  MAE={r['test_mae']:.4f}  R²={r['test_r2']:.4f}  ({stacking_time:.1f}s)")

    # Print summary
    print("\n" + "=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)
    print(f"{'Model':<22} {'Val MAE':>8} {'Val R²':>8} {'Test MAE':>9} {'Test R²':>8}")
    print("-" * 60)
    for r in results:
        print(f"{r['name']:<22} {r['val_mae']:>8.4f} {r['val_r2']:>8.4f} {r['test_mae']:>9.4f} {r['test_r2']:>8.4f}")

    best = max(results, key=lambda x: x["test_r2"])
    print(f"\n  Best model: {best['name']} (R²={best['test_r2']:.4f})")

    # --- VALIDATION ---
    print("\n" + "=" * 60)
    print("VALIDATION")
    print("=" * 60)

    print("\n  Time-series cross-validation (LightGBM, 5 folds)...")
    cv_results = time_series_cv(df)
    for f in cv_results:
        print(f"    Fold {f['fold']}: MAE={f['mae']:.4f}  R²={f['r2']:.4f}  (train={f['train_size']:,}, test={f['test_size']:,})")
    cv_mae = np.mean([f["mae"] for f in cv_results])
    cv_r2 = np.mean([f["r2"] for f in cv_results])
    print(f"    Mean: MAE={cv_mae:.4f}  R²={cv_r2:.4f}")

    print("\n  Segment analysis (best model: CatBoost)...")
    best_model = all_models[best["name"]] if best["name"] in all_models else list(all_models.values())[0]
    segments = segment_analysis(best_model, X_test, y_test, df_test)

    print("\n  Residual analysis...")
    y_pred_best = best_model.predict(X_test)
    residuals = residual_analysis(y_test, y_pred_best)
    print(f"    Mean residual: {residuals['mean_residual']:.4f} (0 = unbiased)")
    print(f"    {residuals['pct_within_1']:.1%} predictions within ±1")
    print(f"    {residuals['pct_within_5']:.1%} predictions within ±5")

    # Export all
    print("\n  Exporting...")
    with open(OUTPUT_DIR / "model_comparison.json", "w") as f:
        json.dump(results, f, indent=2, default=np_default)

    validation = {
        "cross_validation": cv_results,
        "cv_summary": {"mean_mae": round(cv_mae, 4), "mean_r2": round(cv_r2, 4), "folds": len(cv_results)},
        "segment_analysis": segments,
        "residual_analysis": residuals,
    }
    with open(OUTPUT_DIR / "validation_results.json", "w") as f:
        json.dump(validation, f, indent=2, default=np_default)

    save_all_models(all_models, list(X_train.columns))

    print(f"\n  Exported: model_comparison.json, validation_results.json")
    print(f"  Done!")


if __name__ == "__main__":
    main()
