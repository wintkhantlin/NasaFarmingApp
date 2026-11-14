"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { DrawTool, MapFocus } from "@/components/map/field-map";
import { MAPBOX_TOKEN, MAPBOX_TOKEN_PROBLEM } from "@/components/map/mapbox-config";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button, IconButton, Pressable } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { parseCoordinate } from "@/lib/geo/format";
import { searchPlaces, type Place } from "@/lib/geo/geocode";
import { acresFromHa, areaHa, isSelfIntersecting } from "@/lib/geo/shapes";
import { useFieldsStore } from "@/lib/store/fields-store";
import { LARGE_FIELD_HA, ValidationError } from "@/lib/store/repository";
import type { Field, FieldGeometry } from "@/lib/types";

const FieldMap = dynamic(() => import("@/components/map/field-map").then((m) => m.FieldMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

const TOOLS: Array<{ id: DrawTool; label: string; hint: string }> = [
  { id: "box", label: "Draw a box", hint: "Drag from one corner of the field to the opposite corner." },
  { id: "outline", label: "Trace outline", hint: "Tap each corner of the field, then tap the first corner to finish." },
];

const inputClass =
  "min-h-tap w-full rounded-sm border border-line-strong bg-surface-sunken px-3 text-body text-ink placeholder:text-ink-muted";

function ToolTile({
  icon,
  label,
  selected,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  selected?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      aria-pressed={selected === undefined ? undefined : selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md text-source font-medium transition-[background-color,transform] active:scale-95 disabled:opacity-50",
        selected ? "bg-field text-on-field" : "text-ink hover:bg-surface-sunken active:bg-surface-sunken",
      )}
    >
      <Icon name={icon} size={22} />
      {label}
    </Pressable>
  );
}

const card = "pointer-events-auto rounded-lg border border-line bg-surface-raised shadow-float";

const fmtHa = (ha: number) => (ha < 10 ? ha.toFixed(2) : ha < 100 ? ha.toFixed(1) : String(Math.round(ha)));

/**
 * Step 1 of a field: where it is. A full-screen satellite map with the
 * controls floating on top: search, a box or an outline, then a short
 * second step to name the field. Two corner coordinates work without a map.
 */
export function LocationPicker({ field }: { field?: Field }) {
  const router = useRouter();
  const add = useFieldsStore((s) => s.add);
  const update = useFieldsStore((s) => s.update);
  const id = useId();
  const hasMap = Boolean(MAPBOX_TOKEN);
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);

  const fieldCount = useFieldsStore((s) => s.fields.length);
  const [name, setName] = useState(field?.name ?? "");
  const [geometry, setGeometry] = useState<FieldGeometry | null>(field?.geometry.type === "Polygon" ? field.geometry : null);
  const [tool, setTool] = useState<DrawTool | null>(field?.geometry.type === "Polygon" || !hasMap ? null : "box");
  const [toolNonce, setToolNonce] = useState(0);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [coordsOpen, setCoordsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

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
  const activeHint = TOOLS.find((t) => t.id === tool)?.hint;
  const canContinue = geometry?.type === "Polygon" && !crosses && ha !== null && ha > 0;

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

  function flyTo(center: [number, number], zoom = 15, bbox?: [number, number, number, number]) {
    setFocus((prev) => ({ center, zoom, bbox, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  function chooseTool(next: DrawTool) {
    setTool(next);
    setToolNonce((n) => n + 1);
    setLocateError(null);
  }

  function onGeometry(g: FieldGeometry | null) {
    setGeometry(g);
    setTool(null);
    setSaveError(null);
  }

  function goBack() {
    router.push(field ? `/fields/${field.id}` : "/");
  }

  async function onSearch() {
    if (query.trim().length < 2) return;
    searchAbort.current?.abort();
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchPlaces(query, MAPBOX_TOKEN, ctrl.signal));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setResults(null);
      setSearchError("We couldn't search just now. Try a nearby town or enter the field's corner coordinates.");
    } finally {
      if (searchAbort.current === ctrl) setSearching(false);
    }
  }

  function pickPlace(p: Place) {
    setResults(null);
    setQuery(p.name);
    flyTo(p.center, 14, p.bbox ?? undefined);
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setLocateError("This browser can't share your location. Search for your place instead.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        flyTo([pos.coords.longitude, pos.coords.latitude], 16);
      },
      () => {
        setLocating(false);
        setLocateError("We couldn't get your location. Search for your place, or enter coordinates.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function placeFromCoordinates(e: FormEvent) {
    e.preventDefault();
    const southLat = parseCoordinate(south, 90);
    const westLng = parseCoordinate(west, 180);
    const northLat = parseCoordinate(north, 90);
    const eastLng = parseCoordinate(east, 180);
    if (southLat === null || westLng === null || northLat === null || eastLng === null || southLat >= northLat || westLng >= eastLng) {
      setCoordError("Enter two opposite corners. North must be above south, and east must be right of west.");
      return;
    }
    setCoordError(null);
    setSaveError(null);
    setGeometry({ type: "Polygon", coordinates: [[
      [westLng, southLat], [eastLng, southLat], [eastLng, northLat], [westLng, northLat], [westLng, southLat],
    ]] });
    setCoordsOpen(false);
    setTool(null);
    flyTo([(westLng + eastLng) / 2, (southLat + northLat) / 2], 15, [westLng, southLat, eastLng, northLat]);
  }

  function clearShape() {
    setGeometry(null);
    setSheetOpen(false);
    if (hasMap) chooseTool("box");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const finalName = name.trim() || `Field ${fieldCount + 1}`;
    if (!geometry || geometry.type !== "Polygon" || !canContinue) return setSaveError("Draw a box or trace the field outline before saving.");
    if (crosses) return setSaveError(copy.validation.outlineCrosses);
    setSaving(true);
    setSaveError(null);
    try {
      const saved = field
        ? await update(field.id, { name: finalName, geometry, locationConfirmed: true })
        : await add({ name: finalName, geometry, irrigation: "none", locationConfirmed: true });
      router.push(field ? `/fields/${saved.id}` : `/fields/${saved.id}/profile`);
    } catch (err) {
      setSaving(false);
      setSaveError(
        err instanceof ValidationError ? err.message : "We couldn't save this field. Check that this browser allows site storage.",
      );
    }
  }

  const startCenter = field?.centroid ?? ([95.5, 20.5] as [number, number]);

  const status = locateError
    ? locateError
    : activeHint
      ? activeHint
      : geometry
        ? "Drag the shape or its corners to adjust it."
        : hasMap
          ? "Draw a box around your field, or trace its edges."
          : "Enter two opposite corners to make a field box.";

  return (
    <div ref={rootRef} className="relative size-full bg-surface-sunken">
      <h1 className="sr-only">{field ? `Edit ${field.name}` : "Add a field"}</h1>
      {/* The map fills the screen. */}
      <div className="absolute inset-0">
        {hasMap ? (
          <FieldMap
            token={MAPBOX_TOKEN}
            geometry={geometry}
            tool={tool}
            toolNonce={toolNonce}
            focus={focus}
            showFootprints={false}
            initialCenter={startCenter}
            initialZoom={field ? 15 : 5.5}
            onGeometryChange={onGeometry}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center lg:pl-[28rem]">
            <h2 className="text-title text-ink">The map isn&apos;t set up yet</h2>
            <p className="max-w-measure text-body text-ink-muted">
              {MAPBOX_TOKEN_PROBLEM === "secret"
                ? "NEXT_PUBLIC_MAPBOX_TOKEN holds a secret token (it starts with sk.). It would be sent to every visitor, so it is ignored. Use a public token that starts with pk."
                : "Add a public Mapbox token as NEXT_PUBLIC_MAPBOX_TOKEN in .env.local and restart the app. Until then you can still add a field with coordinates."}
            </p>
          </div>
        )}
      </div>

      {/* Controls float over the map: along the top on a phone, down the left side on a desktop. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex max-h-full flex-col gap-2 overflow-y-auto p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] lg:bottom-0 lg:right-auto lg:w-[26rem] lg:gap-3 lg:p-4">
        {/* Back and search */}
        <section aria-label="Find your field" className={card}>
          <div className="flex items-center gap-1 p-1.5">
            <IconButton icon="back" iconSize={24} onClick={goBack} label={field ? `Back to ${field.name}` : "Back to your fields"} sx={{ color: "var(--color-ink)" }} />
            {hasMap ? (
              <>
                <label htmlFor={`${id}-search`} className="sr-only">
                  Search for a village, town or address
                </label>
                <input
                  id={`${id}-search`}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void onSearch();
                    }
                  }}
                  autoComplete="off"
                  enterKeyHint="search"
                  placeholder="Search a village or town"
                  className="min-h-tap min-w-0 flex-1 bg-transparent px-1 text-body text-ink placeholder:text-ink-muted"
                />
                {query ? (
                  <IconButton
                    icon="close"
                    iconSize={18}
                    label="Clear search"
                    onClick={() => {
                      setQuery("");
                      setResults(null);
                    }}
                  />
                ) : null}
                <IconButton
                  icon="search"
                  iconSize={22}
                  tone="field"
                  label={searching ? "Searching" : "Search"}
                  onClick={() => void onSearch()}
                  disabled={searching || query.trim().length < 2}
                />
              </>
            ) : (
              <p className="px-1 text-headline text-ink">{field ? "Edit field" : "Add a field"}</p>
            )}
          </div>
          {searchError ? (
            <p role="alert" className="border-t border-line px-3 py-2 text-body-sm text-heat">
              {searchError}
            </p>
          ) : null}
          {results ? (
            results.length === 0 ? (
              <p role="status" className="border-t border-line px-3 py-2 text-body-sm text-ink-muted">
                No places found. Try the name of a nearby town.
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto border-t border-line">
                {results.map((p) => (
                  <li key={p.id} className="border-b border-line last:border-b-0">
                    <Pressable
                      onClick={() => pickPlace(p)}
                      className="flex min-h-tap w-full flex-col items-start justify-center px-3 py-2 text-left hover:bg-surface-sunken"
                    >
                      <span className="text-label text-ink">{p.name}</span>
                      {p.context ? <span className="text-body-sm text-ink-muted">{p.context}</span> : null}
                    </Pressable>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>

        {/* Two ways to draw an area, with coordinate entry as an alternative. */}
        <section aria-label="Mark your field" className={cn(card, "flex flex-col gap-2 p-1.5")}>
          {hasMap ? (
            <div className="flex flex-col gap-1">
              <div className="grid grid-cols-2 gap-1" role="group" aria-label="Draw a field area">
                {TOOLS.map((t) => (
                  <ToolTile
                    key={t.id}
                    icon={t.id}
                    label={t.label}
                    selected={tool === t.id}
                    onClick={() => chooseTool(t.id)}
                  />
                ))}
              </div>
              <div className="flex gap-2 border-t border-line px-1 pt-1">
                <Button type="button" variant="quiet" icon="locate" onClick={locateMe} disabled={locating}>{locating ? "Finding location" : "Find my area"}</Button>
                <Button type="button" variant="quiet" icon="coordinates" aria-expanded={coordsOpen} onClick={() => setCoordsOpen((v) => !v)}>Use coordinates</Button>
              </div>
            </div>
          ) : null}

          {coordsOpen || !hasMap ? (
            <div className="flex flex-col gap-2 p-1.5">
              <p className="m-0 text-body-sm text-ink-muted">Enter the south-west and north-east corners of the field.</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  id={`${id}-south`}
                  aria-label="South latitude"
                  value={south}
                  onChange={(e) => setSouth(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="South latitude"
                  className={`${inputClass} min-w-0 w-full tabular font-mono`}
                />
                <input
                  id={`${id}-west`}
                  aria-label="West longitude"
                  value={west}
                  onChange={(e) => setWest(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="West longitude"
                  className={`${inputClass} min-w-0 w-full tabular font-mono`}
                />
                <input
                  id={`${id}-north`}
                  aria-label="North latitude"
                  value={north}
                  onChange={(e) => setNorth(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="North latitude"
                  className={`${inputClass} min-w-0 w-full tabular font-mono`}
                />
                <input
                  id={`${id}-east`}
                  aria-label="East longitude"
                  value={east}
                  onChange={(e) => setEast(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="East longitude"
                  className={`${inputClass} min-w-0 w-full tabular font-mono`}
                />
              </div>
              {coordError ? (
                <p role="alert" className="text-body-sm text-heat">
                  {coordError}
                </p>
              ) : null}
              <Button type="button" icon="box" onClick={placeFromCoordinates}>
                Draw box from coordinates
              </Button>
            </div>
          ) : null}
        </section>

        {/* The next step: a bar along the bottom on a phone, the last card in the column on a desktop. */}
        <section
          ref={barRef}
          aria-label="Your field"
          className={cn(
            card,
            "fixed inset-x-0 bottom-0 z-20 flex max-h-[75svh] flex-col gap-3 overflow-y-auto rounded-b-none p-3",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]",
            "lg:static lg:z-auto lg:max-h-none lg:rounded-b-lg lg:p-3",
          )}
        >
          {!sheetOpen ? (
            <>
              <p role="status" className="text-body-sm text-ink-muted">
                {status}
              </p>

              {geometry?.type === "Polygon" ? (
                <p className="flex flex-wrap items-baseline gap-x-4 text-body text-ink">
                  <span>Field area selected</span>
                  <span className="tabular font-mono text-data">
                    {ha === null ? "" : `${fmtHa(ha)} ha · ${fmtHa(acresFromHa(ha))} acres`}
                  </span>
                </p>
              ) : null}

              {ha !== null && ha > LARGE_FIELD_HA ? <p className="text-body-sm text-drought">{copy.validation.fieldTooLarge}</p> : null}
              {crosses ? (
                <p role="alert" className="text-body-sm text-heat">
                  {copy.validation.outlineCrosses}
                </p>
              ) : null}

              <div className="flex items-center gap-2">
                {geometry ? (
                  <Button type="button" variant="secondary" size="lg" onClick={clearShape}>Clear</Button>
                ) : null}
                <Button type="button" variant="primary" size="lg" iconEnd="next" disabled={!canContinue} onClick={() => setSheetOpen(true)} className="flex-1">
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={onSave} noValidate className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-headline text-ink">Name your field</h2>
                <IconButton icon="close" iconSize={22} label="Back to the map" onClick={() => setSheetOpen(false)} className="-mr-2" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-name`} className="text-label text-ink">Field name</label>
                <input
                  id={`${id}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  placeholder={`Field ${fieldCount + 1}`}
                  className={inputClass}
                />
              </div>
              {saveError ? (
                <p role="alert" className="text-body text-heat">
                  {saveError}
                </p>
              ) : null}
              <Button type="submit" variant="primary" size="lg" iconEnd="done" disabled={saving} block>
                {saving ? "Saving" : field ? "Save changes" : "Save field"}
              </Button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
