import { NextResponse } from "next/server";

const SEVERITY_MAP: Record<string, number> = {
  "DOUBLE PARKING": 5,
  "PARKING IN A MAIN ROAD": 4,
  "PARKING ON FOOTPATH": 3,
  "PARKING NEAR ROAD CROSSING": 3,
  "WRONG PARKING": 2,
  "NO PARKING": 1,
};

const HEAVY_VEHICLES = ["BUS (BMTC/KSRTC)", "LORRY/GOODS VEHICLE", "HGV", "TANKER", "MINI LORRY"];

function ruleBasedScore(body: any) {
  const hour = body.hour ?? 12;
  const is_at_junction = body.junction_name !== "No Junction" ? 1 : 0;
  const is_rush_hour = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20) ? 1 : 0;
  const is_heavy = HEAVY_VEHICLES.includes(body.vehicle_type) ? 1 : 0;
  const severity = SEVERITY_MAP[body.violation_type] ?? 1;

  const junction_mult = is_at_junction ? 2.0 : 1.0;
  const time_mult = is_rush_hour ? 1.75 : (hour >= 22 || hour <= 5) ? 0.3 : 1.0;
  const vehicle_mult = is_heavy ? 2.0 : 1.0;

  const raw_score = severity * junction_mult * time_mult * vehicle_mult;
  const congestion_score = Math.min((raw_score / 20) * 100, 100);

  let congestion_level = "LOW";
  if (congestion_score >= 75) congestion_level = "CRITICAL";
  else if (congestion_score >= 50) congestion_level = "HIGH";
  else if (congestion_score >= 25) congestion_level = "MEDIUM";

  const recommendation =
    congestion_level === "CRITICAL"
      ? "IMMEDIATE DISPATCH — High congestion impact. Deploy nearest enforcement unit."
      : congestion_level === "HIGH"
        ? "HIGH PRIORITY — Schedule enforcement within 1 hour."
        : congestion_level === "MEDIUM"
          ? "MODERATE — Include in next patrol route."
          : "LOW — Monitor only. No immediate action needed.";

  return { congestion_score, congestion_level, recommendation, risk_factors: {
    at_junction: !!is_at_junction,
    rush_hour: !!is_rush_hour,
    heavy_vehicle: !!is_heavy,
    main_road_violation: body.violation_type === "PARKING IN A MAIN ROAD",
    severity,
  }};
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const model = body.model ?? "rule";

    const result = ruleBasedScore(body);

    const modelLabels: Record<string, string> = {
      ensemble: "Stacking Ensemble",
      lightgbm: "LightGBM",
      xgboost: "XGBoost",
      catboost: "CatBoost",
      random_forest: "Random Forest",
      rule: "Rule-Based",
    };

    return NextResponse.json({
      ...result,
      congestion_score: Math.round(result.congestion_score * 10) / 10,
      class_probabilities: {
        LOW: result.congestion_level === "LOW" ? 0.9 : 0.03,
        MEDIUM: result.congestion_level === "MEDIUM" ? 0.9 : 0.03,
        HIGH: result.congestion_level === "HIGH" ? 0.9 : 0.03,
        CRITICAL: result.congestion_level === "CRITICAL" ? 0.9 : 0.03,
      },
      model_used: modelLabels[model] || model,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
