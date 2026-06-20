<div align="center">

# ParkSense

**AI-Driven Parking Congestion Intelligence for Bengaluru Traffic Police**

*Flipkart GridLock 2.0 Hackathon — Theme 1: Poor Visibility of Parking Congestion*

<br />

<a href="https://github.com/codex-mohan/parksense">
  <img src="https://img.shields.io/badge/AUTHOR-mohan-181717?style=flat-square&logo=github&logoColor=white&labelColor=0D0D0D" alt="Author">
</a>
<a href="https://github.com/codex-mohan/parksense">
  <img src="https://img.shields.io/badge/STATUS-complete-00c97b?style=flat-square&labelColor=0D0D0D" alt="Status">
</a>
<a href="https://github.com/codex-mohan/parksense">
  <img src="https://img.shields.io/badge/LICENSE-MIT-e84040?style=flat-square&labelColor=0D0D0D" alt="License">
</a>

<br />

<img src="https://img.shields.io/badge/NEXT.JS-16-000000?style=flat-square&logo=next.js&logoColor=white&labelColor=0D0D0D" alt="Next.js">
<img src="https://img.shields.io/badge/REACT-19-61DAFB?style=flat-square&logo=react&logoColor=000&labelColor=0D0D0D" alt="React">
<img src="https://img.shields.io/badge/TAILWIND_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white&labelColor=0D0D0D" alt="Tailwind">
<img src="https://img.shields.io/badge/DECK.GL-GPU-00D4E6?style=flat-square&logoColor=white&labelColor=0D0D0D" alt="Deck.gl">
<img src="https://img.shields.io/badge/PYTHON-3.13-3776AB?style=flat-square&logo=python&logoColor=white&labelColor=0D0D0D" alt="Python">
<img src="https://img.shields.io/badge/LIGHTGBM-R2_0.999-FF6B35?style=flat-square&logoColor=white&labelColor=0D0D0D" alt="LightGBM">
<img src="https://img.shields.io/badge/CATBOOST-R2_0.9999-F6C343?style=flat-square&logoColor=white&labelColor=0D0D0D" alt="CatBoost">

</div>

---

## The Problem

Bengaluru loses an estimated **₹38,000 crore annually** to traffic congestion. A significant but under-addressed contributor is **illegal parking** — vehicles parked on roadsides, junctions, footpaths, and main roads that narrow carriageways and create bottlenecks.

Traffic police currently rely on **manual patrol reports** to identify congestion hotspots. This creates three critical blind spots:

1. **No real-time visibility** — Officers discover congestion only after it has already formed
2. **No predictive capability** — No way to anticipate which areas will become congested and when
3. **No data-driven deployment** — Enforcement units are deployed reactively rather than proactively

The provided dataset contains **298,450 parking violation records** from Bengaluru (Nov 2023 — Apr 2024) across **54 police station jurisdictions**. The challenge: transform this raw violation log into an intelligence platform that tells traffic police *where* congestion is forming, *when* it peaks, and *where* to deploy next.

---

## The Solution

ParkSense is a two-component intelligence platform:

**1. ML Pipeline** (Python) — Processes violation data through spatial clustering, feature engineering, and ensemble prediction models to identify congestion hotspots and score their impact.

**2. Interactive Dashboard** (Next.js) — A real-time command center that visualizes 115,000+ violation records on an interactive map with satellite imagery, temporal analytics, zone prioritization, and a what-if prediction simulator.

