"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Source, type MapRef } from "react-map-gl/mapbox";
import {
  TerraDraw,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
  type HexColor,
} from "terra-draw";
import { TerraDrawMapboxGLAdapter } from "terra-draw-mapbox-gl-adapter";
import { footprintBox, type Box } from "@/lib/geo/cells";
import { centroid } from "@/lib/geo/shapes";
import type { FieldGeometry, LngLat } from "@/lib/types";
import { MAPBOX_STYLE } from "./mapbox-config";

import type { Townships } from "@/lib/geospatial-farmer/geospatial/townships";

export type DrawTool = "box" | "outline";

const MODE_FOR_TOOL: Record<DrawTool, string> = { box: "rectangle", outline: "polygon" };
const SHAPE_MODES = new Set(["point", "rectangle", "polygon"]);

export interface MapFocus {
  center: LngLat;
  zoom?: number;
  /** [west, south, east, north] */
  bbox?: [number, number, number, number];
  /** Change this to fly to the same place again. */
  nonce: number;
}

export interface FieldMapProps {
  boundaries?: Townships | null;
  selectedTownship?: string;
  token: string;
  geometry: FieldGeometry | null;
  /** The shape being drawn now, or null when nothing is being drawn. */
  tool: DrawTool | null;
  toolNonce: number;
  focus: MapFocus | null;
  showFootprints: boolean;
  initialCenter: LngLat;
  initialZoom: number;
  onGeometryChange: (geometry: FieldGeometry | null) => void;
}

const GREEN = "#2e5e3a" as HexColor;
const PARCHMENT = "#fbfaf6" as HexColor;

function toGeometry(f: GeoJSONStoreFeatures): FieldGeometry | null {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === "Point") {
    const coords = g.coordinates as number[];
    return { type: "Point", coordinates: [coords[0], coords[1]] };
  }
  if (g.type === "Polygon") {
    const rings = g.coordinates as number[][][];
    return {
      type: "Polygon",
      coordinates: rings.map((ring: number[][]): LngLat[] =>
        ring.map((p: number[]): LngLat => [p[0], p[1]])
      ),
    };
  }
  return null;
}

function toFeature(g: FieldGeometry): GeoJSONStoreFeatures {
  return {
    id: crypto.randomUUID(),
    type: "Feature",
    geometry: g,
    properties: { mode: g.type === "Point" ? "point" : "polygon" },
  } as GeoJSONStoreFeatures;
}

const boxRing = (b: Box): LngLat[] => [
  [b.west, b.south],
  [b.east, b.south],
  [b.east, b.north],
  [b.west, b.north],
  [b.west, b.south],
];

