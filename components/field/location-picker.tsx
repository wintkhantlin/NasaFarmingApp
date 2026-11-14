"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { DrawTool, MapFocus } from "@/components/map/field-map";
import { MAPBOX_TOKEN, MAPBOX_TOKEN_PROBLEM } from "@/components/map/mapbox-config";
import { Button } from "@/components/ui/button";
import { ArrowLeftGlyph } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { checkRegion, REGIONS } from "@/lib/data/regions";
import { parseCoordinate } from "@/lib/geo/format";
import { searchPlaces, type Place } from "@/lib/geo/geocode";
import { acresFromHa, areaHa, centroid, isSelfIntersecting } from "@/lib/geo/shapes";
import { useFieldsStore } from "@/lib/store/fields-store";
import { LARGE_FIELD_HA, ValidationError } from "@/lib/store/repository";
import type { Field, FieldGeometry, Irrigation } from "@/lib/types";

const FieldMap = dynamic(() => import("@/components/map/field-map").then((m) => m.FieldMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

const IRRIGATION_OPTIONS = (Object.keys(copy.irrigation) as Irrigation[]).map((value) => ({
  value,
  label: copy.irrigation[value],
}));

const TOOLS: Array<{ id: DrawTool; label: string; hint: string }> = [
  { id: "pin", label: "Pin", hint: "Tap the map where your field is." },
  { id: "box", label: "Box", hint: "Tap one corner of your field, then the opposite corner." },
  { id: "outline", label: "Outline", hint: "Tap each corner of your field. Tap the first corner again to finish." },
];

const inputClass =
  "min-h-tap w-full rounded-sm border border-line-strong bg-surface-sunken px-3 text-body text-ink placeholder:text-ink-muted";

const card = "pointer-events-auto rounded-lg border border-line bg-surface-raised shadow-float";

const fmtHa = (ha: number) => (ha < 10 ? ha.toFixed(2) : ha < 100 ? ha.toFixed(1) : String(Math.round(ha)));

/**
 * Step 1 of a field: where it is. A full-screen satellite map with the
 * controls floating on top: search, a pin, a box or an outline, then a short
 * second step to name the field. Typed coordinates work without a map.
 */
export function LocationPicker({ field }: { field?: Field }) {
  const router = useRouter();
  const add = useFieldsStore((s) => s.add);
  const update = useFieldsStore((s) => s.update);
  const id = useId();
  const hasMap = Boolean(MAPBOX_TOKEN);
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);

  const [name, setName] = useState(field?.name ?? "");
  const [irrigation, setIrrigation] = useState<Irrigation>(field?.irrigation ?? "none");
  const [geometry, setGeometry] = useState<FieldGeometry | null>(field?.geometry ?? null);
  const [tool, setTool] = useState<DrawTool | null>(field || !hasMap ? null : "pin");
  const [toolNonce, setToolNonce] = useState(0);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [showFootprints, setShowFootprints] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [coordError, setCoordError] = useState<string | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmedField, setConfirmedField] = useState(false);

  const ring = geometry?.type === "Polygon" ? geometry.coordinates[0] : null;
  const crosses = ring ? isSelfIntersecting(ring) : false;
  const ha = geometry ? areaHa(geometry) : null;
  const activeHint = TOOLS.find((t) => t.id === tool)?.hint;
  const canContinue = Boolean(geometry) && !crosses;
  const regionCheck = geometry ? checkRegion(geometry, centroid(geometry)) : null;

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
      setSearchError("We couldn't search just now. Check your connection, or drop a pin on the map instead.");
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
    const latitude = parseCoordinate(lat, 90);
    const longitude = parseCoordinate(lon, 180);
    if (latitude === null || longitude === null) {
      setCoordError("Enter a latitude from -90 to 90 and a longitude from -180 to 180, like 42.03 and -93.62.");
      return;
    }
    setCoordError(null);
    setSaveError(null);
    setGeometry({ type: "Point", coordinates: [longitude, latitude] });
    setTool(null);
    flyTo([longitude, latitude], 16);
  }

  function clearShape() {
    setGeometry(null);
    setShowFootprints(false);
    setSheetOpen(false);
    if (hasMap) chooseTool("pin");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setSaveError(copy.validation.nameRequired);
    if (!geometry) return setSaveError("Mark your field first: drop a pin, draw a box or trace the outline.");
    if (crosses) return setSaveError(copy.validation.outlineCrosses);
    if (!confirmedField) return setSaveError(copy.region.confirmBody);
    setSaving(true);
    setSaveError(null);
    try {
      const saved = field
        ? await update(field.id, { name, geometry, irrigation, locationConfirmed: true })
        : await add({ name, geometry, irrigation, locationConfirmed: true });
      router.push(`/fields/${saved.id}`);
    } catch (err) {
      setSaving(false);
      setSaveError(
        err instanceof ValidationError ? err.message : "We couldn't save this field. Check that this browser allows site storage.",
      );
    }
  }

  const c = geometry ? centroid(geometry) : null;
  const startCenter = field?.centroid ?? ([20, 15] as [number, number]);

  const status = locateError
    ? locateError
    : activeHint
      ? activeHint
      : geometry
        ? "Drag the shape or its corners to adjust it."
        : hasMap
          ? "Choose how to mark your field."
          : "Enter your field's coordinates to place it.";

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
            showFootprints={showFootprints}
            initialCenter={startCenter}
            initialZoom={field ? 15 : 1.8}
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
            <button
              type="button"
              onClick={goBack}
              aria-label={field ? `Back to ${field.name}` : "Back to your fields"}
              className="grid size-tap shrink-0 place-items-center rounded-md text-ink hover:bg-surface-sunken"
            >
              <ArrowLeftGlyph width={20} height={20} />
            </button>
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
                  placeholder="Search for a village or town"
                  className="min-h-tap min-w-0 flex-1 bg-transparent px-1 text-body text-ink placeholder:text-ink-muted"
                />
                <Button type="button" variant="quiet" onClick={() => void onSearch()} disabled={searching || query.trim().length < 2}>
                  {searching ? "Searching" : "Search"}
                </Button>
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
        </section>

        {/* Mark it */}
        <section aria-label="Mark your field" className={cn(card, "flex flex-col gap-2 p-2")}>
          {hasMap ? (
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="How to mark your field">
              {TOOLS.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  variant={tool === t.id ? "primary" : "secondary"}
                  aria-pressed={tool === t.id}
                  onClick={() => chooseTool(t.id)}
                  className="px-1 whitespace-nowrap"
                >
                  {t.label}
                </Button>
              ))}
              <Button type="button" variant="secondary" onClick={locateMe} disabled={locating} className="px-1 whitespace-nowrap">
                {locating ? "Finding" : "Locate me"}
              </Button>
            </div>
          ) : null}

          <details open={!hasMap || undefined} className="rounded-md">
            <summary className="min-h-tap cursor-pointer content-center px-2 text-label text-ink">Enter coordinates instead</summary>
            <div className="flex flex-col gap-3 p-2">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <label htmlFor={`${id}-lat`} className="text-label text-ink">
                    Latitude
                  </label>
                  <input
                    id={`${id}-lat`}
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 20.15"
                    className={`${inputClass} min-w-0 w-full tabular font-mono`}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label htmlFor={`${id}-lon`} className="text-label text-ink">
                    Longitude
                  </label>
                  <input
                    id={`${id}-lon`}
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 94.95"
                    className={`${inputClass} min-w-0 w-full tabular font-mono`}
                  />
                </div>
              </div>
              {coordError ? (
                <p role="alert" className="text-body-sm text-heat">
                  {coordError}
                </p>
              ) : null}
              {!hasMap ? (
                <p className="text-body-sm text-ink-muted">You can find coordinates by pressing and holding on your field in a maps app.</p>
              ) : null}
              <div>
                <Button type="button" onClick={placeFromCoordinates}>
                  Place pin here
                </Button>
              </div>
            </div>
          </details>
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

              {geometry ? (
                <p className="flex flex-wrap items-baseline gap-x-4 text-body text-ink">
                  <span>{geometry.type === "Point" ? "A pin" : "A field outline"}</span>
                  <span className="tabular font-mono text-data">
                    {ha === null ? "Area not set" : `${fmtHa(ha)} ha, ${fmtHa(acresFromHa(ha))} acres`}
                  </span>
                </p>
              ) : null}

              {ha !== null && ha > LARGE_FIELD_HA ? <p className="text-body-sm text-drought">{copy.validation.fieldTooLarge}</p> : null}
              {crosses ? (
                <p role="alert" className="text-body-sm text-heat">
                  {copy.validation.outlineCrosses}
                </p>
              ) : null}

              {hasMap && geometry ? (
                <details>
                  <summary className="min-h-tap cursor-pointer content-center text-label text-ink">More options</summary>
                  <div className="flex flex-col gap-2 pb-1">
                    {geometry.type === "Point" ? (
                      <p className="text-body-sm text-ink-muted">A pin has no area. Trace the outline for more exact soil and weather figures.</p>
                    ) : null}
                    <label className="flex min-h-tap cursor-pointer items-center gap-2 text-body-sm text-ink">
                      <input
                        type="checkbox"
                        checked={showFootprints}
                        onChange={(e) => {
                          setShowFootprints(e.target.checked);
                          if (e.target.checked && c) flyTo(c, 11);
                        }}
                        className="size-5 accent-[var(--color-field)]"
                      />
                      Show what each satellite sees
                    </label>
                    {showFootprints ? (
                      <p className="text-body-sm text-ink-muted">
                        Solid box: one pixel of crop-greenness data, about 250 m. Dashed box: one pixel of satellite soil moisture, about 9 km. Fields smaller than a box share its reading.
                      </p>
                    ) : null}
                  </div>
                </details>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" disabled={!canContinue} onClick={() => setSheetOpen(true)}>
                  Continue
                </Button>
                {geometry ? (
                  <Button type="button" variant="quiet" onClick={clearShape}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <form onSubmit={onSave} noValidate className="flex flex-col gap-4">
              <h2 className="text-headline text-ink">Name your field</h2>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-name`} className="text-label text-ink">
                  Field name
                </label>
                <input
                  id={`${id}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  autoFocus
                  placeholder="e.g. South plot"
                  className={inputClass}
                />
              </div>
              <Segmented legend="Water for your crops" value={irrigation} onChange={setIrrigation} options={IRRIGATION_OPTIONS} />
              {regionCheck ? (
                <div className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3 text-body-sm">
                  {regionCheck.region === "unsupported" ? (
                    <>
                      <p className="m-0 text-label text-ink">{copy.region.unsupportedTitle}</p>
                      <p className="m-0 text-ink-muted">{copy.region.unsupportedBody}</p>
                    </>
                  ) : (
                    <p className="m-0 text-ink">{copy.region.detected(REGIONS[regionCheck.region].name)}</p>
                  )}
                  {regionCheck.straddlesBoundary ? <p className="m-0 text-ink-muted">{copy.region.straddles}</p> : null}
                </div>
              ) : null}
              <label className="flex min-h-tap items-start gap-3 text-body text-ink">
                <input
                  type="checkbox"
                  checked={confirmedField}
                  onChange={(e) => setConfirmedField(e.target.checked)}
                  className="mt-1 size-5 accent-[var(--color-field)]"
                />
                <span>
                  <span className="block text-label">{copy.region.confirmButton}</span>
                  <span className="block text-body-sm text-ink-muted">{copy.region.confirmBody}</span>
                </span>
              </label>
              {saveError ? (
                <p role="alert" className="text-body text-heat">
                  {saveError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? "Saving" : field ? "Save changes" : "Save field"}
                </Button>
                <Button type="button" variant="quiet" onClick={() => setSheetOpen(false)}>
                  Back to the map
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
