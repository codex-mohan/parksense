import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns
import folium
from folium.plugins import HeatMap, MarkerCluster
import shap

from .config import FIGURE_DIR, REPORT_DIR


def ensure_dirs():
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


def plot_hotspot_map(df, cluster_labels):
    ensure_dirs()
    center_lat = df["latitude"].mean()
    center_lon = df["longitude"].mean()

    m = folium.Map(location=[center_lat, center_lon], zoom_start=12, tiles="CartoDB positron")

    hotspots = df[cluster_labels != -1].copy()
    hotspots["cluster"] = cluster_labels[cluster_labels != -1]

    heat_data = hotspots[["latitude", "longitude"]].values.tolist()
    HeatMap(heat_data, radius=12, blur=15, max_zoom=15, name="Violation Density").add_to(m)

    cluster_stats = hotspots.groupby("cluster").agg(
        lat=("latitude", "mean"),
        lon=("longitude", "mean"),
        count=("id", "count"),
        mean_score=("congestion_score", "mean"),
        top_station=("police_station", lambda x: x.mode().iloc[0] if len(x) > 0 else "Unknown"),
    ).reset_index()

    cluster_stats = cluster_stats.sort_values("count", ascending=False).head(20)

    marker_cluster = MarkerCluster(name="Top Hotspots").add_to(m)

    for _, row in cluster_stats.iterrows():
        popup_html = (
            f"<b>Cluster {int(row['cluster'])}</b><br>"
            f"Violations: {int(row['count'])}<br>"
            f"Avg Congestion Score: {row['mean_score']:.1f}<br>"
            f"Zone: {row['top_station']}"
        )
        folium.Marker(
            location=[row["lat"], row["lon"]],
            popup=folium.Popup(popup_html, max_width=300),
            icon=folium.Icon(color="red", icon="exclamation-triangle", prefix="fa"),
        ).add_to(marker_cluster)

    folium.LayerControl().add_to(m)

    out_path = FIGURE_DIR / "hotspot_map.html"
    m.save(str(out_path))
    print(f"  Hotspot map saved to {out_path}")
    return out_path


def plot_shap_summary(model, X_test, feature_names):
    ensure_dirs()
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test.iloc[:5000])

    fig, ax = plt.subplots(figsize=(12, 8))
    shap.summary_plot(shap_values, X_test.iloc[:5000], feature_names=feature_names, show=False, max_display=20)
    plt.title("SHAP Feature Importance — Congestion Impact Prediction", fontsize=14, fontweight="bold")
    plt.tight_layout()
    out_path = FIGURE_DIR / "shap_summary.png"
    plt.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  SHAP summary saved to {out_path}")
    return out_path


def plot_shap_bar(model, X_test, feature_names):
    ensure_dirs()
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test.iloc[:5000])

    fig, ax = plt.subplots(figsize=(10, 7))
    shap.summary_plot(shap_values, X_test.iloc[:5000], feature_names=feature_names, plot_type="bar", show=False, max_display=20)
    plt.title("SHAP Feature Importance (Bar)", fontsize=14, fontweight="bold")
    plt.tight_layout()
    out_path = FIGURE_DIR / "shap_bar.png"
    plt.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  SHAP bar chart saved to {out_path}")
    return out_path


