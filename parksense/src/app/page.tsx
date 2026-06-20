"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import StatsPanel from "@/components/StatsPanel";
import TemporalChart from "@/components/TemporalChart";
import ZoneDetail from "@/components/ZoneDetail";
import Predictor from "@/components/Predictor";
import type { Violation, Cluster, Zone, TemporalData, Summary, MapLayer } from "@/types";

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
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-neon-cyan to-neon-magenta flex items-center justify-center animate-pulse">
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
              className="h-full bg-gradient-to-r from-neon-cyan to-neon-magenta rounded-full"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Header />

      <div className="flex-1 flex pt-14 overflow-hidden">
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
              activeLayer={activeLayer}
              hourFilter={hourFilter}
              levelFilter={levelFilter}
              onClusterClick={(c) => {
                setSelectedCluster(c);
                setSelectedZone(null);
              }}
              onViolationClick={() => {}}
            />

            <div className="absolute top-4 left-4 right-4 flex gap-3 pointer-events-none">
              <div className="pointer-events-auto flex-1">
                <StatsPanel summary={summary} />
              </div>
            </div>

            <div className="absolute top-4 right-4 pointer-events-auto">
              <button
                onClick={() => setShowPredictor(!showPredictor)}
                className={`glass px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                  showPredictor
                    ? "neon-border text-neon-magenta"
                    : "text-neon-magenta/70 hover:text-neon-magenta"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                PREDICTOR
              </button>
            </div>

            {showPredictor && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-16 right-4 w-80 pointer-events-auto max-h-[calc(100%-5rem)] overflow-y-auto"
              >
                <Predictor />
              </motion.div>
            )}
          </div>

          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="h-72 border-t border-neon-cyan/10 overflow-y-auto bg-background/80 backdrop-blur-sm"
          >
            <div className="p-4">
              <TemporalChart data={temporal} />
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
  );
}
