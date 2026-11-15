"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useMemo, useRef } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";
import type { FieldGeometry, LngLat } from "@/lib/types";
import type { Box } from "@/lib/geo/cells";
import type { BasemapStyle } from "./risk-layer-selector";

export const BASEMAP_STYLE: Record<BasemapStyle, string> = {
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  streets: "mapbox://styles/mapbox/streets-v12",
  terrain: "mapbox://styles/mapbox/outdoors-v12",
};

export interface MapInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface RiskMapCanvasProps {
  token: string;
  geometry: FieldGeometry;
  centroid: LngLat;
  footprint?: Box;
  footprintLabel: string;
  basemap: BasemapStyle;
  /** "field" frames the parcel; "grid" frames the whole data cell so the field's place in it is visible. */
  view: "field" | "grid";
  /** Change to re-frame even when nothing else changed. */
  viewNonce: number;
  inset: MapInset;
  /** Value-driven tints; absent means "nothing to show", never a default colour. */
  viz?: { cell?: { color: string; opacity: number }; field?: { color: string; opacity: number } };
  onFailure: () => void;
}

const boxRing = (b: Box): LngLat[] => [
  [b.west, b.south],
  [b.east, b.south],
  [b.east, b.north],
  [b.west, b.north],
  [b.west, b.south],
];

function geometryBounds(g: FieldGeometry, c: LngLat): [LngLat, LngLat] {
  const pts: LngLat[] = g.type === "Point" ? [g.coordinates] : g.coordinates.flat();
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [x, y] of pts) {
    w = Math.min(w, x);
    e = Math.max(e, x);
    s = Math.min(s, y);
    n = Math.max(n, y);
  }
  // A pin or a very small plot gets about 300 m of context so the picture is readable.
  const minHalf = 0.0014;
  if (!Number.isFinite(w) || e - w < minHalf * 2) {
    w = c[0] - minHalf;
    e = c[0] + minHalf;
  }
  if (!Number.isFinite(s) || n - s < minHalf * 2) {
    s = c[1] - minHalf;
    n = c[1] + minHalf;
  }
  return [
    [w, s],
    [e, n],
  ];
}

/** The live Mapbox canvas. Loaded on the client only, and only when a public token is configured. */
export default function RiskMapCanvas({ token, geometry, centroid, footprint, footprintLabel, basemap, view, viewNonce, inset, viz, onFailure }: RiskMapCanvasProps) {
  const ref = useRef<MapRef>(null);
  const dark = basemap === "satellite";
  const outline = dark ? "#fbfaf6" : "#0e6b4f";
  const gridColor = dark ? "#fbfaf6" : "#20241f";

  const fieldData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: geometry.type === "Polygon" ? [{ type: "Feature" as const, properties: {}, geometry }] : [],
    }),
    [geometry],
  );
  const gridData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: footprint
        ? [
            { type: "Feature" as const, properties: { label: footprintLabel }, geometry: { type: "Polygon" as const, coordinates: [boxRing(footprint)] } },
            { type: "Feature" as const, properties: { label: footprintLabel }, geometry: { type: "Point" as const, coordinates: [(footprint.west + footprint.east) / 2, footprint.north] } },
          ]
        : [],
    }),
    [footprint, footprintLabel],
  );

  const frame = useCallback(
    (animate: boolean) => {
      const map = ref.current?.getMap();
      if (!map) return;
      const padding = { top: inset.top + 12, bottom: inset.bottom + 12, left: inset.left + 12, right: inset.right + 12 };
      const bounds: [LngLat, LngLat] =
        view === "grid" && footprint
          ? [
              [footprint.west, footprint.south],
              [footprint.east, footprint.north],
            ]
          : geometryBounds(geometry, centroid);
      const calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      map.fitBounds(bounds, { padding, maxZoom: 17, duration: animate && !calm ? 700 : 0 });
    },
    [inset.top, inset.bottom, inset.left, inset.right, view, footprint, geometry, centroid],
  );

  const first = useRef(true);
  useEffect(() => {
    frame(!first.current);
    first.current = false;
  }, [frame, viewNonce]);

  return (
    <Map
      ref={ref}
      mapboxAccessToken={token}
      mapStyle={BASEMAP_STYLE[basemap]}
      initialViewState={{ longitude: centroid[0], latitude: centroid[1], zoom: 14 }}
      onLoad={() => frame(false)}
      onError={(e) => {
        const status = (e.error as { status?: number } | undefined)?.status;
        const map = ref.current?.getMap();
        if (status === 401 || status === 403 || !map || !map.isStyleLoaded()) onFailure();
      }}
      attributionControl
      style={{ width: "100%", height: "100%" }}
      reuseMaps={false}
    >
      {footprint ? (
        <Source id="data-cell" type="geojson" data={gridData}>
          <Layer id="data-cell-fill" type="fill" filter={["==", ["geometry-type"], "Polygon"]} paint={{ "fill-color": viz?.cell?.color ?? gridColor, "fill-opacity": viz?.cell?.opacity ?? 0.03 }} />
          <Layer id="data-cell-line" type="line" filter={["==", ["geometry-type"], "Polygon"]} paint={{ "line-color": gridColor, "line-width": 2, "line-dasharray": [2, 2] }} />
          <Layer
            id="data-cell-label"
            type="symbol"
            filter={["==", ["geometry-type"], "Point"]}
            layout={{ "text-field": ["get", "label"], "text-size": 12, "text-anchor": "top", "text-offset": [0, 0.6], "text-max-width": 22 }}
            paint={{ "text-color": gridColor, "text-halo-color": dark ? "#20241f" : "#ffffff", "text-halo-width": 1.6 }}
          />
        </Source>
      ) : null}
      <Source id="field" type="geojson" data={fieldData}>
        <Layer id="field-fill" type="fill" paint={{ "fill-color": viz?.field?.color ?? "#0e6b4f", "fill-opacity": viz?.field?.opacity ?? 0.2 }} />
        <Layer id="field-line" type="line" paint={{ "line-color": outline, "line-width": 3 }} />
      </Source>
      {geometry.type === "Point" ? (
        <Marker longitude={geometry.coordinates[0]} latitude={geometry.coordinates[1]} anchor="center">
          <span aria-hidden className="block size-4 rounded-full border-[3px] border-white bg-field shadow-float" />
        </Marker>
      ) : null}
    </Map>
  );
}
