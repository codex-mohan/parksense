import json
import numpy as np
import pandas as pd
from datetime import time as dtime

from .config import (
    DATA_PATH, DEAD_COLUMNS, MARGINAL_COLUMNS,
    BENGALURU_LAT_MIN, BENGALURU_LAT_MAX,
    BENGALURU_LON_MIN, BENGALURU_LON_MAX,
    VIOLATION_SEVERITY, HEAVY_VEHICLES, MEDIUM_VEHICLES,
    RUSH_MORNING, RUSH_EVENING, NIGHT_START, NIGHT_END,
    GRID_RESOLUTION_DEG,
)


def load_raw(path=DATA_PATH):
    df = pd.read_csv(path, low_memory=False)
    return df


def smoke_test_raw(df):
    errors = []
    if len(df) < 1000:
        errors.append(f"Row count too low: {len(df)}")
    expected = [
        "id", "latitude", "longitude", "violation_type", "created_datetime",
        "junction_name", "police_station", "vehicle_type", "validation_status",
    ]
    missing = [c for c in expected if c not in df.columns]
    if missing:
        errors.append(f"Missing critical columns: {missing}")
    lat_ok = df["latitude"].between(BENGALURU_LAT_MIN, BENGALURU_LAT_MAX).mean()
    if lat_ok < 0.90:
        errors.append(f"Only {lat_ok:.1%} of latitudes in Bengaluru bbox")
    lon_ok = df["longitude"].between(BENGALURU_LON_MIN, BENGALURU_LON_MAX).mean()
    if lon_ok < 0.90:
        errors.append(f"Only {lon_ok:.1%} of longitudes in Bengaluru bbox")
    dt = pd.to_datetime(df["created_datetime"], errors="coerce", utc=True)
    nat_pct = dt.isna().mean()
    if nat_pct > 0.05:
        errors.append(f"{nat_pct:.1%} of created_datetime failed to parse")
    if errors:
        raise ValueError("Smoke test FAILED:\n" + "\n".join(f"  - {e}" for e in errors))


def clean(df):
    df = df.drop(columns=[c for c in DEAD_COLUMNS if c in df.columns], errors="ignore")
    df = df.drop(columns=[c for c in MARGINAL_COLUMNS if c in df.columns], errors="ignore")

    before = len(df)
    df = df[df["validation_status"] == "approved"].copy()
    dropped = before - len(df)
    if dropped > 0:
        print(f"  Dropped {dropped:,} non-approved rows ({dropped/before:.1%})")

    df = df.dropna(subset=["latitude", "longitude", "created_datetime", "violation_type"])

    df = df[
        df["latitude"].between(BENGALURU_LAT_MIN, BENGALURU_LAT_MAX)
        & df["longitude"].between(BENGALURU_LON_MIN, BENGALURU_LON_MAX)
    ].copy()

    df["created_datetime"] = pd.to_datetime(df["created_datetime"], utc=True)
    df = df.sort_values("created_datetime").reset_index(drop=True)

    df["junction_name"] = df["junction_name"].fillna("No Junction")
    df["police_station"] = df["police_station"].fillna("Unknown")
    df["vehicle_type"] = df["vehicle_type"].fillna("OTHERS")

    return df


def parse_violation_types(raw_str):
    if pd.isna(raw_str) or raw_str == "NULL":
        return []
    try:
        parsed = json.loads(raw_str)
        if isinstance(parsed, list):
            return [str(v).strip().upper() for v in parsed]
        return [str(parsed).strip().upper()]
    except (json.JSONDecodeError, TypeError):
        return [str(raw_str).strip().upper()]


def parse_offence_codes(raw_str):
    if pd.isna(raw_str) or raw_str == "NULL":
        return []
    try:
        parsed = json.loads(raw_str)
        if isinstance(parsed, list):
            return [int(v) for v in parsed]
        return [int(parsed)]
    except (json.JSONDecodeError, TypeError, ValueError):
        return []


