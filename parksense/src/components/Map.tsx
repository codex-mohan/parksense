"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Map, useControl } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { DeckProps, PickingInfo } from "@deck.gl/core";
import type { Violation, Cluster } from "@/types";
import "maplibre-gl/dist/maplibre-gl.css";

const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

function DeckGLOverlay(props: DeckProps) {
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay({ ...props, interleaved: true }),
  );
  overlay.setProps(props);
  return null;
}

interface MapComponentProps {
  violations: Violation[];
  clusters: Cluster[];
  activeLayer: "heatmap" | "hexbin" | "scatter" | "clusters";
  hourFilter: [number, number];
  levelFilter: string[];
  onClusterClick?: (cluster: Cluster) => void;
  onViolationClick?: (v: Violation) => void;
}

const LEVEL_COLORS: Record<string, [number, number, number, number]> = {
  LOW: [0, 255, 136, 80],
  MEDIUM: [255, 238, 0, 120],
  HIGH: [230, 126, 34, 160],
  CRITICAL: [255, 51, 85, 220],
};

export default function MapComponent({
  violations,
  clusters,
  activeLayer,
  hourFilter,
  levelFilter,
  onClusterClick,
  onViolationClick,
}: MapComponentProps) {
  const [viewState, setViewState] = useState({
    longitude: 77.59,
    latitude: 12.97,
    zoom: 11.5,
    pitch: 0,
    bearing: 0,
  });

  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      if (v.hour < hourFilter[0] || v.hour > hourFilter[1]) return false;
      if (levelFilter.length > 0 && !levelFilter.includes(v.congestion_level)) return false;
      return true;
    });
  }, [violations, hourFilter, levelFilter]);

  const layers = useMemo(() => {
    const result: any[] = [];

    if (activeLayer === "heatmap") {
      result.push(
        new HeatmapLayer({
          id: "heatmap",
          data: filteredViolations,
          getPosition: (d: Violation) => [d.longitude, d.latitude],
          getWeight: (d: Violation) => d.congestion_score,
          radiusPixels: 30,
          intensity: 1.5,
          threshold: 0.1,
          colorRange: [
            [0, 255, 136],
            [255, 238, 0],
            [255, 140, 0],
            [255, 51, 85],
            [200, 0, 60],
          ],
          pickable: true,
        })
      );
    }

    if (activeLayer === "scatter" || activeLayer === "clusters") {
      result.push(
        new ScatterplotLayer({
          id: "violations-scatter",
          data: filteredViolations,
          getPosition: (d: Violation) => [d.longitude, d.latitude],
          getFillColor: (d: Violation) => LEVEL_COLORS[d.congestion_level] || [100, 100, 100, 100],
          getRadius: (d: Violation) => 30 + d.congestion_score * 0.5,
          radiusMinPixels: 2,
          radiusMaxPixels: 15,
          pickable: true,
          opacity: 0.6,
          onClick: (info: PickingInfo) => {
            if (info.object) onViolationClick?.(info.object as Violation);
          },
        })
      );
    }

    if (activeLayer === "clusters") {
      result.push(
        new ScatterplotLayer({
          id: "cluster-markers",
          data: clusters,
          getPosition: (d: Cluster) => [d.lon, d.lat],
          getFillColor: (d: Cluster) => {
            if (d.mean_score > 30) return [255, 51, 85, 200];
            if (d.mean_score > 15) return [255, 140, 0, 180];
            return [0, 255, 136, 150];
          },
          getRadius: (d: Cluster) => Math.sqrt(d.count) * 8,
          radiusMinPixels: 8,
          radiusMaxPixels: 50,
          pickable: true,
          stroked: true,
          getLineColor: [0, 240, 255, 150],
          getLineWidth: 2,
          onClick: (info: PickingInfo) => {
            if (info.object) onClusterClick?.(info.object as Cluster);
          },
        })
      );
    }

    return result;
  }, [filteredViolations, clusters, activeLayer, onClusterClick, onViolationClick]);

  const getTooltip = useCallback((info: PickingInfo) => {
    if (!info.object) return null;
    const d = info.object as any;
    if (d.cluster !== undefined && d.congestion_score !== undefined) {
      return {
        text: `Score: ${d.congestion_score.toFixed(1)} | ${d.congestion_level}\n${d.police_station}`,
        style: { background: "#12121f", color: "#e0e0ff", border: "1px solid #00f0ff" },
      };
    }
    if (d.count !== undefined && d.lat !== undefined) {
      return {
        text: `Cluster: ${d.count} violations\nScore: ${d.mean_score.toFixed(1)} | ${d.top_station}`,
        style: { background: "#12121f", color: "#e0e0ff", border: "1px solid #00f0ff" },
      };
    }
    return null;
  }, []);

  return (
    <div className="w-full h-full relative">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={DARK_STYLE}
        style={{ width: "100%", height: "100%" }}
        cursor="grab"
        interactiveLayerIds={[]}
        attributionControl={false}
      >
        <DeckGLOverlay
          layers={layers}
          getTooltip={getTooltip}
        />
      </Map>

      <div className="absolute bottom-4 left-4 glass rounded-lg px-3 py-2 text-xs text-foreground/60">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-neon-green" />
          <span>Low</span>
          <div className="w-2 h-2 rounded-full bg-neon-yellow" />
          <span>Medium</span>
          <div className="w-2 h-2 rounded-full bg-neon-red" />
          <span>High</span>
          <div className="w-2 h-2 rounded-full bg-neon-magenta" />
          <span>Critical</span>
        </div>
      </div>
    </div>
  );
}