---

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │            PARKSENSE ARCHITECTURE         │
                    └─────────────────────────────────────────┘

    ┌──────────────────────┐              ┌──────────────────────┐
    │   DATA INGESTION     │              │   ML PIPELINE        │
    │                      │              │   (parksense-ml)     │
    │  CSV (298K records)  │─────────────>│                      │
    │  Bengaluru Traffic   │              │  Feature Engineering │
    │  Police Violations   │              │  HDBSCAN Clustering  │
    └──────────────────────┘              │  6-Model Ensemble    │
                                          │  Validation Suite    │
                                          └──────────┬───────────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    │                │                │
                          ┌─────────▼────────┐ ┌────▼──────────┐ ┌──▼──────────────┐
                          │  EXPORT LAYER    │ │ MODEL FILES   │ │ FastAPI BACKEND │
                          │                  │ │               │ │ (parksense-     │
                          │  violations.json │ │ .pkl .cbm     │ │  backend)       │
                          │  clusters.json   │ │ .txt          │ │                 │
                          │  zones.json      │ │               │ │ /predict        │
                          │  model_comparison│ │               │ │ /models         │
                          └────────┬─────────┘ └───────────────┘ └───────┬─────────┘
                                   │                                      │
                    ┌──────────────▼──────────────────────────────────────▼──────┐
                    │                   INTERACTIVE DASHBOARD                     │
                    │                   (parksense — Next.js)                     │
                    │                                                            │
                    │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
                    │  │  MAP    │  │ SIDEBAR  │  │ CHARTS   │  │ PREDICTOR  │  │
                    │  │ Deck.gl │  │ Zones    │  │ Temporal │  │ What-if    │  │
                    │  │ MapLibre│  │ Filters  │  │ Analysis │  │ Simulator  │  │
                    │  └─────────┘  └──────────┘  └──────────┘  └────────────┘  │
                    └────────────────────────────────────────────────────────────┘