/** The Mapbox satellite map where a field is boxed or outlined. Point mode remains for older saved fields. */
export function FieldMap({
  boundaries, selectedTownship,
  token,
  geometry,
  tool,
  toolNonce,
  focus,
  showFootprints,
  initialCenter,
  initialZoom,
  onGeometryChange,
}: FieldMapProps) {
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const lastEmitted = useRef("null");
  const onChangeRef = useRef(onGeometryChange);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onGeometryChange;
  });

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || drawRef.current) return;

    const polygonStyles = {
      fillColor: GREEN,
      fillOpacity: 0.3,
      outlineColor: PARCHMENT,
      outlineWidth: 3,
    };
    const draw = new TerraDraw({
      adapter: new TerraDrawMapboxGLAdapter({ map }),
      modes: [
        new TerraDrawPointMode({
          styles: { pointColor: GREEN, pointWidth: 9, pointOutlineColor: PARCHMENT, pointOutlineWidth: 3 },
        }),
        new TerraDrawRectangleMode({ styles: polygonStyles }),
        new TerraDrawPolygonMode({ styles: { ...polygonStyles, closingPointColor: PARCHMENT, closingPointWidth: 7 } }),
        new TerraDrawSelectMode({
          styles: {
            selectedPointColor: GREEN,
            selectedPointWidth: 11,
            selectedPointOutlineColor: PARCHMENT,
            selectedPointOutlineWidth: 3,
            selectedPolygonColor: GREEN,
            selectedPolygonFillOpacity: 0.3,
            selectedPolygonOutlineColor: PARCHMENT,
            selectedPolygonOutlineWidth: 3,
            selectionPointColor: PARCHMENT,
            selectionPointWidth: 6,
            selectionPointOutlineColor: GREEN,
            selectionPointOutlineWidth: 2,
            midPointColor: GREEN,
            midPointOutlineColor: PARCHMENT,
          },
          flags: {
            point: { feature: { draggable: true } },
            rectangle: { feature: { draggable: true, coordinates: { resizable: "opposite" } } },
            polygon: {
              feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } },
            },
          },
        }),
      ],
    });
    draw.start();

    // Only one shape at a time. A new one replaces the old when it is finished,
    // so tapping a tool by mistake never throws the current shape away.
    draw.on("finish", (id, context) => {
      const shapes = draw.getSnapshot().filter((f) => SHAPE_MODES.has(String(f.properties.mode)));
      const finished = shapes.find((f) => f.id === id);
      if (!finished) return;
      const others = shapes.filter((f) => f.id !== id).map((f) => f.id as string);
      if (others.length) draw.removeFeatures(others);
      const g = toGeometry(finished);
      if (!g) return;
      lastEmitted.current = JSON.stringify(g);
      onChangeRef.current(g);
      if (context.mode !== "select") {
        draw.setMode("select");
        draw.selectFeature(id);
      }
    });

    drawRef.current = draw;
    setReady(true);
  }, []);

  useEffect(() => {
    return () => {
      const draw = drawRef.current;
      drawRef.current = null;
      if (draw?.enabled) draw.stop();
    };
  }, []);

  // Keep the drawn shape in step with the geometry the form holds (typed coordinates, Clear, edit mode).
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || !ready) return;
    const key = JSON.stringify(geometry);
    if (key === lastEmitted.current) return;
    lastEmitted.current = key;
    draw.clear();
    if (geometry) {
      const feature = toFeature(geometry);
      draw.addFeatures([feature]);
      draw.setMode("select");
      draw.selectFeature(feature.id as string);
    }
  }, [geometry, ready]);

  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || !ready || !tool) return;
    draw.setMode(MODE_FOR_TOOL[tool]);
  }, [tool, toolNonce, ready]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !focus) return;
    if (focus.bbox) {
      const [w, s, e, n] = focus.bbox;
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 48, duration: 1200, maxZoom: 17 },
      );
    } else {
      map.flyTo({ center: focus.center, zoom: focus.zoom ?? 15, duration: 1200 });
    }
  }, [focus, ready]);

  const footprints = useMemo(() => {
    if (!showFootprints || !geometry) return null;
    const c = centroid(geometry);
    const modis = footprintBox("modis", c);
    const smap = footprintBox("smap", c);
    const boxes: Array<[string, Box, string]> = [
      ["modis", modis, "Crop greenness pixel, about 250 m"],
      ["smap", smap, "Soil moisture pixel, about 9 km"],
    ];
    return {
      type: "FeatureCollection" as const,
      features: boxes.flatMap(([kind, box, label]) => [
        { type: "Feature" as const, properties: { kind }, geometry: { type: "Polygon" as const, coordinates: [boxRing(box)] } },
        {
          type: "Feature" as const,
          properties: { kind: "label", label },
          geometry: { type: "Point" as const, coordinates: [(box.west + box.east) / 2, box.north] },
        },
      ]),
    };
  }, [geometry, showFootprints]);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={token}
      mapStyle={MAPBOX_STYLE}
      initialViewState={{ longitude: initialCenter[0], latitude: initialCenter[1], zoom: initialZoom }}
      onLoad={handleLoad}
      style={{ width: "100%", height: "100%" }}
      attributionControl
    >
      {boundaries ? <Source id="study-townships" type="geojson" data={boundaries}>
        <Layer id="township-context" type="line" paint={{ "line-color": "#fbfaf6", "line-width": 1.5, "line-opacity": 0.7 }} />
        <Layer id="township-selected-fill" type="fill" filter={["==", ["get", "TS_PCODE"], selectedTownship ?? ""]} paint={{ "fill-color": "#2e5e3a", "fill-opacity": 0.15 }} />
        <Layer id="township-selected-line" type="line" filter={["==", ["get", "TS_PCODE"], selectedTownship ?? ""]} paint={{ "line-color": "#fbfaf6", "line-width": 4 }} />
      </Source> : null}
      {footprints ? (
        <Source id="satellite-footprints" type="geojson" data={footprints}>
          <Layer id="fp-modis" type="line" filter={["==", ["get", "kind"], "modis"]} paint={{ "line-color": "#fbfaf6", "line-width": 2 }} />
          <Layer
            id="fp-smap"
            type="line"
            filter={["==", ["get", "kind"], "smap"]}
            paint={{ "line-color": "#fbfaf6", "line-width": 2, "line-dasharray": [2, 2] }}
          />
          <Layer
            id="fp-labels"
            type="symbol"
            filter={["==", ["get", "kind"], "label"]}
            layout={{ "text-field": ["get", "label"], "text-size": 12, "text-anchor": "bottom", "text-offset": [0, -0.3] }}
            paint={{ "text-color": "#fbfaf6", "text-halo-color": "#1f1d17", "text-halo-width": 1.5 }}
          />
        </Source>
      ) : null}
    </Map>
  );
}
