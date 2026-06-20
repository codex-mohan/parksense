"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, useMap, useControl } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { DeckProps, PickingInfo } from "@deck.gl/core";
import type { Violation, Cluster } from "@/types";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Layers,
  Satellite,
  MapPin,
  Hexagon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const SATELLITE_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const SATELLITE_RASTER = {
  version: 8 as const,
  sources: {
    "esri-satellite": {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri World Imagery",
      maxzoom: 18,
    },
  },
  layers: [
    {
      id: "satellite-layer",
      type: "raster" as const,
      source: "esri-satellite",
    },
  ],
};

function DeckGLOverlay(props: DeckProps) {
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay({ ...props, interleaved: true }),
  );
  overlay.setProps(props);
  return null;
}

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  satellite: boolean;
  onSatelliteToggle: () => void;
  activeLayer: string;
  onLayerChange: (layer: string) => void;
}

function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
  satellite,
  onSatelliteToggle,
  activeLayer,
  onLayerChange,
}: MapControlsProps) {
  return (
    <>
      {/* Layer switcher - top right */}
      <div className="absolute top-4 right-4 glass rounded-lg p-1.5 flex flex-col gap-1 z-10">
        <button
          onClick={() => onLayerChange("heatmap")}
          className={`p-2 rounded-md transition-all ${
            activeLayer === "heatmap"
              ? "bg-neon-cyan/20 text-neon-cyan"
              : "text-foreground/50 hover:text-foreground/80 hover:bg-white/5"
          }`}
          title="Heatmap"
        >
          <Layers className="w-4 h-4" />
        </button>
        <button
          onClick={() => onLayerChange("scatter")}
          className={`p-2 rounded-md transition-all ${
            activeLayer === "scatter"
              ? "bg-neon-cyan/20 text-neon-cyan"
              : "text-foreground/50 hover:text-foreground/80 hover:bg-white/5"
          }`}
          title="Scatter"
        >
          <MapPin className="w-4 h-4" />
        </button>
        <button
          onClick={() => onLayerChange("hexbin")}
          className={`p-2 rounded-md transition-all ${
            activeLayer === "hexbin"
              ? "bg-neon-cyan/20 text-neon-cyan"
              : "text-foreground/50 hover:text-foreground/80 hover:bg-white/5"
          }`}
          title="Hexbin"
        >
          <Hexagon className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom + satellite - bottom right */}
      <div className="absolute bottom-4 right-4 glass rounded-lg p-1.5 flex flex-col gap-1 z-10">
        <button
          onClick={onZoomIn}
          className="p-2 rounded-md text-foreground/50 hover:text-foreground/80 hover:bg-white/5 transition-all"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-2 rounded-md text-foreground/50 hover:text-foreground/80 hover:bg-white/5 transition-all"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onReset}
          className="p-2 rounded-md text-foreground/50 hover:text-foreground/80 hover:bg-white/5 transition-all"
          title="Reset view"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-full h-px bg-border my-0.5" />
        <button
          onClick={onSatelliteToggle}
          className={`p-2 rounded-md transition-all ${
            satellite
              ? "bg-neon-green/20 text-neon-green"
              : "text-foreground/50 hover:text-foreground/80 hover:bg-white/5"
          }`}
          title={satellite ? "Switch to dark map" : "Switch to satellite"}
        >
          <Satellite className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}

