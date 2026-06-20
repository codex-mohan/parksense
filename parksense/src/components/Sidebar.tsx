"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, AlertTriangle, ChevronRight, Search,
  Filter, Layers, Clock, X,
} from "lucide-react";
import type { Zone, MapLayer } from "@/types";

interface SidebarProps {
  zones: Zone[];
  activeLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  hourFilter: [number, number];
  onHourFilterChange: (range: [number, number]) => void;
  levelFilter: string[];
  onLevelFilterChange: (levels: string[]) => void;
  selectedZone: string | null;
  onZoneSelect: (zone: string) => void;
}

const LAYER_OPTIONS: { key: MapLayer; label: string; icon: typeof Layers }[] = [
  { key: "heatmap", label: "Heatmap", icon: Layers },
  { key: "scatter", label: "Scatter", icon: MapPin },
  { key: "clusters", label: "Clusters", icon: AlertTriangle },
];

const LEVEL_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const LEVEL_COLORS: Record<string, string> = {
  LOW: "bg-neon-green",
  MEDIUM: "bg-neon-yellow",
  HIGH: "bg-[#e67e22]",
  CRITICAL: "bg-neon-red",
};

export default function Sidebar({
  zones, activeLayer, onLayerChange,
  hourFilter, onHourFilterChange,
  levelFilter, onLevelFilterChange,
  selectedZone, onZoneSelect,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filteredZones = zones.filter((z) =>
    z.police_station.toLowerCase().includes(search.toLowerCase())
  );

  const toggleLevel = (level: string) => {
    if (levelFilter.includes(level)) {
      onLevelFilterChange(levelFilter.filter((l) => l !== level));
    } else {
      onLevelFilterChange([...levelFilter, level]);
    }
  };

  return (
    <motion.aside
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-80 h-full glass-dark flex flex-col overflow-hidden border-r border-neon-cyan/10"
    >
      <div className="p-4 border-b border-neon-cyan/10">
        <h2 className="text-sm font-semibold text-neon-cyan mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4" />
          MAP LAYERS
        </h2>
        <div className="flex gap-1">
          {LAYER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onLayerChange(opt.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                activeLayer === opt.key
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                  : "bg-surface text-foreground/50 hover:text-foreground/80 hover:bg-surface-light"
              }`}
            >
              <opt.icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-b border-neon-cyan/10">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-between w-full text-sm font-semibold text-neon-cyan mb-2"
        >
          <span className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            FILTERS
          </span>
          <ChevronRight className={`w-4 h-4 transition-transform ${showFilters ? "rotate-90" : ""}`} />
        </button>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-foreground/50 flex items-center gap-1 mb-1.5">
                    <Clock className="w-3 h-3" />
                    Hour Range: {hourFilter[0]}:00 — {hourFilter[1]}:00
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="range"
                      min={0}
                      max={23}
                      value={hourFilter[0]}
                      onChange={(e) => onHourFilterChange([+e.target.value, hourFilter[1]])}
                      className="flex-1 accent-neon-cyan"
                    />
                    <input
                      type="range"
                      min={0}
                      max={23}
                      value={hourFilter[1]}
                      onChange={(e) => onHourFilterChange([hourFilter[0], +e.target.value])}
                      className="flex-1 accent-neon-cyan"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-foreground/50 mb-1.5 block">
                    Congestion Level
                  </label>
                  <div className="flex gap-1">
                    {LEVEL_OPTIONS.map((level) => (
                      <button
                        key={level}
                        onClick={() => toggleLevel(level)}
                        className={`flex-1 px-1.5 py-1 rounded text-[10px] font-medium transition-all ${
                          levelFilter.includes(level)
                            ? `${LEVEL_COLORS[level]} text-background`
                            : "bg-surface text-foreground/40 hover:text-foreground/60"
                        }`}
                      >
                        {level.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {levelFilter.length > 0 && (
                  <button
                    onClick={() => onLevelFilterChange([])}
                    className="text-xs text-neon-cyan/60 hover:text-neon-cyan flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 border-b border-neon-cyan/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
          <input
            type="text"
            placeholder="Search zones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface rounded-lg text-sm text-foreground placeholder:text-foreground/30 border border-border focus:border-neon-cyan/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="px-2 py-1.5 text-[10px] text-foreground/40 uppercase tracking-wider">
            Enforcement Priority ({filteredZones.length} zones)
          </div>
          {filteredZones.map((zone, i) => (
            <motion.button
              key={zone.police_station}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
              onClick={() => onZoneSelect(zone.police_station)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all group ${
                selectedZone === zone.police_station
                  ? "bg-neon-cyan/15 border border-neon-cyan/30"
                  : "hover:bg-surface-light"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    zone.critical_pct > 0.05
                      ? "bg-neon-red/20 text-neon-red"
                      : zone.critical_pct > 0.01
                        ? "bg-neon-yellow/20 text-neon-yellow"
                        : "bg-neon-green/20 text-neon-green"
                  }`}>
                    {zone.rank}
                  </span>
                  <span className="text-sm font-medium text-foreground/90 truncate">
                    {zone.police_station}
                  </span>
                </div>
                <span className="text-xs text-neon-cyan/60">
                  {zone.priority_score.toFixed(0)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-foreground/40">
                <span>{zone.violation_count.toLocaleString()} violations</span>
                <span>•</span>
                <span>{(zone.junction_pct * 100).toFixed(0)}% junction</span>
                <span>•</span>
                <span className={`${zone.critical_pct > 0.05 ? "text-neon-red" : ""}`}>
                  {(zone.critical_pct * 100).toFixed(1)}% critical
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
