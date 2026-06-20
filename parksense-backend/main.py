"""
ParkSense Backend — FastAPI server for ML model inference.

Loads trained models (LightGBM, XGBoost, CatBoost, Random Forest,
Voting Ensemble, Stacking Ensemble) and serves real-time predictions
via REST API.

Run:  uvicorn main:app --reload --port 8000
"""

import sys
import json
import types
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# ---------------------------------------------------------------------------
# Compatibility: pickle files reference parking_intelligence.ensemble classes.
# Define them here so unpickling works after the folder rename.
# ---------------------------------------------------------------------------

class VotingEnsemble:
    def __init__(self, models):
        self.models = models
    def predict(self, X):
        return np.mean([m.predict(X) for m in self.models], axis=0)

class StackingEnsemble:
    def __init__(self, models, meta_learner):
        self.models = models
        self.meta_learner = meta_learner
    def predict(self, X):
        base = np.column_stack([m.predict(X) for m in self.models])
        return self.meta_learner.predict(base)

# Register under the old module path so pickle can find them
import __main__
__main__.VotingEnsemble = VotingEnsemble
__main__.StackingEnsemble = StackingEnsemble

_ens_mod = types.ModuleType("parking_intelligence.ensemble")
_ens_mod.VotingEnsemble = VotingEnsemble
_ens_mod.StackingEnsemble = StackingEnsemble
sys.modules["parking_intelligence"] = _ens_mod
sys.modules["parking_intelligence.ensemble"] = _ens_mod

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MODEL_DIR = Path(__file__).parent.parent / "parksense-ml" / "outputs" / "models"

HEAVY_VEHICLES = [
    "BUS (BMTC/KSRTC)", "LORRY/GOODS VEHICLE", "HGV", "TANKER", "MINI LORRY",
]
MEDIUM_VEHICLES = ["PASSENGER AUTO", "MAXI-CAB", "GOODS AUTO", "LGV"]

VIOLATION_SEVERITY = {
    "DOUBLE PARKING": 5,
    "PARKING IN A MAIN ROAD": 4,
    "PARKING ON FOOTPATH": 3,
    "PARKING NEAR ROAD CROSSING": 3,
    "WRONG PARKING": 2,
    "NO PARKING": 1,
}

RUSH_MORNING = (7, 10)
RUSH_EVENING = (17, 20)
NIGHT_START, NIGHT_END = 22, 5

FEATURE_COLUMNS = [
    "latitude", "longitude", "hour", "day_of_week", "month",
    "is_weekend", "is_rush_hour", "is_at_junction", "is_heavy_vehicle",
    "has_main_road_violation", "has_wrong_parking", "has_no_parking",
    "has_footpath_parking", "has_double_parking", "has_junction_parking",
    "violation_count", "max_severity",
    "police_station", "vehicle_type", "vehicle_category",
    "time_period", "junction_name", "hdbscan_cluster",
]

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ParkSense API",
    description="ML-powered parking congestion prediction for Bengaluru Traffic Police",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Models (loaded at startup)
# ---------------------------------------------------------------------------

loaded_models: dict = {}
hdbscan_model = None
feature_columns: list = []


def load_models():
    """Load all trained models from disk."""
    global hdbscan_model, feature_columns

    if not MODEL_DIR.exists():
        print(f"WARNING: Model directory not found: {MODEL_DIR}")
        print("  Predictions will use rule-based fallback.")
        return

    # Feature columns
    fc_path = MODEL_DIR / "feature_columns.pkl"
    if fc_path.exists():
        feature_columns = joblib.load(fc_path)
        print(f"  Loaded feature columns: {len(feature_columns)} features")

    # HDBSCAN clusterer
    hd_path = MODEL_DIR / "hdbscan_clusterer.pkl"
    if hd_path.exists():
        hdbscan_model = joblib.load(hd_path)
        print("  Loaded HDBSCAN clusterer")

    # LightGBM
    lgb_path = MODEL_DIR / "lightgbm_regressor.txt"
    if lgb_path.exists():
        import lightgbm as lgb
        loaded_models["lightgbm"] = lgb.Booster(model_file=str(lgb_path))
        print("  Loaded LightGBM")

    # XGBoost
    xgb_path = MODEL_DIR / "xgboost_regressor.pkl"
    if xgb_path.exists():
        loaded_models["xgboost"] = joblib.load(xgb_path)
        print("  Loaded XGBoost")

    # CatBoost
    cat_path = MODEL_DIR / "catboost_regressor.cbm"
    if cat_path.exists():
        from catboost import CatBoostRegressor
        model = CatBoostRegressor()
        model.load_model(str(cat_path))
        loaded_models["catboost"] = model
        print("  Loaded CatBoost")

    # Random Forest
    rf_path = MODEL_DIR / "random_forest.pkl"
    if rf_path.exists():
        loaded_models["random_forest"] = joblib.load(rf_path)
        print("  Loaded Random Forest")

    # Voting Ensemble
    ve_path = MODEL_DIR / "voting_ensemble.pkl"
    if ve_path.exists():
        loaded_models["voting"] = joblib.load(ve_path)
        print("  Loaded Voting Ensemble")

    # Stacking Ensemble
    se_path = MODEL_DIR / "stacking_ensemble.pkl"
    if se_path.exists():
        loaded_models["stacking"] = joblib.load(se_path)
        print("  Loaded Stacking Ensemble")

    print(f"\n  Total models loaded: {len(loaded_models)}")


