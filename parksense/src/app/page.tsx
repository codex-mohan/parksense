"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Zap, BarChart3, Clock } from "lucide-react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import StatsPanel from "@/components/StatsPanel";
import TemporalChart from "@/components/TemporalChart";
import ZoneDetail from "@/components/ZoneDetail";
import Predictor from "@/components/Predictor";
import ModelComparison from "@/components/ModelComparison";
import type { Violation, Cluster, Zone, TemporalData, Summary, MapLayer, Prediction } from "@/types";

const MapComponent = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Home() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [temporal, setTemporal] = useState<TemporalData | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeLayer, setActiveLayer] = useState<MapLayer>("heatmap");
  const [hourFilter, setHourFilter] = useState<[number, number]>([0, 23]);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [showPredictor, setShowPredictor] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [bottomTab, setBottomTab] = useState<"temporal" | "models">("temporal");

  useEffect(() => {
    async function load() {
      try {
        const [violationsRes, clustersRes, zonesRes, temporalRes, summaryRes] = await Promise.all([
          fetch("/data/violations.json"),
          fetch("/data/clusters.json"),
          fetch("/data/zones.json"),
          fetch("/data/temporal.json"),
          fetch("/data/summary.json"),
        ]);
        setViolations(await violationsRes.json());
        setClusters(await clustersRes.json());
        setZones(await zonesRes.json());
        setTemporal(await temporalRes.json());
        setSummary(await summaryRes.json());
      } catch (e) {
        console.error("Failed to load data:", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  const activeZoneData = selectedZone
    ? zones.find((z) => z.police_station === selectedZone) || null
    : null;

  if (loading || !summary || !temporal) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neon-cyan/20 border border-neon-cyan/30 flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold neon-text text-neon-cyan mb-2">PARKSENSE</h2>
          <p className="text-sm text-foreground/50">Loading intelligence data...</p>
          <div className="mt-4 w-48 h-1 bg-surface rounded-full overflow-hidden mx-auto">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="h-full bg-neon-cyan rounded-full"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Header />

      <div className="flex-1 flex flex-col pt-14 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-4 py-2 border-b border-neon-cyan/10 flex items-center justify-between bg-surface/30 shrink-0"
        >
          <StatsPanel summary={summary} />
          <button
            onClick={() => setShowPredictor(!showPredictor)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
              showPredictor
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                : "bg-surface text-neon-cyan/70 hover:text-neon-cyan border border-transparent"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            PREDICT
          </button>
        </motion.div>

        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            zones={zones}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            hourFilter={hourFilter}
            onHourFilterChange={setHourFilter}
            levelFilter={levelFilter}
            onLevelFilterChange={setLevelFilter}
            selectedZone={selectedZone}
            onZoneSelect={(zone) => {
              setSelectedZone(zone);
              setSelectedCluster(null);
            }}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 relative">
              <MapComponent
                violations={violations}
                clusters={clusters}
                predictions={predictions}
                activeLayer={activeLayer}
                hourFilter={hourFilter}
                levelFilter={levelFilter}
                focusZone={activeZoneData}
                onClusterClick={(c) => {
                  setSelectedCluster(c);
                  setSelectedZone(null);
                }}
                onViolationClick={() => {}}
                onLayerChange={setActiveLayer}
              />

              {showPredictor && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute top-4 right-4 w-80 pointer-events-auto max-h-[calc(100%-2rem)] overflow-y-auto z-10"
                >
                  <Predictor
                    onPredict={(pred: any) => {
                      const lat = parseFloat(pred.latitude || "12.97");
                      const lon = parseFloat(pred.longitude || "77.59");
                      setPredictions((prev) => [
                        ...prev,
                        {
                          latitude: lat,
                          longitude: lon,
                          congestion_score: pred.congestion_score,
                          congestion_level: pred.congestion_level,
                          model_used: pred.model_used,
                          recommendation: pred.recommendation,
                          risk_factors: pred.risk_factors,
                        },
                      ]);
                    }}
                  />
                </motion.div>
              )}
            </div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="h-72 border-t border-neon-cyan/10 flex flex-col overflow-hidden bg-background/80 backdrop-blur-sm shrink-0"
            >
              <div className="flex items-center gap-1 px-4 pt-2 shrink-0">
                <button
                  onClick={() => setBottomTab("temporal")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    bottomTab === "temporal"
                      ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/25"
                      : "text-foreground/40 hover:text-foreground/60 border border-transparent"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Temporal
                </button>
                <button
                  onClick={() => setBottomTab("models")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    bottomTab === "models"
                      ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/25"
                      : "text-foreground/40 hover:text-foreground/60 border border-transparent"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Models
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {bottomTab === "temporal" && <TemporalChart data={temporal} />}
                {bottomTab === "models" && <ModelComparison />}
              </div>
            </motion.div>
          </div>

          {activeZoneData && (
            <ZoneDetail
              zone={activeZoneData}
              cluster={selectedCluster}
              onClose={() => {
                setSelectedZone(null);
                setSelectedCluster(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
