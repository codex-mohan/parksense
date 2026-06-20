import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const hour = body.hour ?? 12;
    const is_at_junction = body.junction_name !== "No Junction" ? 1 : 0;
    const is_rush_hour = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20) ? 1 : 0;

    const heavy_vehicles = ["BUS (BMTC/KSRTC)", "LORRY/GOODS VEHICLE", "HGV", "TANKER", "MINI LORRY"];
    const is_heavy = heavy_vehicles.includes(body.vehicle_type) ? 1 : 0;

    const severity_map: Record<string, number> = {
      "DOUBLE PARKING": 5,
      "PARKING IN A MAIN ROAD": 4,
      "PARKING ON FOOTPATH": 3,
      "PARKING NEAR ROAD CROSSING": 3,
      "WRONG PARKING": 2,
      "NO PARKING": 1,
    };
    const severity = severity_map[body.violation_type] ?? 1;

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

    return NextResponse.json({
      congestion_score: Math.round(congestion_score * 10) / 10,
      congestion_level,
      class_probabilities: {
        LOW: congestion_level === "LOW" ? 0.9 : 0.03,
        MEDIUM: congestion_level === "MEDIUM" ? 0.9 : 0.03,
        HIGH: congestion_level === "HIGH" ? 0.9 : 0.03,
        CRITICAL: congestion_level === "CRITICAL" ? 0.9 : 0.03,
      },
      risk_factors: {
        at_junction: !!is_at_junction,
        rush_hour: !!is_rush_hour,
        heavy_vehicle: !!is_heavy,
        main_road_violation: body.violation_type === "PARKING IN A MAIN ROAD",
        severity,
      },
      recommendation,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
