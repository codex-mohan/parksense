import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from parking_intelligence.pipeline import run_pipeline
from parking_intelligence.model import detect_hotspots, compute_zone_priority

OUTPUT_DIR = Path(__file__).parent.parent / "parksense" / "public" / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def np_default(obj):
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    raise TypeError(f"Not serializable: {type(obj)}")


def export_violations(df, cluster_labels):
    sample = df.sample(n=min(50000, len(df)), random_state=42).copy()
    sample["cluster"] = cluster_labels[sample.index]

    records = sample[[
        "latitude", "longitude", "congestion_score", "congestion_level",
        "hour", "day_of_week", "month", "is_weekend", "is_rush_hour",
        "is_at_junction", "vehicle_type", "police_station", "junction_name",
        "max_severity", "cluster",
    ]].to_dict(orient="records")

    with open(OUTPUT_DIR / "violations.json", "w") as f:
        json.dump(records, f, default=np_default)
    print(f"  Exported {len(records)} violations to violations.json")


def export_clusters(df, cluster_labels):
    df_copy = df.copy()
    df_copy["cluster"] = cluster_labels
    clustered = df_copy[df_copy["cluster"] != -1]

    cluster_stats = clustered.groupby("cluster").agg(
        lat=("latitude", "mean"),
        lon=("longitude", "mean"),
        count=("id", "count"),
        mean_score=("congestion_score", "mean"),
        max_score=("congestion_score", "max"),
        junction_pct=("is_at_junction", "mean"),
        heavy_pct=("is_heavy_vehicle", "mean"),
        top_station=("police_station", lambda x: x.mode().iloc[0]),
        top_junction=("junction_name", lambda x: x[x != "No Junction"].mode().iloc[0] if (x != "No Junction").any() else "No Junction"),
    ).reset_index()

    cluster_stats = cluster_stats.sort_values("count", ascending=False).head(100)

    records = cluster_stats.to_dict(orient="records")
    with open(OUTPUT_DIR / "clusters.json", "w") as f:
        json.dump(records, f, default=np_default)
    print(f"  Exported {len(records)} clusters to clusters.json")


def export_zones(df):
    zone_priority = compute_zone_priority(df)

    centroids = df.groupby("police_station").agg(
        lat=("latitude", "mean"),
        lon=("longitude", "mean"),
    ).reset_index()
    zone_priority = zone_priority.merge(centroids, on="police_station", how="left")

    records = zone_priority.to_dict(orient="records")
    with open(OUTPUT_DIR / "zones.json", "w") as f:
        json.dump(records, f, default=np_default)
    print(f"  Exported {len(records)} zones to zones.json")


def export_temporal(df):
    hourly = df.groupby("hour").agg(
        count=("id", "count"),
        mean_score=("congestion_score", "mean"),
        critical_pct=("congestion_level", lambda x: (x == "CRITICAL").mean()),
    ).reset_index().to_dict(orient="records")

    daily = df.groupby("day_of_week").agg(
        count=("id", "count"),
        mean_score=("congestion_score", "mean"),
    ).reset_index().to_dict(orient="records")

    monthly = df.groupby("month").agg(
        count=("id", "count"),
        mean_score=("congestion_score", "mean"),
    ).reset_index().to_dict(orient="records")

    vehicle_dist = df["vehicle_type"].value_counts().head(10).reset_index().to_dict(orient="records")
    violation_dist = df["violation_types"].explode().value_counts().head(8).reset_index().to_dict(orient="records")

    level_dist = df["congestion_level"].value_counts().reset_index().to_dict(orient="records")

    temporal = {
        "hourly": hourly,
        "daily": daily,
        "monthly": monthly,
        "vehicle_distribution": vehicle_dist,
        "violation_distribution": violation_dist,
        "level_distribution": level_dist,
    }
    with open(OUTPUT_DIR / "temporal.json", "w") as f:
        json.dump(temporal, f, default=np_default)
    print(f"  Exported temporal data to temporal.json")


def export_summary(df, cluster_labels):
    n_clusters = len(set(cluster_labels) - {-1})
    summary = {
        "total_violations": int(len(df)),
        "date_range": {
            "start": str(df["created_datetime"].min().date()),
            "end": str(df["created_datetime"].max().date()),
        },
        "total_clusters": n_clusters,
        "total_zones": int(df["police_station"].nunique()),
        "junction_pct": float(df["is_at_junction"].mean()),
        "rush_hour_pct": float(df["is_rush_hour"].mean()),
        "mean_score": float(df["congestion_score"].mean()),
        "critical_pct": float((df["congestion_level"] == "CRITICAL").mean()),
        "top_vehicle": df["vehicle_type"].mode().iloc[0],
        "top_violation": df["violation_types"].explode().mode().iloc[0],
        "center_lat": float(df["latitude"].mean()),
        "center_lon": float(df["longitude"].mean()),
    }
    with open(OUTPUT_DIR / "summary.json", "w") as f:
        json.dump(summary, f, default=np_default, indent=2)
    print(f"  Exported summary to summary.json")


def main():
    print("Exporting model data for ParkSense frontend...")
    df = run_pipeline()

    print("\n[1/5] Detecting hotspots...")
    cluster_labels, _ = detect_hotspots(df)

    print("\n[2/5] Exporting violations...")
    export_violations(df, cluster_labels)

    print("\n[3/5] Exporting clusters...")
    export_clusters(df, cluster_labels)

    print("\n[4/5] Exporting zones and temporal data...")
    export_zones(df)
    export_temporal(df)

    print("\n[5/5] Exporting summary...")
    export_summary(df, cluster_labels)

    print(f"\nDone! All data exported to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
