from pathlib import Path

WORKSPACE = Path(__file__).parent.parent
DATA_PATH = WORKSPACE / "jan to may police violation_anonymized791b166.csv"
OUTPUT_DIR = WORKSPACE / "parksense-ml" / "outputs"
MODEL_DIR = OUTPUT_DIR / "models"
FIGURE_DIR = OUTPUT_DIR / "figures"
REPORT_DIR = OUTPUT_DIR / "reports"

BENGALURU_LAT_MIN, BENGALURU_LAT_MAX = 12.75, 13.35
BENGALURU_LON_MIN, BENGALURU_LON_MAX = 77.40, 77.80

DEAD_COLUMNS = ["description", "closed_datetime", "action_taken_timestamp"]
MARGINAL_COLUMNS = [
    "data_sent_to_scita_timestamp", "updated_vehicle_number",
    "updated_vehicle_type", "validation_timestamp",
]

VIOLATION_SEVERITY = {
    "DOUBLE PARKING": 5,
    "PARKING IN A MAIN ROAD": 4,
    "PARKING ON FOOTPATH": 3,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 3,
    "PARKING NEAR ROAD CROSSING": 3,
    "WRONG PARKING": 2,
    "NO PARKING": 1,
    "DEFECTIVE NUMBER PLATE": 0,
    "REFUSE TO GO FOR HIRE": 0,
}

HEAVY_VEHICLES = [
    "BUS (BMTC/KSRTC)", "LORRY/GOODS VEHICLE", "HGV", "TANKER",
    "MINI LORRY", "PRIVATE BUS", "TOURIST BUS", "SCHOOL VEHICLE", "FACTORY BUS",
]
MEDIUM_VEHICLES = [
    "PASSENGER AUTO", "GOODS AUTO", "VAN", "MAXI-CAB", "TEMPO", "JEEP",
]

RUSH_MORNING = (7, 10)
RUSH_EVENING = (17, 20)
NIGHT_START, NIGHT_END = 22, 5

HDBSCAN_MIN_CLUSTER_SIZE = 50
HDBSCAN_MIN_SAMPLES = 10
HDBSCAN_METRIC = "haversine"

GRID_RESOLUTION_DEG = 0.005