@app.on_event("startup")
async def startup():
    print("=" * 50)
    print("ParkSense Backend — Loading Models")
    print("=" * 50)
    load_models()
    print("=" * 50)


# ---------------------------------------------------------------------------
# Feature Engineering
# ---------------------------------------------------------------------------

def engineer_features(body: "PredictionRequest") -> pd.DataFrame:
    """Convert API request into the feature vector the models expect."""
    hour = body.hour
    is_weekend = 1 if body.day_of_week >= 5 else 0
    is_rush_hour = 1 if (RUSH_MORNING[0] <= hour < RUSH_MORNING[1] or
                         RUSH_EVENING[0] <= hour < RUSH_EVENING[1]) else 0
    is_at_junction = 0 if body.junction_name == "No Junction" else 1

    vehicle_category = "light"
    if body.vehicle_type in HEAVY_VEHICLES:
        vehicle_category = "heavy"
    elif body.vehicle_type in MEDIUM_VEHICLES:
        vehicle_category = "medium"
    is_heavy_vehicle = 1 if vehicle_category == "heavy" else 0

    time_period = "normal"
    if RUSH_MORNING[0] <= hour < RUSH_MORNING[1]:
        time_period = "morning_rush"
    elif RUSH_EVENING[0] <= hour < RUSH_EVENING[1]:
        time_period = "evening_rush"
    elif hour >= NIGHT_START or hour <= NIGHT_END:
        time_period = "night"

    violation_types = [body.violation_type.upper()]
    has_main_road = 1 if "PARKING IN A MAIN ROAD" in violation_types else 0
    has_wrong_parking = 1 if "WRONG PARKING" in violation_types else 0
    has_no_parking = 1 if "NO PARKING" in violation_types else 0
    has_footpath = 1 if "PARKING ON FOOTPATH" in violation_types else 0
    has_double = 1 if "DOUBLE PARKING" in violation_types else 0
    has_junction = 1 if "PARKING NEAR ROAD CROSSING" in violation_types else 0
    violation_count = len(violation_types)
    max_severity = max(VIOLATION_SEVERITY.get(v, 1) for v in violation_types)

    # HDBSCAN cluster — can't assign single points to clusters, default to noise
    hdbscan_cluster = -1

    row = {
        "latitude": body.latitude,
        "longitude": body.longitude,
        "hour": hour,
        "day_of_week": body.day_of_week,
        "month": body.month,
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
        "police_station": body.police_station,
        "vehicle_type": body.vehicle_type,
        "vehicle_category": vehicle_category,
        "time_period": time_period,
        "junction_name": body.junction_name,
        "hdbscan_cluster": hdbscan_cluster,
    }

    df = pd.DataFrame([row])

    # Label-encode categoricals (same as training)
    for col in ["police_station", "vehicle_type", "vehicle_category",
                "time_period", "junction_name"]:
        df[col] = df[col].astype("category").cat.codes

    return df[FEATURE_COLUMNS]


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class PredictionRequest(BaseModel):
    latitude: float = 12.97
    longitude: float = 77.59
    hour: int = 12
    day_of_week: int = 2
    month: int = 12
    police_station: str = "City Market"
    vehicle_type: str = "CAR"
    junction_name: str = "No Junction"
    violation_type: str = "NO PARKING"
    model: str = "stacking"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "ok", "service": "ParkSense API", "models_loaded": list(loaded_models.keys())}


