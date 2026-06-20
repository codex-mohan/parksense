import numpy as np
import pandas as pd
import joblib
import lightgbm as lgb
from pathlib import Path

from .config import MODEL_DIR, GRID_RESOLUTION_DEG, VIOLATION_SEVERITY, HEAVY_VEHICLES, MEDIUM_VEHICLES


class ParkingCongestionPredictor:
    def __init__(self):
        self.regressor = lgb.Booster(model_file=str(MODEL_DIR / "lightgbm_regressor.txt"))
        self.classifier = lgb.Booster(model_file=str(MODEL_DIR / "lightgbm_classifier.txt"))
        self.zone_priority = pd.read_csv(MODEL_DIR / "zone_priority.csv")

    def predict(self, latitude, longitude, hour, day_of_week, month,
                police_station, vehicle_type, junction_name,
                violation_type="NO PARKING"):
        is_weekend = int(day_of_week >= 5)
        is_rush_hour = int((7 <= hour <= 10) or (17 <= hour <= 20))
        is_at_junction = int(junction_name != "No Junction")
        is_heavy_vehicle = int(vehicle_type in HEAVY_VEHICLES)
        vehicle_category = "heavy" if vehicle_type in HEAVY_VEHICLES else (
            "medium" if vehicle_type in MEDIUM_VEHICLES else "light"
        )
        if 7 <= hour <= 10:
            time_period = "morning_rush"
        elif 17 <= hour <= 20:
            time_period = "evening_rush"
        elif hour >= 22 or hour <= 5:
            time_period = "night"
        else:
            time_period = "normal"

        vtypes = [v.strip().upper() for v in violation_type.split(",")]
        has_main_road = int("PARKING IN A MAIN ROAD" in vtypes)
        has_wrong_parking = int("WRONG PARKING" in vtypes)
        has_no_parking = int("NO PARKING" in vtypes)
        has_footpath = int("PARKING ON FOOTPATH" in vtypes)
        has_double = int("DOUBLE PARKING" in vtypes)
        has_junction = int("PARKING NEAR ROAD CROSSING" in vtypes)
        violation_count = len(vtypes)
        max_severity = max(VIOLATION_SEVERITY.get(v, 1) for v in vtypes) if vtypes else 0

        grid_lat = round(latitude / GRID_RESOLUTION_DEG)
        grid_lon = round(longitude / GRID_RESOLUTION_DEG)

        features = pd.DataFrame([{
            "latitude": latitude,
            "longitude": longitude,
            "hour": hour,
            "day_of_week": day_of_week,
            "month": month,
            "is_weekend": is_weekend,
            "is_rush_hour": is_rush_hour,
            "is_at_junction": is_at_junction,
            "is_heavy_vehicle": is_heavy_vehicle,
            "has_main_road_violation": has_main_road,
            "has_wrong_parking": has_wrong_parking,
            "has_no_parking": has_no_parking,
            "has_footpath_parking": has_footpath,
            "has_double_parking": has_double,
            "has_junction_parking": has_junction,
            "violation_count": violation_count,
            "max_severity": max_severity,
            "police_station": police_station,
            "vehicle_type": vehicle_type,
            "vehicle_category": vehicle_category,
            "time_period": time_period,
            "junction_name": junction_name,
            "hdbscan_cluster": -1,
        }])

        for col in ["police_station", "vehicle_type", "vehicle_category", "time_period", "junction_name"]:
            features[col] = features[col].astype("category").cat.codes

        score = self.regressor.predict(features)[0]
        class_probs = self.classifier.predict(features)[0]
        class_names = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        predicted_class = class_names[np.argmax(class_probs)]

        return {
            "congestion_score": round(float(score), 2),
            "congestion_level": predicted_class,
            "class_probabilities": {name: round(float(p), 4) for name, p in zip(class_names, class_probs)},
            "risk_factors": {
                "at_junction": bool(is_at_junction),
                "rush_hour": bool(is_rush_hour),
                "heavy_vehicle": bool(is_heavy_vehicle),
                "main_road_violation": bool(has_main_road),
                "severity": max_severity,
            },
            "recommendation": self._get_recommendation(score, is_at_junction, is_rush_hour, predicted_class),
        }

    def _get_recommendation(self, score, at_junction, rush_hour, level):
        if level == "CRITICAL":
            return "IMMEDIATE DISPATCH — High congestion impact. Deploy nearest enforcement unit."
        elif level == "HIGH":
            return "HIGH PRIORITY — Schedule enforcement within 1 hour."
        elif level == "MEDIUM":
            return "MODERATE — Include in next patrol route."
        else:
            return "LOW — Monitor only. No immediate action needed."

    def get_top_zones(self, n=10):
        return self.zone_priority.head(n)[
            ["rank", "police_station", "violation_count", "mean_score", "critical_pct", "junction_pct", "priority_score"]
        ].to_dict(orient="records")
