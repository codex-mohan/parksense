"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin, AlertTriangle, TrendingUp, Target,
  Car, Clock, Zap, BarChart3,
} from "lucide-react";
import type { Summary } from "@/types";

function AnimatedNumber({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
}

interface StatsPanelProps {
  summary: Summary;
}

export default function StatsPanel({ summary }: StatsPanelProps) {
  const stats = [
    {
      label: "Total Violations",
      value: summary.total_violations,
      icon: AlertTriangle,
      color: "neon-red",
      suffix: "",
    },
    {
      label: "Hotspot Clusters",
      value: summary.total_clusters,
      icon: MapPin,
      color: "neon-cyan",
      suffix: "",
    },
    {
      label: "Junction Impact",
      value: Math.round(summary.junction_pct * 100),
      icon: Target,
      color: "neon-magenta",
      suffix: "%",
    },
    {
      label: "Rush Hour %",
      value: Math.round(summary.rush_hour_pct * 100),
      icon: Clock,
      color: "neon-yellow",
      suffix: "%",
    },
    {
      label: "Critical Zones",
      value: Math.round(summary.critical_pct * 100),
      icon: Zap,
      color: "neon-red",
      suffix: "%",
    },
    {
      label: "Enforcement Zones",
      value: summary.total_zones,
      icon: BarChart3,
      color: "neon-green",
      suffix: "",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className="glass rounded-xl p-4 group hover:neon-border transition-all duration-300"
        >
          <div className="flex items-center gap-2 mb-2">
            <stat.icon className={`w-4 h-4 text-${stat.color}`} />
            <span className="text-[11px] text-foreground/50 uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
          <div className={`text-2xl font-bold text-${stat.color}`}>
            <AnimatedNumber value={stat.value} suffix={stat.suffix} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