interface MapComponentProps {
  violations: Violation[];
  clusters: Cluster[];
  activeLayer: "heatmap" | "hexbin" | "scatter" | "clusters";
  hourFilter: [number, number];
  levelFilter: string[];
  focusZone?: { lat: number; lon: number } | null;
  onClusterClick?: (cluster: Cluster) => void;
  onViolationClick?: (v: Violation) => void;
  onLayerChange?: (layer: "heatmap" | "hexbin" | "scatter" | "clusters") => void;
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
  focusZone,
  onClusterClick,
  onViolationClick,
  onLayerChange,
}: MapComponentProps) {
  const [satellite, setSatellite] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: 77.59,
    latitude: 12.97,
    zoom: 11.5,
    pitch: 0,
    bearing: 0,
  });

  useEffect(() => {
    if (focusZone) {
      setViewState((prev) => ({
        ...prev,
        longitude: focusZone.lon,
        latitude: focusZone.lat,
        zoom: 14,
      }));
    }
  }, [focusZone]);

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
          radiusPixels: satellite ? 40 : 30,
          intensity: 1.5,
          threshold: 0.1,
          colorRange: satellite
            ? [
                [0, 180, 120],
                [220, 180, 0],
                [255, 100, 0],
                [255, 40, 60],
                [200, 0, 60],
              ]
            : [
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
          opacity: satellite ? 0.8 : 0.6,
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
          getLineColor: satellite ? [255, 255, 255, 150] : [0, 240, 255, 150],
          getLineWidth: 2,
          onClick: (info: PickingInfo) => {
            if (info.object) onClusterClick?.(info.object as Cluster);
          },
        })
      );
    }

    return result;
  }, [filteredViolations, clusters, activeLayer, satellite, onClusterClick, onViolationClick]);

  const getTooltip = useCallback((info: PickingInfo) => {
    if (!info.object) return null;
    const d = info.object as any;
    if (d.cluster !== undefined && d.congestion_score !== undefined) {
      return {
        text: `Score: ${d.congestion_score.toFixed(1)} | ${d.congestion_level}\n${d.police_station}`,
        style: {
          background: satellite ? "#0a1a10" : "#0f1318",
          color: "#c8d0e0",
          border: `1px solid ${satellite ? "rgba(0,180,120,0.4)" : "rgba(0,212,230,0.4)"}`,
          borderRadius: "8px",
          fontSize: "11px",
        },
      };
    }
    if (d.count !== undefined && d.lat !== undefined) {
      return {
        text: `Cluster: ${d.count} violations\nScore: ${d.mean_score.toFixed(1)} | ${d.top_station}`,
        style: {
          background: satellite ? "#0a1a10" : "#0f1318",
          color: "#c8d0e0",
          border: `1px solid ${satellite ? "rgba(0,180,120,0.4)" : "rgba(0,212,230,0.4)"}`,
          borderRadius: "8px",
          fontSize: "11px",
        },
      };
    }
    return null;
  }, [satellite]);

  const handleZoomIn = useCallback(() => {
    setViewState((prev) => ({ ...prev, zoom: Math.min(prev.zoom + 1, 18) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewState((prev) => ({ ...prev, zoom: Math.max(prev.zoom - 1, 3) }));
  }, []);

  const handleReset = useCallback(() => {
    setViewState({
      longitude: 77.59,
      latitude: 12.97,
      zoom: 11.5,
      pitch: 0,
      bearing: 0,
    });
  }, []);

  return (
    <div className="w-full h-full relative">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={satellite ? SATELLITE_RASTER : DARK_STYLE}
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

      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        satellite={satellite}
        onSatelliteToggle={() => setSatellite(!satellite)}
        activeLayer={activeLayer}
        onLayerChange={(l) => onLayerChange?.(l as any)}
      />

      {/* Legend - bottom left */}
      <div className="absolute bottom-4 left-4 glass rounded-lg px-3 py-2 text-xs text-foreground/60 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-neon-green" />
          <span>Low</span>
          <div className="w-2 h-2 rounded-full bg-neon-yellow" />
          <span>Medium</span>
          <div className="w-2 h-2 rounded-full bg-neon-orange" />
          <span>High</span>
          <div className="w-2 h-2 rounded-full bg-neon-red" />
          <span>Critical</span>
        </div>
      </div>

      {/* Satellite indicator */}
      {satellite && (
        <div className="absolute top-4 left-4 glass rounded-lg px-3 py-1.5 text-xs text-neon-green flex items-center gap-1.5 z-10">
          <Satellite className="w-3 h-3" />
          Satellite View
        </div>
      )}
    </div>
  );
}
