import sys
import time
import warnings
warnings.filterwarnings("ignore")

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent.parent))

from parksense_ml.pipeline import run_pipeline
from parksense_ml.model import (
    detect_hotspots, train_congestion_model, train_classifier,
    compute_zone_priority, save_models,
)
from parksense_ml.visualize import (
    plot_hotspot_map, plot_shap_summary, plot_shap_bar,
    plot_temporal_patterns, plot_enforcement_priority,
    plot_cluster_analysis, generate_report,
)


def main():
    start_time = time.time()

    df = run_pipeline()

    print("\n" + "=" * 60)
    print("PHASE 2: HOTSPOT DETECTION (HDBSCAN)")
    print("=" * 60)

    print("\n[1/3] Clustering spatial hotspots...")
    cluster_labels, hdbscan_model = detect_hotspots(df)
    df["hdbscan_cluster"] = cluster_labels

    print("\n[2/3] Generating hotspot map...")
    plot_hotspot_map(df, cluster_labels)

    print("\n[3/3] Generating cluster analysis...")
    plot_cluster_analysis(df, cluster_labels)

    print("\n" + "=" * 60)
    print("PHASE 3: CONGESTION IMPACT PREDICTION (LightGBM)")
    print("=" * 60)

    print("\n[1/4] Training regression model...")
    reg_model, val_metrics, test_metrics, reg_outputs = train_congestion_model(df)

    print("\n[2/4] Training classifier...")
    clf_model, class_names, clf_outputs = train_classifier(df)

    print("\n[3/4] Computing zone enforcement priority...")
    zone_priority = compute_zone_priority(df)
    print(f"  Top 5 priority zones:")
    for _, row in zone_priority.head(5).iterrows():
        print(f"    #{int(row['rank'])} {row['police_station']} — Score: {row['priority_score']:.1f}")

    print("\n[4/4] Saving models...")
    save_models(hdbscan_model, reg_model, clf_model, zone_priority)

    print("\n" + "=" * 60)
    print("PHASE 4: EVALUATION & VISUALIZATION")
    print("=" * 60)

    X_val, y_val, y_pred_val, X_test, y_test, y_pred_test = reg_outputs

    print("\n[1/5] SHAP analysis...")
    feature_names = X_test.columns.tolist()
    plot_shap_summary(reg_model, X_test, feature_names)
    plot_shap_bar(reg_model, X_test, feature_names)

    print("\n[2/5] Temporal patterns...")
    plot_temporal_patterns(df)

    print("\n[3/5] Enforcement priority dashboard...")
    plot_enforcement_priority(zone_priority)

    print("\n[4/5] Generating final report...")
    generate_report(df, cluster_labels, zone_priority, val_metrics, test_metrics)

    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print(f"PIPELINE COMPLETE — Total time: {elapsed:.1f}s")
    print(f"{'=' * 60}")

    return df, reg_model, clf_model, zone_priority


if __name__ == "__main__":
    main()
