"use client";

import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import { Clock, Car, AlertTriangle, TrendingUp } from "lucide-react";
import type { TemporalData } from "@/types";

interface TemporalChartProps {
  data: TemporalData;
}

const CHART_COLORS = ["#00f0ff", "#ff00aa", "#00ff88", "#ffee00", "#ff3355", "#e67e22", "#9b59b6", "#3498db"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES: Record<number, string> = { 11: "Nov", 12: "Dec", 1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr" };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs border border-neon-cyan/30">
      <p className="text-neon-cyan font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

export default function TemporalChart({ data }: TemporalChartProps) {
  const hourlyData = data.hourly.map((d) => ({
    ...d,
    label: `${d.hour}:00`,
    critical_pct: +(d.critical_pct * 100).toFixed(1),
  }));

  const dailyData = data.daily.map((d) => ({
    ...d,
    label: DAY_NAMES[d.day_of_week] || `Day ${d.day_of_week}`,
  }));

  const monthlyData = data.monthly
    .sort((a, b) => a.month - b.month)
    .map((d) => ({
      ...d,
      label: MONTH_NAMES[d.month] || `Month ${d.month}`,
    }));

  const vehicleData = data.vehicle_distribution.slice(0, 8).map((d, i) => ({
    ...d,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const violationData = data.violation_distribution.slice(0, 6).map((d, i) => ({
    ...d,
    name: d.violation_type || d.congestion_level || "Unknown",
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-xl p-4"
      >
        <h3 className="text-sm font-semibold text-neon-cyan mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          HOURLY CONGESTION PATTERN
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="gradientScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#e0e0ff", fontSize: 10 }}
                axisLine={{ stroke: "#2a2a4a" }}
                interval={2}
              />
              <YAxis
                tick={{ fill: "#e0e0ff", fontSize: 10 }}
                axisLine={{ stroke: "#2a2a4a" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#00f0ff"
                fill="url(#gradientScore)"
                strokeWidth={2}
                name="Violations"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-xl p-4"
        >
          <h3 className="text-sm font-semibold text-neon-cyan mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            DAILY PATTERN
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#e0e0ff", fontSize: 10 }}
                  axisLine={{ stroke: "#2a2a4a" }}
                />
                <YAxis
                  tick={{ fill: "#e0e0ff", fontSize: 10 }}
                  axisLine={{ stroke: "#2a2a4a" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#00f0ff" radius={[4, 4, 0, 0]} name="Violations" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-xl p-4"
        >
          <h3 className="text-sm font-semibold text-neon-cyan mb-3 flex items-center gap-2">
            <Car className="w-4 h-4" />
            VEHICLE TYPES
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vehicleData}
                  dataKey="count"
                  nameKey="vehicle_type"
                  cx="50%"
                  cy="50%"
                  outerRadius={55}
                  innerRadius={30}
                  strokeWidth={0}
                >
                  {vehicleData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass rounded-xl p-4"
      >
        <h3 className="text-sm font-semibold text-neon-cyan mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          VIOLATION TYPES
        </h3>
        <div className="space-y-2">
          {violationData.map((v, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-foreground/60 w-32 truncate">{v.name}</span>
              <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(v.count / violationData[0].count) * 100}%` }}
                  transition={{ delay: 0.7 + i * 0.1, duration: 0.8 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: v.fill }}
                />
              </div>
              <span className="text-xs text-foreground/40 w-12 text-right">
                {v.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
