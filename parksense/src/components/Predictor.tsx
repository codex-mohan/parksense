"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, MapPin, Clock, Car, AlertTriangle,
  ChevronDown, Target, Shield,
} from "lucide-react";

const STATIONS = [
  "Upparpet", "Shivajinagar", "Malleshwaram", "HAL Old Airport",
  "City Market", "Vijayanagara", "Rajajinagar", "Magadi Road",
  "Jeevanbheemanagar", "High ground", "Halasuru Gate", "K.R. Pura",
  "HSR Layout", "Bellandur", "Electronic City", "Jayanagara",
];

const VEHICLE_TYPES = [
  "CAR", "SCOOTER", "MOTOR CYCLE", "PASSENGER AUTO", "MAXI-CAB",
  "LGV", "GOODS AUTO", "BUS (BMTC/KSRTC)", "LORRY/GOODS VEHICLE",
];

const JUNCTIONS = [
  "No Junction",
  "BTP051 - Safina Plaza Junction",
  "BTP082 - KR Market Junction",
  "BTP040 - Elite Junction",
  "BTP044 - Sagar Theatre Junction",
  "BTP211 - Central Street Junction",
  "BTP058 - Subbanna Junction",
  "BTP027 - Modi Bridge Junction",
  "BTP020 - Hosahalli Metro Station",
];

const VIOLATION_TYPES = [
  "NO PARKING",
  "WRONG PARKING",
  "PARKING IN A MAIN ROAD",
  "DOUBLE PARKING",
  "PARKING ON FOOTPATH",
  "PARKING NEAR ROAD CROSSING",
];

interface PredictorProps {
  onPredict?: (params: any) => void;
}

export default function Predictor({ onPredict }: PredictorProps) {
  const [lat, setLat] = useState("12.97");
  const [lon, setLon] = useState("77.59");
  const [hour, setHour] = useState(18);
  const [dayOfWeek, setDayOfWeek] = useState(2);
  const [month, setMonth] = useState(12);
  const [station, setStation] = useState("City Market");
  const [vehicleType, setVehicleType] = useState("CAR");
  const [junction, setJunction] = useState("BTP082 - KR Market Junction");
  const [violationType, setViolationType] = useState("PARKING IN A MAIN ROAD");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
          hour,
          day_of_week: dayOfWeek,
          month,
          police_station: station,
          vehicle_type: vehicleType,
          junction_name: junction,
          violation_type: violationType,
        }),
      });
      const data = await res.json();
      setResult(data);
      onPredict?.(data);
    } catch {
      setResult({
        congestion_score: Math.round(Math.random() * 100),
        congestion_level: ["LOW", "MEDIUM", "HIGH", "CRITICAL"][Math.floor(Math.random() * 4)],
        recommendation: "Mock prediction — connect FastAPI backend for real inference.",
      });
    }
    setLoading(false);
  };

  const levelColor: Record<string, string> = {
    LOW: "text-neon-green",
    MEDIUM: "text-neon-yellow",
    HIGH: "text-[#e67e22]",
    CRITICAL: "text-neon-red",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="glass rounded-xl p-4"
    >
      <h3 className="text-sm font-semibold text-neon-magenta mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4" />
        CONGESTION PREDICTOR
      </h3>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Latitude</label>
            <input
              type="number"
              step="0.001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full px-2 py-1.5 bg-surface rounded text-xs text-foreground border border-border focus:border-neon-cyan/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Longitude</label>
            <input
              type="number"
              step="0.001"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className="w-full px-2 py-1.5 bg-surface rounded text-xs text-foreground border border-border focus:border-neon-cyan/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Hour</label>
            <select
              value={hour}
              onChange={(e) => setHour(+e.target.value)}
              className="w-full px-2 py-1.5 bg-surface rounded text-xs text-foreground border border-border focus:border-neon-cyan/50 focus:outline-none"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i}:00</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Day</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(+e.target.value)}
              className="w-full px-2 py-1.5 bg-surface rounded text-xs text-foreground border border-border focus:border-neon-cyan/50 focus:outline-none"
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(+e.target.value)}
              className="w-full px-2 py-1.5 bg-surface rounded text-xs text-foreground border border-border focus:border-neon-cyan/50 focus:outline-none"
            >
              {[11, 12, 1, 2, 3, 4].map((m) => (
                <option key={m} value={m}>
                  {["", "Jan", "Feb", "Mar", "Apr", "", "", "", "", "", "", "Nov", "Dec"][m]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-foreground/40 block mb-1">Police Station</label>
          <select
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className="w-full px-2 py-1.5 bg-surface rounded text-xs text-foreground border border-border focus:border-neon-cyan/50 focus:outline-none"
          >
            {STATIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-foreground/40 block mb-1">Junction</label>
          <select
            value={junction}
            onChange={(e) => setJunction(e.target.value)}
            className="w-full px-2 py-1.5 bg-surface rounded text-xs text-foreground border border-border focus:border-neon-cyan/50 focus:outline-none"
          >
            {JUNCTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Vehicle</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full px-2 py-1.5 bg-surface rounded text-xs text-foreground border border-border focus:border-neon-cyan/50 focus:outline-none"
            >
              {VEHICLE_TYPES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Violation</label>
            <select
              value={violationType}
              onChange={(e) => setViolationType(e.target.value)}
              className="w-full px-2 py-1.5 bg-surface rounded text-xs text-foreground border border-border focus:border-neon-cyan/50 focus:outline-none"
            >
              {VIOLATION_TYPES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handlePredict}
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-neon-magenta to-neon-cyan text-background font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "PREDICTING..." : "PREDICT CONGESTION IMPACT"}
        </button>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-lg p-3 border border-neon-cyan/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground/50">Congestion Score</span>
                  <span className={`text-lg font-bold ${levelColor[result.congestion_level] || "text-foreground"}`}>
                    {result.congestion_score?.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground/50">Level</span>
                  <span className={`text-sm font-bold ${levelColor[result.congestion_level] || "text-foreground"}`}>
                    {result.congestion_level}
                  </span>
                </div>
                {result.recommendation && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-foreground/60 flex items-start gap-1.5">
                      <Shield className="w-3 h-3 mt-0.5 text-neon-cyan shrink-0" />
                      {result.recommendation}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
