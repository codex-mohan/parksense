import numpy as np
import pandas as pd
import hdbscan
import lightgbm as lgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    classification_report, confusion_matrix,
)
import joblib

from .config import (
    HDBSCAN_MIN_CLUSTER_SIZE, HDBSCAN_MIN_SAMPLES,
    MODEL_DIR,
)


FEATURE_COLUMNS = [
    "latitude", "longitude", "hour", "day_of_week", "month",
    "is_weekend", "is_rush_hour", "is_at_junction", "is_heavy_vehicle",
    "has_main_road_violation", "has_wrong_parking", "has_no_parking",
    "has_footpath_parking", "has_double_parking", "has_junction_parking",
    "violation_count", "max_severity",
]

CATEGORICAL_FEATURES = [
    "police_station", "vehicle_type", "vehicle_category",
    "time_period", "junction_name",
]


def detect_hotspots(df):
    coords_rad = np.radians(df[["latitude", "longitude"]].values)

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=HDBSCAN_MIN_CLUSTER_SIZE,
        min_samples=HDBSCAN_MIN_SAMPLES,
        metric=HDBSCAN_METRIC,
        core_dist_n_jobs=-1,
    )
    cluster_labels = clusterer.fit_predict(coords_rad)

    n_clusters = len(set(cluster_labels) - {-1})
    noise_pct = (cluster_labels == -1).mean()

    print(f"  Found {n_clusters} hotspot clusters")
    print(f"  Noise points: {noise_pct:.1%}")

    return cluster_labels, clusterer


HDBSCAN_METRIC = "haversine"


def prepare_features(df, encode_categoricals=True):
    feature_df = df[FEATURE_COLUMNS].copy()

    for col in CATEGORICAL_FEATURES:
        if col in df.columns:
            if encode_categoricals:
                feature_df[col] = df[col].astype("category").cat.codes
            else:
                feature_df[col] = df[col]

    feature_df["hdbscan_cluster"] = df["hdbscan_cluster"]

    return feature_df


def train_congestion_model(df, target_col="congestion_score"):
    feature_df = prepare_features(df)
    target = df[target_col].values

    n = len(df)
    train_end = int(n * 0.7)
    val_end = int(n * 0.85)

    X_train = feature_df.iloc[:train_end]
    y_train = target[:train_end]
    X_val = feature_df.iloc[train_end:val_end]
    y_val = target[train_end:val_end]
    X_test = feature_df.iloc[val_end:]
    y_test = target[val_end:]

    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)

    params = {
        "objective": "regression",
        "metric": "mae",
        "boosting_type": "gbdt",
        "num_leaves": 63,
        "learning_rate": 0.05,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "verbose": -1,
        "n_jobs": -1,
        "seed": 42,
    }

    callbacks = [
        lgb.early_stopping(50),
        lgb.log_evaluation(100),
    ]

    model = lgb.train(
        params,
        train_data,
        num_boost_round=1000,
        valid_sets=[val_data],
        callbacks=callbacks,
    )

    y_pred_val = model.predict(X_val)
    y_pred_test = model.predict(X_test)

    val_metrics = {
        "mae": mean_absolute_error(y_val, y_pred_val),
        "rmse": np.sqrt(mean_squared_error(y_val, y_pred_val)),
        "r2": r2_score(y_val, y_pred_val),
    }
    test_metrics = {
        "mae": mean_absolute_error(y_test, y_pred_test),
        "rmse": np.sqrt(mean_squared_error(y_test, y_pred_test)),
        "r2": r2_score(y_test, y_pred_test),
    }

    print(f"\n  Validation MAE: {val_metrics['mae']:.2f}  RMSE: {val_metrics['rmse']:.2f}  R²: {val_metrics['r2']:.3f}")
    print(f"  Test MAE:       {test_metrics['mae']:.2f}  RMSE: {test_metrics['rmse']:.2f}  R²: {test_metrics['r2']:.3f}")

    return model, val_metrics, test_metrics, (X_val, y_val, y_pred_val, X_test, y_test, y_pred_test)


def train_classifier(df, target_col="congestion_level"):
    feature_df = prepare_features(df)
    target = df[target_col].cat.codes.values
    class_names = df[target_col].cat.categories.tolist()

    n = len(df)
    train_end = int(n * 0.7)
    val_end = int(n * 0.85)

    X_train = feature_df.iloc[:train_end]
    y_train = target[:train_end]
    X_val = feature_df.iloc[train_end:val_end]
    y_val = target[train_end:val_end]
    X_test = feature_df.iloc[val_end:]
    y_test = target[val_end:]

    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)

    params = {
        "objective": "multiclass",
        "num_class": len(class_names),
        "metric": "multi_logloss",
        "boosting_type": "gbdt",
        "num_leaves": 63,
        "learning_rate": 0.05,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "verbose": -1,
        "n_jobs": -1,
        "seed": 42,
    }

    callbacks = [
        lgb.early_stopping(50),
        lgb.log_evaluation(100),
    ]

    clf = lgb.train(
        params,
        train_data,
        num_boost_round=1000,
        valid_sets=[val_data],
        callbacks=callbacks,
    )

    y_pred_test = clf.predict(X_test).argmax(axis=1)
    print(f"\n  Classification Report (Test Set):")
    print(classification_report(y_test, y_pred_test, target_names=class_names))

    return clf, class_names, (X_test, y_test, y_pred_test)


def compute_zone_priority(df):
    zone_stats = df.groupby("police_station").agg(
        violation_count=("id", "count"),
        mean_score=("congestion_score", "mean"),
        max_score=("congestion_score", "max"),
        junction_pct=("is_at_junction", "mean"),
        heavy_vehicle_pct=("is_heavy_vehicle", "mean"),
        critical_pct=("congestion_level", lambda x: (x == "CRITICAL").mean()),
    ).reset_index()

    zone_stats["priority_score"] = (
        zone_stats["violation_count"] * 0.3
        + zone_stats["mean_score"] * 0.25
        + zone_stats["critical_pct"] * 100 * 0.25
        + zone_stats["junction_pct"] * 100 * 0.2
    )

    zone_stats = zone_stats.sort_values("priority_score", ascending=False).reset_index(drop=True)
    zone_stats["rank"] = range(1, len(zone_stats) + 1)

    return zone_stats


def save_models(hdbscan_model, lgb_model, lgb_clf, zone_priority):
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(hdbscan_model, MODEL_DIR / "hdbscan_clusterer.pkl")
    lgb_model.save_model(str(MODEL_DIR / "lightgbm_regressor.txt"))
    lgb_clf.save_model(str(MODEL_DIR / "lightgbm_classifier.txt"))
    zone_priority.to_csv(MODEL_DIR / "zone_priority.csv", index=False)
    print(f"\n  Models saved to {MODEL_DIR}")