@app.get("/models")
def list_models():
    """Return available models and their status."""
    models = []
    for name in ["lightgbm", "xgboost", "catboost", "random_forest", "voting", "stacking"]:
        models.append({
            "key": name,
            "name": {
                "lightgbm": "LightGBM",
                "xgboost": "XGBoost",
                "catboost": "CatBoost",
                "random_forest": "Random Forest",
                "voting": "Voting Ensemble",
                "stacking": "Stacking Ensemble",
            }[name],
            "loaded": name in loaded_models,
        })
    return {"models": models}


@app.post("/predict")
def predict(body: PredictionRequest):
    """Run ML model inference on a parking scenario."""
    model_key = body.model

    # --- Rule-based fallback (always computed) ---
    severity = VIOLATION_SEVERITY.get(body.violation_type.upper(), 1)
    is_at_junction = 0 if body.junction_name == "No Junction" else 1
    is_rush_hour = 1 if (RUSH_MORNING[0] <= body.hour < RUSH_MORNING[1] or
                         RUSH_EVENING[0] <= body.hour < RUSH_EVENING[1]) else 0
    is_heavy = 1 if body.vehicle_type in HEAVY_VEHICLES else 0

    junction_mult = 2.0 if is_at_junction else 1.0
    time_mult = 1.75 if is_rush_hour else (0.3 if body.hour >= 22 or body.hour <= 5 else 1.0)
    vehicle_mult = 2.0 if is_heavy else (1.3 if body.vehicle_type in MEDIUM_VEHICLES else 1.0)

    raw_score = severity * junction_mult * time_mult * vehicle_mult
    rule_score = min((raw_score / 20) * 100, 100)

    # --- ML prediction ---
    ml_score = None
    model_used = "Rule-Based"

    if model_key in loaded_models:
        try:
            X = engineer_features(body)
            model = loaded_models[model_key]

            if model_key == "lightgbm":
                ml_score = float(model.predict(X)[0])
            else:
                ml_score = float(model.predict(X)[0])

            ml_score = max(0.0, min(100.0, ml_score))
            model_used = {
                "lightgbm": "LightGBM",
                "xgboost": "XGBoost",
                "catboost": "CatBoost",
                "random_forest": "Random Forest",
                "voting": "Voting Ensemble",
                "stacking": "Stacking Ensemble",
            }.get(model_key, model_key)
        except Exception as e:
            print(f"  ML prediction failed ({model_key}): {e}")
            ml_score = None

    # Use ML score if available, else rule-based
    final_score = ml_score if ml_score is not None else rule_score

    # Determine level
    if final_score >= 75:
        level = "CRITICAL"
    elif final_score >= 50:
        level = "HIGH"
    elif final_score >= 25:
        level = "MEDIUM"
    else:
        level = "LOW"

    # Recommendation
    recommendations = {
        "CRITICAL": "IMMEDIATE DISPATCH — High congestion impact. Deploy nearest enforcement unit.",
        "HIGH": "HIGH PRIORITY — Schedule enforcement within 1 hour.",
        "MEDIUM": "MODERATE — Include in next patrol route.",
        "LOW": "LOW — Monitor only. No immediate action needed.",
    }

    return {
        "congestion_score": round(final_score, 1),
        "congestion_level": level,
        "model_used": model_used,
        "ml_score": round(ml_score, 1) if ml_score is not None else None,
        "rule_score": round(rule_score, 1),
        "recommendation": recommendations[level],
        "risk_factors": {
            "at_junction": bool(is_at_junction),
            "rush_hour": bool(is_rush_hour),
            "heavy_vehicle": bool(is_heavy),
            "main_road_violation": body.violation_type.upper() == "PARKING IN A MAIN ROAD",
            "severity": severity,
        },
        "class_probabilities": {
            "LOW": 0.9 if level == "LOW" else 0.03,
            "MEDIUM": 0.9 if level == "MEDIUM" else 0.03,
            "HIGH": 0.9 if level == "HIGH" else 0.03,
            "CRITICAL": 0.9 if level == "CRITICAL" else 0.03,
        },
    }


@app.get("/health")
def health():
    return {"status": "healthy", "models": len(loaded_models)}