def plot_temporal_patterns(df):
    ensure_dirs()
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))

    hourly = df.groupby("hour")["congestion_score"].agg(["mean", "count"]).reset_index()
    ax = axes[0, 0]
    ax.bar(hourly["hour"], hourly["mean"], color="#e74c3c", alpha=0.8)
    ax.set_xlabel("Hour of Day")
    ax.set_ylabel("Mean Congestion Score")
    ax.set_title("Hourly Congestion Pattern", fontweight="bold")
    ax.set_xticks(range(0, 24))
    ax.axvspan(7, 10, alpha=0.15, color="orange", label="Morning Rush")
    ax.axvspan(17, 20, alpha=0.15, color="red", label="Evening Rush")
    ax.legend()

    daily = df.groupby("day_of_week")["congestion_score"].agg(["mean", "count"]).reset_index()
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    ax = axes[0, 1]
    ax.bar(daily["day_of_week"], daily["mean"], color="#3498db", alpha=0.8)
    ax.set_xlabel("Day of Week")
    ax.set_ylabel("Mean Congestion Score")
    ax.set_title("Daily Congestion Pattern", fontweight="bold")
    ax.set_xticks(range(7))
    ax.set_xticklabels(day_names)

    monthly = df.groupby("month")["congestion_score"].agg(["mean", "count"]).reset_index()
    ax = axes[1, 0]
    ax.bar(monthly["month"], monthly["mean"], color="#2ecc71", alpha=0.8)
    ax.set_xlabel("Month")
    ax.set_ylabel("Mean Congestion Score")
    ax.set_title("Monthly Congestion Trend", fontweight="bold")
    month_labels = {11: "Nov", 12: "Dec", 1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr"}
    ax.set_xticks(list(month_labels.keys()))
    ax.set_xticklabels(list(month_labels.values()))

    level_counts = df["congestion_level"].value_counts().reindex(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    colors = ["#2ecc71", "#f1c40f", "#e67e22", "#e74c3c"]
    ax = axes[1, 1]
    ax.pie(level_counts.values, labels=level_counts.index, colors=colors, autopct="%1.1f%%", startangle=90)
    ax.set_title("Congestion Level Distribution", fontweight="bold")

    plt.suptitle("Temporal Analysis of Parking Violations — Bengaluru", fontsize=16, fontweight="bold", y=1.01)
    plt.tight_layout()
    out_path = FIGURE_DIR / "temporal_patterns.png"
    plt.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Temporal patterns saved to {out_path}")
    return out_path


def plot_enforcement_priority(zone_priority):
    ensure_dirs()
    top_20 = zone_priority.head(20).copy()

    fig, axes = plt.subplots(1, 2, figsize=(18, 8))

    ax = axes[0]
    bars = ax.barh(
        top_20["police_station"][::-1],
        top_20["priority_score"][::-1],
        color=plt.cm.Reds(np.linspace(0.3, 0.9, len(top_20)))[::-1],
    )
    ax.set_xlabel("Enforcement Priority Score")
    ax.set_title("Top 20 Zones by Enforcement Priority", fontweight="bold")
    for bar, score in zip(bars, top_20["priority_score"][::-1]):
        ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2,
                f"{score:.1f}", va="center", fontsize=9)

    ax = axes[1]
    scatter = ax.scatter(
        top_20["violation_count"],
        top_20["mean_score"],
        s=top_20["critical_pct"] * 500 + 20,
        c=top_20["junction_pct"],
        cmap="YlOrRd",
        alpha=0.7,
        edgecolors="black",
        linewidth=0.5,
    )
    for _, row in top_20.iterrows():
        ax.annotate(
            row["police_station"],
            (row["violation_count"], row["mean_score"]),
            fontsize=7, ha="center", va="bottom",
        )
    ax.set_xlabel("Total Violations")
    ax.set_ylabel("Mean Congestion Score")
    ax.set_title("Zone Risk Map (size=critical%, color=junction%)", fontweight="bold")
    plt.colorbar(scatter, ax=ax, label="Junction Proximity %")

    plt.suptitle("Enforcement Priority Dashboard", fontsize=16, fontweight="bold", y=1.01)
    plt.tight_layout()
    out_path = FIGURE_DIR / "enforcement_priority.png"
    plt.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Enforcement priority saved to {out_path}")
    return out_path


def plot_cluster_analysis(df, cluster_labels):
    ensure_dirs()
    df_copy = df.copy()
    df_copy["cluster"] = cluster_labels

    clustered = df_copy[df_copy["cluster"] != -1]

    cluster_summary = clustered.groupby("cluster").agg(
        count=("id", "count"),
        mean_score=("congestion_score", "mean"),
        lat=("latitude", "mean"),
        lon=("longitude", "mean"),
        top_station=("police_station", lambda x: x.mode().iloc[0]),
        junction_pct=("is_at_junction", "mean"),
    ).reset_index()

    cluster_summary = cluster_summary.sort_values("count", ascending=False).head(15)

    fig, axes = plt.subplots(1, 2, figsize=(16, 7))

    ax = axes[0]
    ax.barh(
        cluster_summary["cluster"].astype(str)[::-1],
        cluster_summary["count"][::-1],
        color="#e74c3c", alpha=0.8,
    )
    ax.set_xlabel("Violation Count")
    ax.set_title("Top 15 Hotspot Clusters by Volume", fontweight="bold")

    ax = axes[1]
    ax.barh(
        cluster_summary["cluster"].astype(str)[::-1],
        cluster_summary["mean_score"][::-1],
        color="#3498db", alpha=0.8,
    )
    ax.set_xlabel("Mean Congestion Score")
    ax.set_title("Top 15 Hotspot Clusters by Severity", fontweight="bold")

    plt.suptitle("Hotspot Cluster Analysis", fontsize=16, fontweight="bold", y=1.01)
    plt.tight_layout()
    out_path = FIGURE_DIR / "cluster_analysis.png"
    plt.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Cluster analysis saved to {out_path}")
    return out_path


def generate_report(df, cluster_labels, zone_priority, val_metrics, test_metrics):
    ensure_dirs()
    n_clusters = len(set(cluster_labels) - {-1})
    noise_pct = (cluster_labels == -1).mean()

    report = []
    report.append("=" * 70)
    report.append("PARKING CONGESTION INTELLIGENCE — ANALYSIS REPORT")
    report.append("=" * 70)
    report.append("")
    report.append(f"Total violations analyzed: {len(df):,}")
    report.append(f"Date range: {df['created_datetime'].min().date()} to {df['created_datetime'].max().date()}")
    report.append(f"Unique locations: {df['grid_cell'].nunique():,} grid cells")
    report.append("")
    report.append("--- HOTSPOT DETECTION (HDBSCAN) ---")
    report.append(f"Hotspot clusters found: {n_clusters}")
    report.append(f"Noise points: {noise_pct:.1%}")
    report.append("")

    top_clusters = df[cluster_labels != -1].copy()
    top_clusters["cluster"] = cluster_labels[cluster_labels != -1]
    cluster_stats = top_clusters.groupby("cluster").agg(
        count=("id", "count"),
        mean_score=("congestion_score", "mean"),
        station=("police_station", lambda x: x.mode().iloc[0]),
    ).sort_values("count", ascending=False).head(10)

    report.append("Top 10 Hotspot Clusters:")
    for cluster_id, row in cluster_stats.iterrows():
        report.append(f"  Cluster {cluster_id:3d}: {int(row['count']):5d} violations | "
                      f"Score: {row['mean_score']:5.1f} | Zone: {row['station']}")
    report.append("")

    report.append("--- CONGESTION IMPACT MODEL (LightGBM) ---")
    report.append(f"Validation — MAE: {val_metrics['mae']:.2f}  RMSE: {val_metrics['rmse']:.2f}  R²: {val_metrics['r2']:.3f}")
    report.append(f"Test       — MAE: {test_metrics['mae']:.2f}  RMSE: {test_metrics['rmse']:.2f}  R²: {test_metrics['r2']:.3f}")
    report.append("")

    report.append("--- ENFORCEMENT PRIORITY (Top 15 Zones) ---")
    for _, row in zone_priority.head(15).iterrows():
        report.append(
            f"  #{int(row['rank']):2d} {row['police_station']:<25s} "
            f"Violations: {int(row['violation_count']):5d} | "
            f"Score: {row['mean_score']:5.1f} | "
            f"Critical: {row['critical_pct']:.1%} | "
            f"Junction: {row['junction_pct']:.1%}"
        )
    report.append("")

    report.append("--- KEY FINDINGS ---")
    rush_pct = df["is_rush_hour"].mean()
    junction_pct = df["is_at_junction"].mean()
    report.append(f"  {rush_pct:.1%} of violations occur during rush hours")
    report.append(f"  {junction_pct:.1%} of violations are at/near junctions")
    top_vehicle = df["vehicle_type"].mode().iloc[0]
    report.append(f"  Most common violating vehicle: {top_vehicle}")
    top_violation = df["violation_types"].explode().mode().iloc[0]
    report.append(f"  Most common violation type: {top_violation}")
    top_zone = zone_priority.iloc[0]["police_station"]
    report.append(f"  Highest priority enforcement zone: {top_zone}")

    report_text = "\n".join(report)
    out_path = REPORT_DIR / "analysis_report.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"\n  Report saved to {out_path}")
    print("\n" + report_text)
    return out_path