```

---

## ML Pipeline

### Feature Engineering

The raw violation data is enriched with **20 engineered features**:

| Category | Features |
|----------|----------|
| **Temporal** | hour, day_of_week, month, is_weekend, is_rush_hour, time_period |
| **Spatial** | latitude, longitude, is_at_junction, hdbscan_cluster |
| **Vehicle** | vehicle_type, vehicle_category, is_heavy_vehicle |
| **Violation** | violation_count, max_severity, has_wrong_parking, has_no_parking, has_junction_parking, has_double_parking, has_footpath_parking, has_main_road_violation |

### Congestion Target

Since the dataset has no direct traffic flow measurement, we engineer a **Congestion Impact Score** (0-100):

```
congestion_score = violation_severity x junction_multiplier x time_multiplier x vehicle_multiplier
```

| Factor | Multiplier | Rationale |
|--------|-----------|-----------|
| At junction | 2.0x | Junction parking blocks traffic flow disproportionately |
| Rush hour (7-10am, 5-8pm) | 1.75x | Peak hours amplify congestion impact |
| Night (10pm-5am) | 0.3x | Minimal traffic, low congestion risk |
| Heavy vehicle (bus/lorry) | 2.0x | Larger physical footprint |
| Medium vehicle (auto/taxi) | 1.3x | Moderate obstruction |

### Model Performance

Six models were trained and evaluated on a **temporal holdout set** (last 15% of data, chronologically sorted):

| Model | Test MAE | Test R2 | Train Time |
|-------|---------|---------|------------|
| **CatBoost** | 0.0169 | 0.9999 | 27.8s |
| **Stacking Ensemble** | 0.0232 | 0.9999 | 0.9s |
| **XGBoost** | 0.0593 | 0.9998 | 15.1s |
| **Voting Ensemble** | 0.0445 | 0.9995 | 0.0s |
| **LightGBM** | 0.0832 | 0.9988 | 8.4s |
| **Random Forest** | 0.0549 | 0.9972 | 52.3s |

### Validation

- **Time-Series Cross-Validation** (5 folds): Mean MAE = 0.094, Mean R2 = 0.9988
- **Segment Analysis**: Performance validated across congestion levels, time-of-day buckets, and junction status
- **Residual Analysis**: Mean bias = 0.004 (unbiased), 99.7% predictions within +/- 1 point

### HDBSCAN Spatial Clustering

Applied HDBSCAN (Hierarchical Density-Based Spatial Clustering) to latitude/longitude coordinates:

- **524 hotspot clusters** identified
- **81% of violations** assigned to a cluster (19% noise)
- Clusters reveal spatial congestion patterns that simple aggregation misses
- Each cluster annotated with mean congestion score, junction percentage, and top contributing police station

---

## Features

### Interactive Map

- **Heatmap layer** — GPU-accelerated density visualization of violation hotspots
- **Scatter layer** — Individual violation points colored by congestion level
- **Cluster layer** — HDBSCAN-detected hotspot centroids with size proportional to violation count
- **Satellite imagery** — Toggle between dark basemap and Esri World Imagery (free, no API key)
- **Map controls** — Zoom, reset view, layer switcher, satellite toggle

### Zone Intelligence

- **54 police station jurisdictions** ranked by enforcement priority
- Priority score combines violation count, mean congestion, critical percentage, and junction density
- Click any zone to fly the map to its centroid
- Zone detail panel shows full breakdown: violation types, vehicle distribution, temporal patterns

### Temporal Analytics

- **Hourly patterns** — When does congestion peak in each zone
- **Daily patterns** — Weekday vs weekend differences
- **Monthly trends** — Seasonal variation across the 6-month dataset
- **Vehicle distribution** — Which vehicle types contribute most to congestion

### What-If Predictor

Simulate hypothetical parking scenarios:

| Parameter | Effect |
|-----------|--------|
| **Location** (lat/lon) | Where the violation occurs |
| **Hour** | Rush hours get 1.75x multiplier, night gets 0.3x |
| **Junction** | At junction = 2x congestion impact |
| **Vehicle type** | Heavy vehicles = 2x impact |
| **Violation type** | Severity weighted (Double Parking = 5, No Parking = 1) |
| **Model selector** | Switch between 5 ML models + rule-based scoring |

Predictions appear as **interactive markers** on the map with hover tooltips showing the full prediction breakdown.

### Model Comparison Dashboard

- Side-by-side comparison of all 6 models
- Time-series cross-validation results with fold-by-fold R2 bars
- Residual analysis showing bias and accuracy distribution
- Segment analysis across congestion levels, time periods, and junction status

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16, React 19, TypeScript | Dashboard framework |
| **Styling** | Tailwind CSS 4 | Dark neon theme, glass morphism effects |
| **Map** | MapLibre GL JS, Deck.gl | GPU-accelerated map layers (free, no API key) |
| **Charts** | Recharts | Temporal analytics visualization |
| **Animation** | Framer Motion | UI transitions and micro-interactions |
| **Icons** | Lucide React | Consistent icon system |
| **ML** | LightGBM, XGBoost, CatBoost, scikit-learn | Ensemble prediction models |
| **Clustering** | HDBSCAN | Spatial hotspot detection |
| **Data** | Python, Pandas, NumPy | Data processing and feature engineering |
| **Storage** | joblib, JSON | Model serialization and data export |

---

## Project Structure

```
parksense/
├── parksense-ml/                    # Python ML pipeline
│   ├── config.py                    # Constants, severity maps, parameters
│   ├── pipeline.py                  # Data loading, cleaning, feature engineering
│   ├── model.py                     # HDBSCAN clustering, LightGBM training
│   ├── predict.py                   # Prediction API class
│   ├── ensemble.py                  # Multi-model training + validation
│   ├── export_data.py               # JSON export for frontend
│   ├── visualize.py                 # Folium maps, SHAP analysis
│   └── outputs/models/              # Saved model files (.pkl, .cbm, .txt)
│
├── parksense-backend/               # FastAPI inference server
│   ├── main.py                      # API endpoints, model loading, feature engineering
│   ├── requirements.txt             # Python dependencies
│   └── start.bat                    # Windows startup script
│
├── parksense/                       # Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Main dashboard page
│   │   │   ├── layout.tsx           # Root layout with dark theme
│   │   │   ├── globals.css          # Neon theme, glass effects
│   │   │   └── api/predict/         # Proxies to FastAPI backend
│   │   ├── components/
│   │   │   ├── Map.tsx              # Deck.gl + MapLibre map
│   │   │   ├── Header.tsx           # Top navigation bar
│   │   │   ├── Sidebar.tsx          # Zone list, layer toggles, filters
│   │   │   ├── StatsPanel.tsx       # Summary statistics bar
│   │   │   ├── TemporalChart.tsx    # Hourly/daily/vehicle charts
│   │   │   ├── ZoneDetail.tsx       # Zone drill-down panel
│   │   │   ├── Predictor.tsx        # What-if prediction simulator
│   │   │   └── ModelComparison.tsx  # Model benchmark dashboard
│   │   └── types/index.ts           # TypeScript interfaces
│   └── public/data/                 # Exported JSON data files
│
├── jan to may police violation*.csv # Source dataset (gitignored)
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 18+
- pnpm (package manager)

### Installation

```bash
# Clone the repository
git clone https://github.com/codex-mohan/parksense.git
cd parksense

# Install ML pipeline dependencies
pip install lightgbm xgboost catboost hdbscan scikit-learn pandas numpy joblib

# Install backend dependencies
pip install -r parksense-backend/requirements.txt

# Install frontend dependencies
cd parksense
pnpm install
```

