"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Target, CheckCircle } from "lucide-react";

interface ModelResult {
  name: string;
  val_mae: number;
  val_r2: number;
  test_mae: number;
  test_r2: number;
  train_time_sec: number;
}

interface ValidationData {
  cross_validation: { fold: number; mae: number; r2: number; train_size: number; test_size: number }[];
  cv_summary: { mean_mae: number; mean_r2: number; folds: number };
  segment_analysis: any;
  residual_analysis: {
    mean_residual: number;
    pct_within_1: number;
    pct_within_5: number;
    overestimate_pct: number;
  };
}

const MODEL_COLORS: Record<string, string> = {
  "LightGBM": "#00d4e6",
  "XGBoost": "#00c97b",
  "CatBoost": "#f0c030",
  "Random Forest": "#e87830",
  "Voting Ensemble": "#e84040",
  "Stacking Ensemble": "#a855f7",
};

export default function ModelComparison() {
  const [models, setModels] = useState<ModelResult[]>([]);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/data/model_comparison.json").then((r) => r.json()),
      fetch("/data/validation_results.json").then((r) => r.json()),
    ]).then(([m, v]) => {
      setModels(m);
      setValidation(v);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <div className="text-sm text-foreground/50">Loading model comparison...</div>
      </div>
    );
  }

  const best = models.reduce((a, b) => (a.test_r2 > b.test_r2 ? a : b));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Model Comparison Table */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-sm font-semibold text-neon-cyan mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          MODEL COMPARISON
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-foreground/40 border-b border-border">
                <th className="text-left py-2 px-2">Model</th>
                <th className="text-right py-2 px-2">Test MAE</th>
                <th className="text-right py-2 px-2">Test R²</th>
                <th className="text-right py-2 px-2">Time</th>
                <th className="text-right py-2 px-2">R² Bar</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr
                  key={m.name}
                  className={`border-b border-border/50 ${
                    m.name === best.name ? "bg-neon-cyan/5" : ""
                  }`}
                >
                  <td className="py-2 px-2 font-medium flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: MODEL_COLORS[m.name] }}
                    />
                    {m.name}
                    {m.name === best.name && (
                      <CheckCircle className="w-3 h-3 text-neon-green" />
                    )}
                  </td>
                  <td className="text-right py-2 px-2 font-mono">{m.test_mae.toFixed(4)}</td>
                  <td className="text-right py-2 px-2 font-mono">{m.test_r2.toFixed(4)}</td>
                  <td className="text-right py-2 px-2 text-foreground/50">{m.train_time_sec}s</td>
                  <td className="text-right py-2 px-2 w-32">
                    <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${m.test_r2 * 100}%`,
                          background: MODEL_COLORS[m.name],
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cross-Validation */}
      {validation && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-neon-cyan mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            TIME-SERIES CROSS-VALIDATION
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-surface rounded-lg p-3">
              <div className="text-[10px] text-foreground/40">Mean MAE</div>
              <div className="text-lg font-bold text-neon-cyan">{validation.cv_summary.mean_mae.toFixed(4)}</div>
            </div>
            <div className="bg-surface rounded-lg p-3">
              <div className="text-[10px] text-foreground/40">Mean R²</div>
              <div className="text-lg font-bold text-neon-green">{validation.cv_summary.mean_r2.toFixed(4)}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {validation.cross_validation.map((fold) => (
              <div key={fold.fold} className="flex items-center gap-2 text-xs">
                <span className="text-foreground/40 w-12">Fold {fold.fold}</span>
                <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neon-cyan rounded-full"
                    style={{ width: `${fold.r2 * 100}%` }}
                  />
                </div>
                <span className="font-mono w-12 text-right">{fold.r2.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Residual Analysis */}
      {validation?.residual_analysis && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold text-neon-cyan mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            RESIDUAL ANALYSIS
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface rounded-lg p-3">
              <div className="text-[10px] text-foreground/40">Mean Bias</div>
              <div className={`text-sm font-bold ${
                Math.abs(validation.residual_analysis.mean_residual) < 0.01
                  ? "text-neon-green"
                  : "text-neon-yellow"
              }`}>
                {validation.residual_analysis.mean_residual.toFixed(4)}
              </div>
              <div className="text-[9px] text-foreground/30">
                {Math.abs(validation.residual_analysis.mean_residual) < 0.01 ? "Unbiased" : "Slight bias"}
              </div>
            </div>
            <div className="bg-surface rounded-lg p-3">
              <div className="text-[10px] text-foreground/40">Within ±1</div>
              <div className="text-sm font-bold text-neon-green">
                {(validation.residual_analysis.pct_within_1 * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-surface rounded-lg p-3">
              <div className="text-[10px] text-foreground/40">Within ±5</div>
              <div className="text-sm font-bold text-neon-green">
                {(validation.residual_analysis.pct_within_5 * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-surface rounded-lg p-3">
              <div className="text-[10px] text-foreground/40">Overestimate %</div>
              <div className="text-sm font-bold text-foreground/80">
                {(validation.residual_analysis.overestimate_pct * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
