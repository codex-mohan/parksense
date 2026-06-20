"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, AlertTriangle, TrendingUp, Shield,
  ChevronDown, Search, Filter, X, Layers,
  BarChart3, Clock, Zap, Target,
} from "lucide-react";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass-dark shadow-lg shadow-neon-cyan/5"
          : "bg-transparent"
      }`}
    >
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-neon-cyan/20 border border-neon-cyan/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-background" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-neon-green rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              <span className="neon-text text-neon-cyan">PARK</span>
              <span className="text-foreground">SENSE</span>
            </h1>
            <p className="text-[10px] text-neon-cyan/60 tracking-widest uppercase">
              AI Parking Intelligence
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1 text-xs">
          <span className="px-2 py-1 rounded-full bg-neon-green/10 text-neon-green border border-neon-green/20">
            HDBSCAN: 524 clusters
          </span>
          <span className="px-2 py-1 rounded-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
            LightGBM: R² 0.999
          </span>
          <span className="px-2 py-1 rounded-full bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/20">
            115K violations analyzed
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neon-cyan/40 hidden sm:block">
            Bengaluru Traffic Police
          </span>
          <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
        </div>
      </div>
    </motion.header>
  );
}
