export interface Violation {
  latitude: number;
  longitude: number;
  congestion_score: number;
  congestion_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  hour: number;
  day_of_week: number;
  month: number;
  is_weekend: number;
  is_rush_hour: number;
  is_at_junction: number;
  vehicle_type: string;
  police_station: string;
  junction_name: string;
  max_severity: number;
  cluster: number;
}

export interface Cluster {
  cluster: number;
  lat: number;
  lon: number;
  count: number;
  mean_score: number;
  max_score: number;
  junction_pct: number;
  heavy_pct: number;
  top_station: string;
  top_junction: string;
}

export interface Zone {
  rank: number;
  police_station: string;
  violation_count: number;
  mean_score: number;
  max_score: number;
  junction_pct: number;
  heavy_vehicle_pct: number;
  critical_pct: number;
  priority_score: number;
}

export interface TemporalData {
  hourly: { hour: number; count: number; mean_score: number; critical_pct: number }[];
  daily: { day_of_week: number; count: number; mean_score: number }[];
  monthly: { month: number; count: number; mean_score: number }[];
  vehicle_distribution: { vehicle_type: string; count: number }[];
  violation_distribution: { violation_type?: string; congestion_level?: string; count: number }[];
  level_distribution: { congestion_level: string; count: number }[];
}

export interface Summary {
  total_violations: number;
  date_range: { start: string; end: string };
  total_clusters: number;
  total_zones: number;
  junction_pct: number;
  rush_hour_pct: number;
  mean_score: number;
  critical_pct: number;
  top_vehicle: string;
  top_violation: string;
  center_lat: number;
  center_lon: number;
}

export interface PredictionResult {
  congestion_score: number;
  congestion_level: string;
  class_probabilities: Record<string, number>;
  risk_factors: {
    at_junction: boolean;
    rush_hour: boolean;
    heavy_vehicle: boolean;
    main_road_violation: boolean;
    severity: number;
  };
  recommendation: string;
}

export type MapLayer = "heatmap" | "hexbin" | "scatter" | "clusters";
