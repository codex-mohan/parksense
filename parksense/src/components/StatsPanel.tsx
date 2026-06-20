"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin, AlertTriangle, Target,
  Clock, Zap, BarChart3,
} from "lucide-react";
import type { Summary } from "@/types";

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const steps = 40;
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
      {display.toLocaleString()}{suffix}
    </span>
  );
}

interface StatsPanelProps {
  summary: Summary;
}

export default function StatsPanel({ summary }: StatsPanelProps) {
  const stats = [
    {
      label: "Violations",
      value: summary.total_violations,
      icon: AlertTriangle,
      color: "neon-red",
      suffix: "",
    },
    {
      label: "Clusters",
      value: summary.total_clusters,
      icon: MapPin,
      color: "neon-cyan",
      suffix: "",
    },
    {
      label: "Junction",
      value: Math.round(summary.junction_pct * 100),
      icon: Target,
      color: "neon-magenta",
      suffix: "%",
    },
    {
      label: "Rush Hour",
      value: Math.round(summary.rush_hour_pct * 100),
      icon: Clock,
      color: "neon-yellow",
      suffix: "%",
    },
    {
      label: "Critical",
      value: Math.round(summary.critical_pct * 100),
      icon: Zap,
      color: "neon-red",
      suffix: "%",
    },
    {
      label: "Zones",
      value: summary.total_zones,
      icon: BarChart3,
      color: "neon-green",
      suffix: "",
    },
  ];

  return (
    <div className="flex items-center gap-1">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/80 border border-border hover:border-neon-cyan/30 transition-all"
        >
          <stat.icon className={`w-3 h-3 text-${stat.color}`} />
          <span className={`text-xs font-bold text-${stat.color}`}>
            <AnimatedNumber value={stat.value} suffix={stat.suffix} />
          </span>
          <span className="text-[10px] text-foreground/40 hidden lg:inline">
            {stat.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
