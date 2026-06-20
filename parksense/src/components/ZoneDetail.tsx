"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X, MapPin, AlertTriangle, Target, TrendingUp,
  Shield, Clock, Car, Zap,
} from "lucide-react";
import type { Zone, Cluster } from "@/types";

interface ZoneDetailProps {
  zone: Zone | null;
  cluster: Cluster | null;
  onClose: () => void;
}

export default function ZoneDetail({ zone, cluster, onClose }: ZoneDetailProps) {
  const data = zone || cluster;
  if (!data) return null;

  const isZone = "police_station" in data;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-80 h-full glass-dark border-l border-neon-cyan/10 overflow-y-auto"
      >
        <div className="p-4 border-b border-neon-cyan/10 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neon-cyan flex items-center gap-2">
            {isZone ? <Shield className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            {isZone ? "ZONE DETAILS" : "CLUSTER DETAILS"}
          </h3>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-surface hover:bg-neon-red/20 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-1">
              {isZone ? (data as Zone).police_station : `Cluster #${(data as Cluster).cluster}`}
            </h2>
            {isZone && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                (data as Zone).critical_pct > 0.05
                  ? "bg-neon-red/20 text-neon-red"
                  : (data as Zone).critical_pct > 0.01
                    ? "bg-neon-yellow/20 text-neon-yellow"
                    : "bg-neon-green/20 text-neon-green"
              }`}>
                PRIORITY #{(data as Zone).rank}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {isZone ? (
              <>
                <MetricCard
                  icon={AlertTriangle}
                  label="Violations"
                  value={(data as Zone).violation_count.toLocaleString()}
                  color="neon-red"
                />
                <MetricCard
                  icon={TrendingUp}
                  label="Avg Score"
                  value={(data as Zone).mean_score.toFixed(1)}
                  color="neon-cyan"
                />
                <MetricCard
                  icon={Target}
                  label="Junction %"
                  value={`${((data as Zone).junction_pct * 100).toFixed(0)}%`}
                  color="neon-orange"
                />
                <MetricCard
                  icon={Zap}
                  label="Critical %"
                  value={`${((data as Zone).critical_pct * 100).toFixed(1)}%`}
                  color="neon-yellow"
                />
              </>
            ) : (
              <>
                <MetricCard
                  icon={AlertTriangle}
                  label="Violations"
                  value={(data as Cluster).count.toLocaleString()}
                  color="neon-red"
                />
                <MetricCard
                  icon={TrendingUp}
                  label="Avg Score"
                  value={(data as Cluster).mean_score.toFixed(1)}
                  color="neon-cyan"
                />
                <MetricCard
                  icon={Target}
                  label="Junction %"
                  value={`${((data as Cluster).junction_pct * 100).toFixed(0)}%`}
                  color="neon-orange"
                />
                <MetricCard
                  icon={MapPin}
                  label="Zone"
                  value={(data as Cluster).top_station}
                  color="neon-green"
                />
              </>
            )}
          </div>

          {isZone && (
            <div className="glass rounded-lg p-3">
              <h4 className="text-xs font-semibold text-neon-cyan mb-2 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                RECOMMENDATION
              </h4>
              <p className="text-xs text-foreground/70 leading-relaxed">
                {(data as Zone).critical_pct > 0.05
                  ? "IMMEDIATE DISPATCH — High congestion impact zone. Deploy nearest enforcement unit for targeted patrol."
                  : (data as Zone).critical_pct > 0.01
                    ? "HIGH PRIORITY — Schedule enforcement within the next patrol cycle. Focus on junction violations."
                    : "MONITOR — Include in regular patrol route. No immediate action required."}
              </p>
            </div>
          )}

          {isZone && (
            <div className="glass rounded-lg p-3">
              <h4 className="text-xs font-semibold text-neon-cyan mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                ENFORCEMENT WINDOW
              </h4>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground/50">Peak Hours</span>
                  <span className="text-neon-yellow">17:00 — 20:00</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-foreground/50">Morning Rush</span>
                  <span className="text-neon-cyan">07:00 — 10:00</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-foreground/50">Low Activity</span>
                  <span className="text-neon-green">22:00 — 06:00</span>
                </div>
              </div>
            </div>
          )}

          {isZone && (data as Zone).junction_pct > 0.5 && (
            <div className="glass rounded-lg p-3 border border-neon-orange/20">
              <h4 className="text-xs font-semibold text-neon-orange mb-1 flex items-center gap-1">
                <Target className="w-3 h-3" />
                JUNCTION ALERT
              </h4>
              <p className="text-xs text-foreground/60">
                {((data as Zone).junction_pct * 100).toFixed(0)}% of violations in this zone occur at or near junctions.
                This directly impacts intersection throughput and should be prioritized.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="glass rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 text-${color}`} />
        <span className="text-[10px] text-foreground/40 uppercase">{label}</span>
      </div>
      <div className={`text-lg font-bold text-${color}`}>{value}</div>
    </div>
  );
}
