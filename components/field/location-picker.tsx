"use client";

import { TownshipPicker, type AreaSelection } from "@/components/geospatial-farmer/township-picker";
import { parseTownships, townshipBounds, contextAtPoint, type Townships } from "@/lib/geospatial-farmer/geospatial/townships";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { DrawTool, MapCommand, MapFocus } from "@/components/map/field-map";
import { MAPBOX_TOKEN } from "@/components/map/mapbox-config";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { parseCoordinate } from "@/lib/geo/format";
import { searchPlaces, type Place } from "@/lib/geo/geocode";
import { acresFromHa, areaHa, centroid, isSelfIntersecting } from "@/lib/geo/shapes";
import { useFieldsStore } from "@/lib/store/fields-store";
import { useAppCopy, useLocaleStore } from "@/lib/store/locale-store";
import { readPlanDraft, type PlanDraft } from "@/lib/store/plan-draft";
import { LARGE_FIELD_HA, ValidationError } from "@/lib/store/repository";
import type { Field, FieldGeometry, Irrigation } from "@/lib/types";

const FieldMap = dynamic(() => import("@/components/map/field-map").then((m) => m.FieldMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

type Method = "approx" | "exact";
type Shape = "box" | "outline";
type WaterChoice = "rain-only" | "irrigation-available" | "both";

const SHAPES: Array<{ id: Shape }> = [{ id: "box" }, { id: "outline" }];

const inputClass =
  "min-h-tap w-full rounded-sm border border-line-strong bg-surface-sunken px-3 text-body text-ink placeholder:text-ink-muted";

function MethodCard({
  icon,
  title,
  body,
  onClick,
}: {
  icon: IconName;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-tap w-full items-start gap-3 rounded-md border border-line-strong bg-surface-raised p-3 text-left transition-[background-color,transform] hover:bg-surface-sunken active:scale-[0.99]"
    >
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-field-soft text-field">
        <Icon name={icon} size={22} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-headline text-ink">{title}</span>
        <span className="text-body-sm text-ink-muted">{body}</span>
      </span>
    </button>
  );
}

function ToolButton({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-tap flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-source font-medium text-ink transition-[background-color,transform] hover:bg-surface-sunken active:scale-95 active:bg-surface-sunken disabled:opacity-40 disabled:active:scale-100"
    >
      <Icon name={icon} size={20} />
      <span className="max-w-full truncate text-[11px] leading-tight sm:text-source">{label}</span>
    </button>
  );
}

const card = "pointer-events-auto rounded-lg border border-line bg-surface-raised shadow-float";

const fmtHa = (ha: number) => (ha < 10 ? ha.toFixed(2) : ha < 100 ? ha.toFixed(1) : String(Math.round(ha)));

/**
 * Step 1 of a field: where it is. A full-screen satellite map with the controls
 * floating on top. The farmer first picks one of two ways to mark the field:
 * an approximate pin, or an exact boundary (a box or a traced outline). Then
 * they check a short summary and name the field. Two corner coordinates work
 * without a map. Geometry is still saved as a GeoJSON Point or Polygon in WGS84.
 */
export function LocationPicker({ field, fromPlan = false }: { field?: Field; fromPlan?: boolean }) {
  const router = useRouter();
  const text = useAppCopy().picker;
  const copy = useAppCopy();
  const areaUnit = useLocaleStore((s) => s.areaUnit);
  const add = useFieldsStore((s) => s.add);
  const update = useFieldsStore((s) => s.update);
  const id = useId();
  const hasMap = Boolean(MAPBOX_TOKEN);
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);

  const [boundaries, setBoundaries] = useState<Townships | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [areaSelection, setAreaSelection] = useState<AreaSelection>({ region: field?.administrativeContext?.ST_PCODE ?? "", district: field?.administrativeContext?.DT_PCODE ?? "", township: field?.administrativeContext?.TS_PCODE ?? "" });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/study-area/boundaries", { signal: controller.signal }).then(async (res) => {
      if (!res.ok) throw new Error("Boundaries unavailable");
      return parseTownships(await res.json());
    }).then(setBoundaries).catch(() => {
      if (!controller.signal.aborted) setBoundaryError("Township boundaries are unavailable. Search for your village or mark your field with coordinates.");
    });
    return () => controller.abort();
  }, []);
  function selectArea(next: AreaSelection) {
    setAreaSelection(next);
    if (!boundaries) return;
    const features = boundaries.features.filter(({ properties: p }) => next.township ? p.TS_PCODE === next.township : next.district ? p.DT_PCODE === next.district : next.region ? p.ST_PCODE === next.region : true);
    if (!features.length) return;
    const bbox = townshipBounds({ type: "FeatureCollection", features });
    flyTo([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2], 10, bbox);
  }

  const fieldCount = useFieldsStore((s) => s.fields.length);
  const [name, setName] = useState(field?.name ?? "");
  const [geometry, setGeometry] = useState<FieldGeometry | null>(field?.geometry ?? null);
  const [waterChoice, setWaterChoice] = useState<WaterChoice | null>(() => {
    const access = field?.constraints?.irrigation?.access;
    return access === "none" ? "rain-only" : access === "full" ? "irrigation-available" : access === "supplemental" ? "both" : null;
  });
  const [locationConfirmed, setLocationConfirmed] = useState(field?.locationConfirmed === true);
  const [method, setMethod] = useState<Method | null>(
    field?.geometry ? (field.geometry.type === "Point" ? "approx" : "exact") : fromPlan && hasMap ? "approx" : null,
  );
  const [shape, setShape] = useState<Shape>("box");
  const [tool, setTool] = useState<DrawTool | null>(!field?.geometry && fromPlan && hasMap ? "point" : null);
  const [toolNonce, setToolNonce] = useState(0);
  const [command, setCommand] = useState<MapCommand | null>(null);
  const [canUndoCorner, setCanUndoCorner] = useState(false);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);

  // Shape history, so a slip never costs the farmer their work.
  const [past, setPast] = useState<Array<FieldGeometry | null>>([]);
  const [future, setFuture] = useState<Array<FieldGeometry | null>>([]);

  const [coordsOpen, setCoordsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const skipAutoSearch = useRef(false);

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lon: number; lat: number; accuracy: number } | null>(null);
  const [placeNote, setPlaceNote] = useState<string | null>(null);

  const [south, setSouth] = useState("");
  const [west, setWest] = useState("");
  const [north, setNorth] = useState("");
  const [east, setEast] = useState("");
  const [coordError, setCoordError] = useState<string | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ring = geometry?.type === "Polygon" ? geometry.coordinates[0] : null;
  const crosses = ring ? isSelfIntersecting(ring) : false;
  const ha = geometry ? areaHa(geometry) : null;
  const drawing = tool !== null;
  const canContinue = geometry?.type === "Point" || (geometry?.type === "Polygon" && !crosses && ha !== null && ha > 0);
  const isApprox = geometry?.type === "Point";
  const shapeHint = shape === "box" ? text.boxHint : text.outlineHint;
  const areaText = (value: number) => text.area(fmtHa(areaUnit === "acre" ? acresFromHa(value) : value), areaUnit);

  useEffect(() => {
    if (!fromPlan || field) return;
    const saved = readPlanDraft();
    if (!saved?.place) return;
    skipAutoSearch.current = true;
    setPlanDraft(saved);
    const draftWater = saved.refinements.water.value;
    setWaterChoice(draftWater === "rain-only" ? "rain-only" : draftWater === "reliable" ? "irrigation-available" : draftWater === "occasional" ? "both" : null);
    setQuery(saved.place.name);
    if (saved.place.lon !== undefined && saved.place.lat !== undefined) {
      setFocus({ center: [saved.place.lon, saved.place.lat], zoom: 13, nonce: 1 });
    }
  }, [field, fromPlan]);

  // On a phone the bottom bar sits over the map. Publish its height so the Mapbox
  // logo, attribution and zoom buttons stay visible just above it (see globals.css).
  useEffect(() => {
    const root = rootRef.current;
    const bar = barRef.current;
    if (!root || !bar) return;
    const observer = new ResizeObserver(() => root.style.setProperty("--bar-h", `${bar.offsetHeight}px`));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // Suggest places as the farmer types, after a short pause.
  useEffect(() => {
    if (skipAutoSearch.current) {
      skipAutoSearch.current = false;
      return;
    }
    if (query.trim().length < 3) return;
    const timer = setTimeout(() => void runSearch(query), 450);
    return () => clearTimeout(timer);
  }, [query]);

  function flyTo(center: [number, number], zoom = 15, bbox?: [number, number, number, number]) {
    setFocus((prev) => ({ center, zoom, bbox, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  function send(kind: MapCommand["kind"]) {
    setCommand((prev) => ({ kind, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  function startDrawing(next: DrawTool) {
    setTool(next);
    setToolNonce((n) => n + 1);
    setCanUndoCorner(false);
    setLocateError(null);
    setSaveError(null);
  }

  function chooseMethod(next: Method, nextShape: Shape = shape) {
    setMethod(next);
    setShape(nextShape);
    setPlaceNote(null);
    startDrawing(next === "approx" ? "point" : nextShape);
  }

  /** Every change to the shape goes through here so it can be undone. */
  function commit(next: FieldGeometry | null) {
    if (JSON.stringify(next) === JSON.stringify(geometry)) return;
    setPast((p) => [...p.slice(-49), geometry]);
    setFuture([]);
    setGeometry(next);
    setLocationConfirmed(false);
    setSaveError(null);
  }

  function onGeometry(g: FieldGeometry | null) {
    commit(g);
    setTool(null);
    setCanUndoCorner(false);
    if (g) setMethod(g.type === "Point" ? "approx" : "exact");
  }

  function restore(next: FieldGeometry | null) {
    setGeometry(next);
    if (JSON.stringify(next) !== JSON.stringify(geometry)) setLocationConfirmed(false);
    setSaveError(null);
    if (next) {
      setMethod(next.type === "Point" ? "approx" : "exact");
      setTool(null);
    } else if (method) {
      startDrawing(method === "approx" ? "point" : shape);
    }
  }

  function undo() {
    if (!past.length) return;
    setFuture((f) => [geometry, ...f]);
    setPast(past.slice(0, -1));
    restore(past[past.length - 1]);
  }

  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, geometry]);
    setFuture(future.slice(1));
    restore(future[0]);
  }

  function editShape() {
    setTool(null);
    send("edit");
  }

  function cancelDrawing() {
    setTool(null);
    setCanUndoCorner(false);
    if (!geometry) setMethod(null);
    else setMethod(geometry.type === "Point" ? "approx" : "exact");
    send("edit");
  }

  /** Remove the shape and start drawing it again straight away. */
  function redraw() {
    commit(null);
    setSheetOpen(false);
    chooseMethod(method ?? "exact");
  }

  function goBack() {
    router.push(field ? `/fields/${field.id}` : "/");
  }

  async function runSearch(q: string) {
    if (q.trim().length < 2) return;
    searchAbort.current?.abort();
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchPlaces(q, MAPBOX_TOKEN, ctrl.signal));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setResults(null);
      setSearchError(text.searchError);
    } finally {
      if (searchAbort.current === ctrl) setSearching(false);
    }
  }

  function pickPlace(p: Place) {
    skipAutoSearch.current = true;
    setResults(null);
    setQuery(p.name);
    setPlaceNote(text.placeNote(p.name));
    flyTo(p.center, 14, p.bbox ?? undefined);
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setLocateError(text.locateUnsupported);
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setGps({ lon: pos.coords.longitude, lat: pos.coords.latitude, accuracy: pos.coords.accuracy });
        flyTo([pos.coords.longitude, pos.coords.latitude], 16);
      },
      () => {
        setLocating(false);
        setLocateError(text.locateDenied);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function pinAtGps() {
    if (!gps) return;
    commit({ type: "Point", coordinates: [gps.lon, gps.lat] });
    setMethod("approx");
    setTool(null);
    setGps(null);
  }

  function placeFromCoordinates(e: FormEvent) {
    e.preventDefault();
    const southLat = parseCoordinate(south, 90);
    const westLng = parseCoordinate(west, 180);
    const northLat = parseCoordinate(north, 90);
    const eastLng = parseCoordinate(east, 180);
    if (southLat === null || westLng === null || northLat === null || eastLng === null || southLat >= northLat || westLng >= eastLng) {
      setCoordError(text.coordError);
      return;
    }
    setCoordError(null);
    commit({ type: "Polygon", coordinates: [[
      [westLng, southLat], [eastLng, southLat], [eastLng, northLat], [westLng, northLat], [westLng, southLat],
    ]] });
    setMethod("exact");
    setCoordsOpen(false);
    setTool(null);
    flyTo([(westLng + eastLng) / 2, (southLat + northLat) / 2], 15, [westLng, southLat, eastLng, northLat]);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const finalName = name.trim();
    if (!finalName) return setSaveError(text.nameRequired);
    if (!waterChoice) return setSaveError(text.waterRequired);
    if (!locationConfirmed) return setSaveError(text.confirmRequired);
    if (!geometry || !canContinue) return setSaveError(text.markRequired);
    if (crosses) return setSaveError(copy.validation.outlineCrosses);
    const geometryUnchanged = field && JSON.stringify(field.geometry) === JSON.stringify(geometry);
    const administrativeContext = boundaries
      ? contextAtPoint(boundaries, centroid(geometry))
      : geometryUnchanged
        ? field.administrativeContext
        : undefined;
    if (areaSelection.township && (!boundaries || administrativeContext?.TS_PCODE !== areaSelection.township)) {
      return setSaveError("Your field location is outside the selected township, on its edge, or cannot be matched uniquely. Adjust your field or change the township selection.");
    }
    setSaving(true);
    setSaveError(null);
    try {
      const water = waterChoice === "rain-only" ? "rain-only" : waterChoice === "both" ? "occasional" : "reliable";
      const irrigation: Irrigation = waterChoice === "rain-only" ? "none" : waterChoice === "both" ? "supplemental" : "full";
      const constraints = {
        ...field?.constraints,
        irrigation: { ...field?.constraints?.irrigation, access: irrigation },
      };
      const context = planDraft?.place
        ? `[Explore context]: region ${planDraft.place.region}; place ${planDraft.place.name}; crop ${planDraft.mainCropId}; water ${water}; planting ${planDraft.nextPlantingPeriod}; priorities ${planDraft.priorityOrder.join(",") || "not-set"}. Regional answers, not verified field measurements.`
        : undefined;
      const saved = field
        ? await update(field.id, { name: finalName, geometry, administrativeContext, irrigation, constraints, locationConfirmed: true })
        : await add({ name: finalName, geometry, administrativeContext, irrigation, constraints, locationConfirmed: true, ...(planDraft?.priorityOrder.length ? { priorities: { order: planDraft.priorityOrder, weights: {} } } : {}), ...(context ? { localNotes: context } : {}) });
      router.push(field ? `/fields/${saved.id}` : `/fields/${saved.id}/rotation`);
    } catch (err) {
      setSaving(false);
      setSaveError(err instanceof ValidationError ? err.message : text.saveError);
    }
  }

  const startCenter = field?.centroid ?? ([95.5, 20.5] as [number, number]);
  const corners = ring ? Math.max(0, ring.length - 1) : 0;
  const summaryKind = isApprox ? text.summaryApprox : text.summaryExact;

  return (
    <div ref={rootRef} className="relative size-full bg-surface-sunken">
      <h1 className="sr-only">{field ? text.editTitle(field.name) : text.addTitle}</h1>
      {/* The map fills the screen. */}
      <div className="absolute inset-0">
        {hasMap ? (
          <FieldMap
            boundaries={boundaries}
            selectedTownship={areaSelection.township}
            token={MAPBOX_TOKEN}
            geometry={geometry}
            tool={tool}
            toolNonce={toolNonce}
            focus={focus}
            command={command}
            showFootprints={false}
            initialCenter={startCenter}
            initialZoom={field ? 15 : 5.5}
            onGeometryChange={onGeometry}
            onDrawingChange={(d) => setCanUndoCorner(d.canUndoCorner)}
          />
        ) : (
          <div role="status" className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center lg:pl-[28rem]">
            <p className="max-w-measure text-title text-ink">{text.mapDown}</p>
            <Button type="button" variant="secondary" icon="reset" onClick={() => window.location.reload()}>
              {text.retry}
            </Button>
          </div>
        )}
      </div>

      {/* Controls float over the map: along the top on a phone, down the left side on a desktop. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex max-h-full flex-col gap-2 overflow-y-auto p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] lg:bottom-0 lg:right-auto lg:w-[26rem] lg:gap-3 lg:p-4">
        {/* Back, search and the optional "use my location" */}
        <section aria-label={text.findField} className={card}>
          <div className="flex items-center gap-1 p-1.5">
            <button
              type="button"
              onClick={goBack}
              aria-label={field ? text.backToField(field.name) : text.backToFields}
              className="grid size-tap shrink-0 place-items-center rounded-md text-ink hover:bg-surface-sunken"
            >
              <Icon name="back" size={24} />
            </button>
            {hasMap ? (
              <>
                <label htmlFor={`${id}-search`} className="sr-only">
                  {text.searchLabel}
                </label>
                <input
                  id={`${id}-search`}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (e.target.value.trim().length < 3) setResults(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void runSearch(query);
                    }
                  }}
                  autoComplete="off"
                  enterKeyHint="search"
                  placeholder={text.searchPlaceholder}
                  className="min-h-tap min-w-0 flex-1 bg-transparent px-1 text-body text-ink placeholder:text-ink-muted"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label={text.clearSearch}
                    onClick={() => {
                      setQuery("");
                      setResults(null);
                      setPlaceNote(null);
                    }}
                    className="grid size-tap shrink-0 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken"
                  >
                    <Icon name="close" size={18} />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={searching ? text.searching : text.search}
                  onClick={() => void runSearch(query)}
                  disabled={searching || query.trim().length < 2}
                  className="grid size-tap shrink-0 place-items-center rounded-md text-field hover:bg-field-soft disabled:opacity-40"
                >
                  <Icon name="search" size={22} />
                </button>
                <button
                  type="button"
                  aria-label={locating ? text.findingLocation : text.useMyLocation}
                  title={text.useMyLocation}
                  onClick={locateMe}
                  disabled={locating}
                  className="grid size-tap shrink-0 place-items-center rounded-md text-field hover:bg-field-soft disabled:opacity-40"
                >
                  <Icon name="locate" size={22} />
                </button>
              </>
            ) : (
              <p className="px-1 text-headline text-ink">{field ? text.editShort : text.addTitle}</p>
            )}
          </div>
          {searchError ? (
            <p role="alert" className="border-t border-line px-3 py-2 text-body-sm text-heat">
              {searchError}
            </p>
          ) : null}
          {locateError ? (
            <p role="alert" className="border-t border-line px-3 py-2 text-body-sm text-heat">
              {locateError}
            </p>
          ) : null}
          {gps ? (
            <div role="status" className="flex flex-col gap-1.5 border-t border-line px-3 py-2">
              <p className="text-body-sm text-ink-muted">
                {text.mapMoved(Math.max(1, Math.round(gps.accuracy)))}
                {gps.accuracy > 100 ? text.gpsRough : ""}
              </p>
              {method === "approx" && !geometry ? (
                <Button type="button" variant="secondary" icon="pin" onClick={pinAtGps}>
                  {text.markHere}
                </Button>
              ) : null}
            </div>
          ) : null}
          {results ? (
            results.length === 0 ? (
              <p role="status" className="border-t border-line px-3 py-2 text-body-sm text-ink-muted">
                {text.noPlaces}
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto border-t border-line">
                {results.map((p) => (
                  <li key={p.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => pickPlace(p)}
                      className="flex min-h-tap w-full flex-col items-start justify-center px-3 py-2 text-left hover:bg-surface-sunken"
                    >
                      <span className="text-label text-ink">{p.name}</span>
                      {p.context ? <span className="text-body-sm text-ink-muted">{p.context}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
          {placeNote ? (
            <p role="status" className="border-t border-line px-3 py-2 text-body-sm text-ink-muted">
              {placeNote}
            </p>
          ) : null}
        </section>

        <TownshipPicker data={boundaries} selection={areaSelection} onChange={selectArea} error={boundaryError} />

        {/* The step panel: a bar along the bottom on a phone, the next card in the column on a desktop. */}
        <section
          ref={barRef}
          aria-label={text.yourField}
          className={cn(
            card,
            "fixed inset-x-0 bottom-0 z-20 flex max-h-[75svh] flex-col gap-3 overflow-y-auto rounded-b-none p-3",
            "pb-[calc(0.75rem+env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]",
            "lg:static lg:z-auto lg:max-h-none lg:rounded-b-lg lg:p-3 lg:pb-3",
          )}
        >
          {sheetOpen ? (
            <form onSubmit={onSave} noValidate className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-headline text-ink">{text.nameYourField}</h2>
                <button
                  type="button"
                  aria-label={text.backToMap}
                  onClick={() => setSheetOpen(false)}
                  className="-mr-2 grid size-tap place-items-center rounded-md text-ink-muted hover:bg-surface-sunken"
                >
                  <Icon name="close" size={22} />
                </button>
              </div>
              <p className="rounded-md bg-surface-sunken px-3 py-2 text-body-sm text-ink">
                <span className="font-medium">{summaryKind}</span>
                {ha !== null ? ` · ${areaText(ha)}` : ` · ${text.noAreaMeasured}`}
              </p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-name`} className="text-label text-ink">{text.fieldName}</label>
                <input
                  id={`${id}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  required
                  placeholder={text.fieldPlaceholder(fieldCount + 1)}
                  className={inputClass}
                />
              </div>
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="text-label text-ink">{text.waterLegend}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ["rain-only", text.waterRain],
                    ["irrigation-available", text.waterIrrigation],
                    ["both", text.waterBoth],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={waterChoice === value}
                      onClick={() => setWaterChoice(value)}
                      className={cn(
                        "flex min-h-tap items-center rounded-md border px-3 py-2 text-left text-label font-semibold",
                        waterChoice === value ? "border-field bg-field-soft text-ink ring-2 ring-field/30" : "border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="flex min-h-tap items-start gap-3 rounded-md border border-line p-3 text-body-sm text-ink">
                <input
                  type="checkbox"
                  checked={locationConfirmed}
                  onChange={(e) => setLocationConfirmed(e.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-field"
                />
                <span>{isApprox ? text.confirmSpot : text.confirmShape}</span>
              </label>
              {saveError ? (
                <p role="alert" className="text-body text-heat">
                  {saveError}
                </p>
              ) : null}
              <Button type="submit" variant="primary" size="lg" iconEnd="done" disabled={saving} block>
                {saving ? text.saving : field ? text.saveChanges : text.saveField}
              </Button>
            </form>
          ) : drawing ? (
            /* Drawing now: one short instruction and the way out. */
            <>
              {method === "exact" ? (
                <div className="grid grid-cols-2 gap-1" role="group" aria-label={text.shapeGroup}>
                  {SHAPES.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      aria-pressed={shape === x.id}
                      onClick={() => chooseMethod("exact", x.id)}
                      className={cn(
                        "flex min-h-tap items-center justify-center gap-2 rounded-md text-label transition-colors",
                        shape === x.id ? "bg-field text-on-field" : "text-ink hover:bg-surface-sunken",
                      )}
                    >
                      <Icon name={x.id} size={18} />
                      {x.id === "box" ? text.boxLabel : text.outlineLabel}
                    </button>
                  ))}
                </div>
              ) : null}
              <p role="status" className="text-body text-ink">
                {method === "approx" ? text.spotHint : shapeHint}
              </p>
              {method === "approx" ? <p className="text-body-sm text-ink-muted">{text.spotLimits}</p> : null}
              <div className="flex flex-wrap items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-initial">
                {method === "exact" && shape === "outline" ? (
                  <Button type="button" variant="secondary" icon="undo" onClick={() => send("undo-corner")} disabled={!canUndoCorner}>
                    {text.undoCorner}
                  </Button>
                ) : null}
                <Button type="button" variant="quiet" onClick={cancelDrawing}>
                  {geometry ? text.keepShape : text.back}
                </Button>
              </div>
            </>
          ) : geometry ? (
            /* Boundary confirmation summary, with ways to correct it. */
            <>
              <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-sunken p-3">
                <p className="flex items-center gap-2 text-label text-ink">
                  <Icon name={isApprox ? "pin" : "outline"} size={18} />
                  {summaryKind}
                </p>
                {isApprox ? (
                  <>
                    <p className="tabular font-mono text-data text-ink">
                      {geometry.coordinates[1].toFixed(4)}, {geometry.coordinates[0].toFixed(4)}
                    </p>
                    <p className="text-body-sm text-ink-muted">{text.spotLimits}</p>
                  </>
                ) : (
                  <>
                    <p className="tabular font-mono text-data text-ink">
                      {ha === null ? text.areaUnavailable : areaText(ha)}
                    </p>
                    <p className="text-body-sm text-ink-muted">
                      {text.corners(corners)}
                    </p>
                  </>
                )}
              </div>

              {ha !== null && ha > LARGE_FIELD_HA ? <p className="text-body-sm text-drought">{copy.validation.fieldTooLarge}</p> : null}
              {crosses ? (
                <p role="alert" className="text-body-sm text-heat">
                  {copy.validation.outlineCrosses}
                </p>
              ) : null}

              {isApprox ? (
                <Button type="button" variant="secondary" icon="outline" onClick={() => chooseMethod("exact")}>
                  {text.tapCornersInstead}
                </Button>
              ) : null}

              <div className="grid grid-cols-4 gap-1 border-y border-line py-1" role="group" aria-label={text.correctGroup}>
                <ToolButton icon="undo" label={text.undo} onClick={undo} disabled={!past.length} />
                <ToolButton icon="redo" label={text.redo} onClick={redo} disabled={!future.length} />
                <ToolButton icon="edit" label={text.edit} onClick={editShape} />
                <ToolButton icon="reset" label={text.redraw} onClick={redraw} />
              </div>

              <Button type="button" variant="primary" size="lg" iconEnd="next" disabled={!canContinue} onClick={() => setSheetOpen(true)} block>
                {isApprox ? text.useThisSpot : text.confirmBoundary}
              </Button>
            </>
          ) : (
            /* Nothing marked yet: the two ways in. */
            <>
              {hasMap ? (
                <>
                  <h2 className="text-headline text-ink">{text.methodTitle}</h2>
                  <div className="flex flex-col gap-2">
                    <MethodCard
                      icon="pin"
                      title={text.spotTitle}
                      body={text.spotBody}
                      onClick={() => chooseMethod("approx")}
                    />
                    <MethodCard
                      icon="outline"
                      title={text.edgesTitle}
                      body={text.edgesBody}
                      onClick={() => chooseMethod("exact")}
                    />
                  </div>
                </>
              ) : null}
              {hasMap ? (
                <Button type="button" variant="quiet" icon="coordinates" aria-expanded={coordsOpen} onClick={() => setCoordsOpen((v) => !v)}>
                  {text.advanced}
                </Button>
              ) : null}
              {coordsOpen || !hasMap ? (
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-body-sm text-ink-muted">{text.coordsIntro}</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                    {[
                      [text.south, south, setSouth, "south"],
                      [text.west, west, setWest, "west"],
                      [text.north, north, setNorth, "north"],
                      [text.east, east, setEast, "east"],
                    ].map(([label, value, set, key]) => (
                      <input
                        key={key as string}
                        id={`${id}-${key as string}`}
                        aria-label={label as string}
                        value={value as string}
                        onChange={(e) => (set as (v: string) => void)(e.target.value)}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder={label as string}
                        className={`${inputClass} min-w-0 w-full tabular font-mono`}
                      />
                    ))}
                  </div>
                  {coordError ? (
                    <p role="alert" className="text-body-sm text-heat">
                      {coordError}
                    </p>
                  ) : null}
                  <Button type="button" icon="box" onClick={placeFromCoordinates}>
                    {text.drawFromCoords}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