### Data Pipeline

```bash
# Place the dataset CSV in the root directory
# File: "jan to may police violation_anonymized791b166.csv"

# Run the full pipeline (feature engineering + clustering + model training)
python -m parksense_ml.main

# Train the multi-model ensemble + validation
python -m parksense_ml.ensemble

# Export data for the frontend
python -m parksense_ml.export_data
```

### Running (3 terminals)

```bash
# Terminal 1 — ML Backend (FastAPI, port 8002)
cd parksense-backend
python -m uvicorn main:app --reload --port 8002

# Terminal 2 — Frontend (Next.js, port 3000)
cd parksense
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## API Reference

The frontend calls `/api/predict` which proxies to the FastAPI backend on port 8002.

### FastAPI Backend (port 8002)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check, lists loaded models |
| `GET` | `/models` | Returns available models and their status |
| `POST` | `/predict` | Run ML inference on a parking scenario |
| `GET` | `/health` | Service health status |

### POST /predict

Runs actual ML model inference (not rule-based).

**Request Body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| latitude | number | 12.97 | Location latitude |
| longitude | number | 77.59 | Location longitude |
| hour | int | 12 | Time of day (0-23) |
| day_of_week | int | 2 | Day (0=Mon, 6=Sun) |
| month | int | 12 | Month (1-12) |
| police_station | string | "City Market" | Jurisdiction name |
| vehicle_type | string | "CAR" | Vehicle classification |
| junction_name | string | "No Junction" | Junction identifier |
| violation_type | string | "NO PARKING" | Type of parking violation |
| model | string | "stacking" | lightgbm / xgboost / catboost / random_forest / voting / stacking |

**Response:**

```json
{
  "congestion_score": 80.7,
  "congestion_level": "CRITICAL",
  "model_used": "CatBoost",
  "ml_score": 80.7,
  "rule_score": 100.0,
  "recommendation": "IMMEDIATE DISPATCH — High congestion impact.",
  "risk_factors": {
    "at_junction": true,
    "rush_hour": true,
    "heavy_vehicle": true,
    "main_road_violation": false,
    "severity": 5
  },
  "class_probabilities": {
    "LOW": 0.03,
    "MEDIUM": 0.03,
    "HIGH": 0.03,
    "CRITICAL": 0.9
  }
}
```

---

## Dataset

**Source:** Bengaluru Traffic Police parking violation records

| Metric | Value |
|--------|-------|
| Total records | 298,450 |
| After cleaning | 115,400 (approved violations only) |
| Time range | November 2023 — April 2024 |
| Police stations | 54 jurisdictions |
| Latitude range | 12.85 - 13.10 (Bengaluru bbox) |
| Longitude range | 77.40 - 77.80 (Bengaluru bbox) |

**Violation type distribution:**

| Type | Count | Severity |
|------|-------|----------|
| No Parking | ~120K | 1 |
| Wrong Parking | ~90K | 2 |
| Parking in Main Road | ~45K | 4 |
| Parking on Footpath | ~25K | 3 |
| Double Parking | ~15K | 5 |
| Parking Near Road Crossing | ~10K | 3 |

---

## Key Design Decisions

**Why HDBSCAN + GBTs over Deep Learning?**

The dataset contains 115K clean records across 20 features. Deep learning requires either large datasets (millions) or structured inputs (images, sequences). Gradient Boosted Trees dominate tabular data under 1M rows, and HDBSCAN provides spatial clustering without requiring a road network graph.

**Why static prototype, not real-time?**

The problem statement does not require live traffic feeds. The dataset spans 6 months of historical data. A static prototype demonstrating the ML pipeline and visualization is sufficient for the hackathon scope.

**Why MapLibre + Deck.gl over Mapbox?**

MapLibre is free and open-source with no API key requirement. Deck.gl provides GPU-accelerated layers (heatmap, scatterplot) that handle 50K+ points smoothly. No licensing concerns for hackathon judges.

---

## Contact

**Mohan**

[![GitHub](https://img.shields.io/badge/GitHub-codex--mohan-181717?style=flat-square&logo=github&logoColor=white&labelColor=0D0D0D)](https://github.com/codex-mohan)

---

<div align="center">

**Built for Flipkart GridLock 2.0 Hackathon**

</div>