def engineer_features(df):
    df = df.copy()

    df["violation_types"] = df["violation_type"].apply(parse_violation_types)
    df["offence_codes"] = df["offence_code"].apply(parse_offence_codes)

    df["hour"] = df["created_datetime"].dt.hour
    df["day_of_week"] = df["created_datetime"].dt.dayofweek
    df["month"] = df["created_datetime"].dt.month
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["week_number"] = df["created_datetime"].dt.isocalendar().week.astype(int)

    df["is_rush_hour"] = (
        df["hour"].between(RUSH_MORNING[0], RUSH_MORNING[1] - 1)
        | df["hour"].between(RUSH_EVENING[0], RUSH_EVENING[1] - 1)
    ).astype(int)

    df["time_period"] = "normal"
    df.loc[df["hour"].between(RUSH_MORNING[0], RUSH_MORNING[1] - 1), "time_period"] = "morning_rush"
    df.loc[df["hour"].between(RUSH_EVENING[0], RUSH_EVENING[1] - 1), "time_period"] = "evening_rush"
    night_mask = (df["hour"] >= NIGHT_START) | (df["hour"] <= NIGHT_END)
    df.loc[night_mask, "time_period"] = "night"

    df["is_at_junction"] = (df["junction_name"] != "No Junction").astype(int)

    df["vehicle_category"] = "light"
    df.loc[df["vehicle_type"].isin(HEAVY_VEHICLES), "vehicle_category"] = "heavy"
    df.loc[df["vehicle_type"].isin(MEDIUM_VEHICLES), "vehicle_category"] = "medium"

    df["is_heavy_vehicle"] = (df["vehicle_category"] == "heavy").astype(int)

    df["has_main_road_violation"] = df["violation_types"].apply(
        lambda x: int("PARKING IN A MAIN ROAD" in x)
    )
    df["has_wrong_parking"] = df["violation_types"].apply(
        lambda x: int("WRONG PARKING" in x)
    )
    df["has_no_parking"] = df["violation_types"].apply(
        lambda x: int("NO PARKING" in x)
    )
    df["has_footpath_parking"] = df["violation_types"].apply(
        lambda x: int("PARKING ON FOOTPATH" in x)
    )
    df["has_double_parking"] = df["violation_types"].apply(
        lambda x: int("DOUBLE PARKING" in x)
    )
    df["has_junction_parking"] = df["violation_types"].apply(
        lambda x: int("PARKING NEAR ROAD CROSSING" in x)
    )
    df["violation_count"] = df["violation_types"].apply(len)

    df["max_severity"] = df["violation_types"].apply(
        lambda x: max(VIOLATION_SEVERITY.get(v, 1) for v in x) if x else 0
    )

    df["grid_lat"] = (df["latitude"] / GRID_RESOLUTION_DEG).round().astype(int)
    df["grid_lon"] = (df["longitude"] / GRID_RESOLUTION_DEG).round().astype(int)
    df["grid_cell"] = df["grid_lat"].astype(str) + "_" + df["grid_lon"].astype(str)

    return df


def create_congestion_target(df):
    df = df.copy()

    time_mult = np.where(
        df["hour"].between(RUSH_MORNING[0], RUSH_MORNING[1] - 1), 1.5,
        np.where(
            df["hour"].between(RUSH_EVENING[0], RUSH_EVENING[1] - 1), 2.0,
            np.where(
                (df["hour"] >= NIGHT_START) | (df["hour"] <= NIGHT_END), 0.3, 1.0,
            ),
        ),
    )

    junction_mult = np.where(df["is_at_junction"] == 1, 2.0, 1.0)

    vehicle_mult = np.where(
        df["vehicle_category"] == "heavy", 2.0,
        np.where(df["vehicle_category"] == "medium", 1.3, 1.0),
    )

    raw_score = df["max_severity"].values * junction_mult * time_mult * vehicle_mult

    p99 = np.percentile(raw_score, 99)
    normalized = np.clip(raw_score / p99 * 100, 0, 100)

    df["congestion_score"] = normalized

    bins = [0, 25, 50, 75, 100]
    labels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    df["congestion_level"] = pd.cut(normalized, bins=bins, labels=labels, include_lowest=True)

    return df


def smoke_test_features(df):
    errors = []
    if df["violation_types"].apply(len).sum() == 0:
        errors.append("All violation_types are empty after parsing")
    if df["hour"].isna().any():
        errors.append("NaN values in hour feature")
    if df["congestion_score"].isna().any():
        errors.append("NaN values in congestion_score")
    if (df["congestion_score"] < 0).any():
        errors.append("Negative congestion scores")
    if df["grid_cell"].nunique() < 10:
        errors.append(f"Too few grid cells: {df['grid_cell'].nunique()}")
    if errors:
        raise ValueError("Feature smoke test FAILED:\n" + "\n".join(f"  - {e}" for e in errors))


def run_pipeline():
    print("=" * 60)
    print("PHASE 1: DATA LOADING & CLEANING")
    print("=" * 60)

    print("\n[1/6] Loading raw data...")
    df = load_raw()
    print(f"  Loaded {len(df):,} rows x {len(df.columns)} columns")

    print("\n[2/6] Running raw smoke tests...")
    smoke_test_raw(df)
    print("  All smoke tests passed")

    print("\n[3/6] Cleaning data...")
    df = clean(df)
    print(f"  {len(df):,} rows after cleaning")

    print("\n[4/6] Engineering features...")
    df = engineer_features(df)
    print(f"  Created {len(df.columns)} total columns")

    print("\n[5/6] Creating congestion impact target...")
    df = create_congestion_target(df)
    print(f"  Score range: {df['congestion_score'].min():.1f} - {df['congestion_score'].max():.1f}")
    print(f"  Level distribution:")
    for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        count = (df["congestion_level"] == level).sum()
        print(f"    {level}: {count:,} ({count/len(df):.1%})")

    print("\n[6/6] Running feature smoke tests...")
    smoke_test_features(df)
    print("  All feature smoke tests passed")

    return df
