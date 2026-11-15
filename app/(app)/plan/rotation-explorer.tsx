"use client";

import { Message } from "@/components/ui/message";
import { EmptyState } from "@/components/ui/empty-state";
import TextField from "@mui/material/TextField";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { getCropById } from "@/lib/data/crops";
import { REGIONS, REGION_IDS } from "@/lib/data/regions";
import { disambiguatePlaces, type PlaceCandidate, type PlaceOption } from "@/lib/plan/place-selection";
import { resolveRegionalPreview } from "@/lib/plan/regional-preview";
import { emptyPlanDraft, readPlanDraft, writePlanDraft, type PlanDraft, type PlanDraftPlace } from "@/lib/store/plan-draft";
import { useLocaleStore } from "@/lib/store/locale-store";
import type { RegionId } from "@/lib/types";
import { RefinementDrawers } from "./refinement-drawers";
import { PlanHandoff } from "@/components/field/plan-handoff";

type Step = "area" | "crop" | "preview";
type SearchResponse = {
  locations?: Array<{ id?: unknown; name?: unknown; context?: unknown; label?: unknown; lat?: unknown; lon?: unknown }>;
  error?: string;
};

const CROP_ICONS: Record<string, IconName> = {
  rice: "profile",
  maize: "profile",
  groundnut: "nut",
  sesame: "flower",
  "sunn-hemp": "flower",
  "black-gram": "bean",
  "green-gram": "bean",
  chickpea: "bean",
  "pigeon-pea": "bean",
  soybean: "bean",
  lablab: "organic",
  cotton: "flower",
  chili: "flower",
  onion: "nut",
  garlic: "nut",
  potato: "nut",
  tomato: "flower",
  sugarcane: "profile",
  cassava: "organic",
  mustard: "flower",
  "butter-bean": "bean",
  cabbage: "organic",
};

function supportedCrops(region: RegionId) {
  return REGIONS[region].candidateCropIds.map(getCropById).filter((crop) => crop?.scope === "myanmar");
}

function normalizeSearchResponse(data: SearchResponse): PlaceOption[] {
  const candidates: PlaceCandidate[] = [];
  for (const location of data.locations ?? []) {
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) continue;
    const label = typeof location.label === "string" ? location.label.trim() : "";
    const name = typeof location.name === "string" && location.name.trim() ? location.name.trim() : label.split(",")[0]?.trim();
    if (!name) continue;
    const context =
      typeof location.context === "string" && location.context.trim()
        ? location.context.trim()
        : label.startsWith(name)
          ? label.slice(name.length).replace(/^,\s*/, "")
          : label;
    candidates.push({
      id: String(location.id ?? `${location.lat},${location.lon}`),
      name,
      context,
      lat: location.lat as number,
      lon: location.lon as number,
    });
  }
  return disambiguatePlaces(candidates);
}

export default function RotationExplorer() {
  const locale = useLocaleStore((s) => s.locale);
  const isMy = locale === "my";
  const [draft, setDraft] = useState<PlanDraft>(emptyPlanDraft);
  const [step, setStep] = useState<Step>("area");
  const [hydrated, setHydrated] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [query, setQuery] = useState("");
  const [manualRegion, setManualRegion] = useState<RegionId | null>(null);
  const [results, setResults] = useState<PlaceOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [areaMessage, setAreaMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readPlanDraft();
      if (saved) {
        setDraft(saved);
        setManualRegion(saved.place?.region ?? null);
        setQuery(saved.place?.name ?? "");
        if (saved.place && saved.mainCropId) {
          const preview = resolveRegionalPreview(saved.place.region, saved.mainCropId);
          setStep(preview.availability === "invalid-crop" ? "crop" : "preview");
        } else if (saved.place) {
          setStep("crop");
        }
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      setStorageWarning(!writePlanDraft({ ...draft, updatedAt: new Date().toISOString() }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draft, hydrated]);

  const crops = useMemo(
    () => (draft.place ? supportedCrops(draft.place.region) : []),
    [draft.place?.region],
  );
  const preview = useMemo(
    () => (draft.place && draft.mainCropId ? resolveRegionalPreview(draft.place.region, draft.mainCropId) : null),
    [draft.mainCropId, draft.place],
  );

  const selectPlace = useCallback((place: PlanDraftPlace) => {
    setDraft((current) => ({ ...current, place, mainCropId: null, revision: current.revision + 1 }));
    setManualRegion(place.region);
    setQuery(place.name);
    setResults([]);
    setAreaMessage(null);
    setStep("crop");
  }, []);

  async function searchArea(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setAreaMessage(isMy ? "အနည်းဆုံး စာလုံးနှစ်လုံး ရိုက်ထည့်ပါ သို့မဟုတ် တိုင်းဒေသကြီးကို ရွေးပါ။" : "Enter at least two letters, or choose a region and use the typed place.");
      return;
    }
    setSearching(true);
    setAreaMessage(null);
    try {
      const response = await fetch(`/api/locations?q=${encodeURIComponent(query.trim())}`);
      const data = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(data.error ?? "Place search is unavailable.");
      const options = normalizeSearchResponse(data);
      setResults(options);
      if (options.length === 0) {
        setAreaMessage(isMy ? "ကိုက်ညီသော နေရာ မတွေ့ပါ။ အောက်တွင် တိုင်းဒေသကြီးကို ရွေးချယ်ပြီး ဆက်သွားနိုင်ပါသည်။" : "No matching place was returned. Choose a region below to continue with the name you typed—GPS is not required.");
      }
    } catch (error) {
      setResults([]);
      setAreaMessage(
        error instanceof Error
          ? `${error.message} ${isMy ? "အောက်တွင် တိုင်းဒေသကြီး ရွေးချယ်၍ ဆက်သွားပါ။" : "Choose a region below to continue with the name you typed."}`
          : (isMy ? "နေရာ ရှာမရပါ။ အောက်တွင် တိုင်းဒေသကြီး ရွေးချယ်၍ ဆက်သွားပါ။" : "Place search is unavailable. Choose a region below to continue with the name you typed."),
      );
    } finally {
      setSearching(false);
    }
  }

  function chooseSearchResult(place: PlaceOption) {
    if (place.region === "unsupported") {
      setAreaMessage(isMy ? "ဤနေရာသည် မြန်မာနိုင်ငံပြင်ပ ဖြစ်နေပါသည်။ မြန်မာနိုင်ငံရှိ ရွာ သို့မဟုတ် မြို့နယ်ကို ရိုက်ထည့်ပါ။" : "This place resolves outside Myanmar. Check the search result or type a Myanmar village or township.");
      return;
    }
    selectPlace({
      id: place.id,
      name: place.name,
      context: place.context || REGIONS[place.region].name,
      region: place.region,
      source: "search",
      lat: place.lat,
      lon: place.lon,
    });
  }

  function useTypedPlace() {
    if (!manualRegion || query.trim().length < 2) return;
    selectPlace({
      id: `typed:${manualRegion}:${query.trim().toLocaleLowerCase()}`,
      name: query.trim(),
      context: REGIONS[manualRegion].name,
      region: manualRegion,
      source: "typed",
    });
  }

  function useGps() {
    if (typeof window === "undefined" || !("geolocation" in window.navigator) || !window.navigator.geolocation) {
      setAreaMessage(isMy ? "ဤဖုန်းတွင် GPS မရပါ။ ရွာ သို့မဟုတ် မြို့နယ်ကို ရိုက်ထည့်ပါ။" : "GPS is not available on this device. Search or type your village/township instead.");
      return;
    }
    setLocating(true);
    setAreaMessage(null);
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        const [option] = disambiguatePlaces([
          {
            id: "gps",
            name: isMy ? "လက်ရှိနေရာ" : "Current area",
            context: isMy ? "ဤဖုန်းမှ" : "From this device",
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
        ]);
        setLocating(false);
        if (option.region === "unsupported") {
          setAreaMessage(isMy ? "သင့်တည်နေရာသည် မြန်မာနိုင်ငံပြင်ပ ဖြစ်နေပါသည်။ မြန်မာနိုင်ငံရှိ ရွာ သို့မဟုတ် မြို့နယ်ကို ရိုက်ထည့်ပါ။" : "Your location resolves outside Myanmar. Type a Myanmar village or township instead.");
          return;
        }
        selectPlace({
          id: "gps",
          name: isMy ? "လက်ရှိနေရာ" : "Current area",
          context: REGIONS[option.region].name,
          region: option.region,
          source: "gps",
          lat: option.lat,
          lon: option.lon,
        });
      },
      () => {
        setLocating(false);
        setAreaMessage(isMy ? "တည်နေရာခွင့်ပြုချက် မရပါ။ ရွာ သို့မဟုတ် မြို့နယ်ကို ရိုက်ထည့်ပါ—GPS မလိုအပ်ပါ။" : "Location permission was not available. Search or type your village/township instead—GPS is optional.");
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  const chooseCrop = useCallback((cropId: string) => {
    if (!draft.place) return;
    const result = resolveRegionalPreview(draft.place.region, cropId);
    if (result.availability === "invalid-crop") {
      setAreaMessage(result.message);
      return;
    }
    setDraft((current) => ({
      ...current,
      mainCropId: cropId,
      revision: current.revision + 1,
      refinements: {
        ...current.refinements,
        sequence: { ...current.refinements.sequence, transition: undefined, state: "draft" },
        residue: current.mainCropId === cropId ? current.refinements.residue : { value: "unknown", state: "unknown" },
      },
    }));
    setStep("preview");
  }, [draft.place, draft.mainCropId]);

  if (!hydrated) {
    return <p role="status" className="py-12 text-center text-body text-ink-muted">{isMy ? "သိမ်းဆည်းထားသော အစီအစဉ်ကို ဖွင့်နေသည်…" : "Opening your saved Plan draft…"}</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="max-w-3xl text-balance text-title text-ink sm:text-display">
          {isMy ? "သင့်အဓိကသီးနှံအပြီး စိုက်ပျိုးနိုင်မည့် သီးနှံများကို လေ့လာပါ" : "Explore what could follow your main crop"}
        </h1>
        <p className="max-w-measure text-pretty text-body text-ink-muted">
          {isMy
            ? "ခန့်မှန်းခြေ ဒေသနှင့် အဓိကသီးနှံတစ်ခုဖြင့် စတင်ပါ။ အကောင့်ဖွင့်ရန်၊ GPS၊ စိုက်ခင်းနယ်နိမိတ် သို့မဟုတ် စိုက်ရက် မလိုအပ်ပါ။"
            : "Start with an approximate area and one crop. No account, GPS, field boundary or planting date is needed."}
        </p>
        <p className="m-0 text-body-sm text-ink-muted">
          <Link href="/plan/crop-screen" className="text-field underline underline-offset-4">
            {isMy ? "ဤစိုက်ခင်း၏ မိုးလေဝသနှင့် မြေဆီလွှာအပေါ် အခြေခံ၍ နောက်သီးနှံကို စစ်ဆေးပါ" : "Check next crops against this field's weather and soil"}
          </Link>
          .
        </p>
        <ol aria-label="Plan progress" className="m-0 grid list-none grid-cols-3 gap-2 p-0 text-body-sm text-ink-muted tabular-nums">
          {(["area", "crop", "preview"] as const).map((item, index) => (
            <li key={item} className={cn("border-t-2 pt-2", step === item ? "border-field font-semibold text-field" : "border-line-strong")}>
              {index + 1}. {item === "area" ? (isMy ? "ဒေသ" : "Area") : item === "crop" ? (isMy ? "အဓိကသီးနှံ" : "Main crop") : (isMy ? "သီးလှည့်နမူနာများ" : "Regional examples")}
            </li>
          ))}
        </ol>
      </header>

      {storageWarning ? (
        <Message tone="caution" title={isMy ? "မူကြမ်းကို သိမ်းမထားနိုင်ပါ" : "This draft may not be kept"}>
          {isMy ? "ဤဘရောက်ဇာသည် local storage ကို ပိတ်ထားပါသည်။" : "This browser blocked local storage. You can continue, but the draft may not be here when you return."}
        </Message>
      ) : null}

      {step === "area" ? (
        <AreaStep
          query={query}
          region={manualRegion}
          results={results}
          searching={searching}
          locating={locating}
          message={areaMessage}
          onQueryChange={(value) => {
            setQuery(value);
            setResults([]);
            setAreaMessage(null);
          }}
          onRegionChange={setManualRegion}
          onSearch={searchArea}
          onChooseResult={chooseSearchResult}
          onUseTyped={useTypedPlace}
          onUseGps={useGps}
        />
      ) : null}

      {step === "crop" && draft.place ? (
        <CropStep
          place={draft.place}
          crops={crops}
          onBack={() => setStep("area")}
          onChoose={chooseCrop}
          warning={areaMessage}
        />
      ) : null}

      {step === "preview" && draft.place && draft.mainCropId && preview ? (
        <PreviewStep
          place={draft.place}
          mainCropId={draft.mainCropId}
          preview={preview}
          draft={draft}
          onDraftChange={setDraft}
          onEditArea={() => setStep("area")}
          onEditCrop={() => setStep("crop")}
        />
      ) : null}
    </div>
  );
}

function AreaStep({
  query,
  region,
  results,
  searching,
  locating,
  message,
  onQueryChange,
  onRegionChange,
  onSearch,
  onChooseResult,
  onUseTyped,
  onUseGps,
}: {
  query: string;
  region: RegionId | null;
  results: PlaceOption[];
  searching: boolean;
  locating: boolean;
  message: string | null;
  onQueryChange: (value: string) => void;
  onRegionChange: (region: RegionId) => void;
  onSearch: (event: FormEvent) => void;
  onChooseResult: (place: PlaceOption) => void;
  onUseTyped: () => void;
  onUseGps: () => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const isMy = locale === "my";

  return (
    <Panel as="section" radius="lg" className="flex flex-col gap-6 p-4 sm:p-6" aria-labelledby="area-heading">
      <div className="flex flex-col gap-1">
        <h2 id="area-heading" className="text-balance text-title text-ink">
          {isMy ? "သီးနှံစိုက်ပျိုးသည့် ဒေသကို ရွေးပါ" : "Where do you grow crops?"}
        </h2>
        <p className="max-w-measure text-pretty text-body text-ink-muted">
          {isMy
            ? "ရွာ သို့မဟုတ် မြို့နယ်အမည် ထည့်ရုံဖြင့် ဒေသဆိုင်ရာ သီးနှံလမ်းညွှန်ကို ရွေးချယ်ပေးပါမည်။"
            : "A village or township is enough. We use it only to choose a regional catalog."}
        </p>
      </div>

      <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <TextField
          label={isMy ? "ရွာ သို့မဟုတ် မြို့နယ်" : "Village or township"}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          autoComplete="address-level2"
          fullWidth
          helperText={
            isMy
              ? "အင်တာနက်ရပါက ရှာဖွေပါ၊ သို့မဟုတ် အမည်ရိုက်ထည့်ပြီး အောက်တွင် တိုင်းဒေသကြီး ရွေးပါ။"
              : "Search if connected, or type a place and choose its region below."
          }
        />
        <Button type="submit" icon="search" disabled={searching} className="sm:mt-1 sm:shrink-0">
          {searching ? (isMy ? "ရှာနေသည်…" : "Searching…") : (isMy ? "ရှာရန်" : "Search")}
        </Button>
      </form>

      {results.length > 0 ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <h3 className="text-balance text-headline text-ink">
            {isMy ? "ကိုက်ညီသော နေရာကို ရွေးပါ" : "Choose the matching place"}
          </h3>
          <ul className="m-0 divide-y divide-line border-y border-line p-0">
            {results.map((place) => (
              <li key={place.id} className="list-none">
                <button
                  type="button"
                  onClick={() => onChooseResult(place)}
                  className="flex min-h-14 w-full items-center gap-3 py-3 text-left hover:bg-surface-sunken"
                >
                  <Icon name="location" className="shrink-0 text-ink-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-ink">{place.name}</span>
                    <span className="block text-body-sm text-ink-muted">{place.displayLabel.replace(`${place.name} — `, "")}</span>
                  </span>
                  <Icon name="next" className="shrink-0 text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-balance text-headline text-ink">
            {isMy ? "GPS သို့မဟုတ် ရှာဖွေမှုမပါဘဲ ဆက်လက်လုပ်ဆောင်ရန်" : "Continue without GPS or search"}
          </h3>
          <p className="max-w-measure text-pretty text-body-sm text-ink-muted">
            {isMy
              ? "သင်ရိုက်ထည့်ခဲ့သော နေရာအတွက် တိုင်းဒေသကြီးကို ရွေးပါ။ မြို့လယ်ကို စိုက်ခင်းအဖြစ် သတ်မှတ်မည် မဟုတ်ပါ။"
              : "Choose the region for the place you typed. We will not turn the town center into a field location."}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Region">
          {REGION_IDS.map((regionId) => (
            <button
              key={regionId}
              type="button"
              aria-pressed={region === regionId}
              onClick={() => onRegionChange(regionId)}
              className={cn(
                "min-h-14 rounded-md border px-3 text-left",
                region === regionId ? "border-field bg-field-soft text-field" : "border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken",
              )}
            >
              <span className="block text-body-sm font-semibold">{REGIONS[regionId].name}</span>
              <span className="block text-body-sm text-ink-muted">{REGIONS[regionId].focus}</span>
            </button>
          ))}
        </div>
        <Button variant="primary" size="lg" block onClick={onUseTyped} disabled={!region || query.trim().length < 2} iconEnd="next">
          {isMy ? "ဤရိုက်ထည့်ထားသော နေရာကို သုံးမည်" : "Use this typed place"}
        </Button>
      </div>

      {message ? <Message tone="info" title={message} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="m-0 text-pretty text-body-sm text-ink-muted">
          {isMy ? "GPS သည် စိတ်ကြိုက်သာဖြစ်ပြီး မဖြစ်မနေ သုံးရန် မလိုပါ။" : "GPS is optional and never blocks the preview."}
        </p>
        <Button variant="quiet" icon="locate" onClick={onUseGps} disabled={locating}>
          {locating ? (isMy ? "တည်နေရာ စစ်ဆေးနေသည်…" : "Checking location…") : (isMy ? "ကျွန်ုပ်ရှိရာနေရာကို သုံးမည်" : "Use my location")}
        </Button>
      </div>
    </Panel>
  );
}

function CropStep({
  place,
  crops,
  onBack,
  onChoose,
  warning,
}: {
  place: PlanDraftPlace;
  crops: ReturnType<typeof supportedCrops>;
  onBack: () => void;
  onChoose: (cropId: string) => void;
  warning: string | null;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const isMy = locale === "my";
  return (
    <section className="flex flex-col gap-5" aria-labelledby="crop-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="crop-heading" className="text-title text-ink">{isMy ? "အဓိကမိုးသီးနှံမှာ အဘယ်နည်း။" : "What is your main monsoon crop?"}</h2>
          <p className="max-w-measure text-body text-ink-muted">
            {isMy
              ? `${REGIONS[place.region].name}၊ ${place.name} အတွက် သီးနှံတစ်ခု ရွေးချယ်ပါ။ ဤသည်မှာ သီးလှည့်တစ်ခုလုံး မဟုတ်ပါ။`
              : `Choose one crop for ${place.name}, ${REGIONS[place.region].name}. This does not record your full rotation.`}
          </p>
        </div>
        <Button variant="quiet" icon="back" onClick={onBack}>{isMy ? "ဒေသ ပြင်ဆင်ရန်" : "Edit area"}</Button>
      </div>

      {warning ? <Message tone="caution" title={warning} /> : null}

      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3" aria-label={isMy ? "စိုက်ပျိုးနိုင်သော သီးနှံများ" : "Supported crops"}>
        {crops.map((crop) => crop ? (
          <li key={crop.id}>
            <button
              type="button"
              onClick={() => onChoose(crop.id)}
              className="group flex min-h-36 w-full flex-col items-start justify-between rounded-md border border-line-strong bg-surface-raised p-4 text-left transition-[background-color,transform] hover:bg-field-soft active:scale-[0.98]"
            >
              <span className="flex size-12 items-center justify-center rounded-md bg-surface-sunken text-field group-hover:bg-surface-raised">
                <Icon name={CROP_ICONS[crop.id] ?? "rotation"} size={28} strokeWidth={1.7} />
              </span>
              <span>
                <span className="block text-headline text-ink">
                  {isMy ? (crop.names.local[0] ?? crop.names.common) : crop.names.common}
                </span>
              </span>
            </button>
          </li>
        ) : null)}
      </ul>
    </section>
  );
}

function PreviewStep({
  place,
  mainCropId,
  preview,
  draft,
  onDraftChange,
  onEditArea,
  onEditCrop,
}: {
  place: PlanDraftPlace;
  mainCropId: string;
  preview: ReturnType<typeof resolveRegionalPreview>;
  draft: PlanDraft;
  onDraftChange: (draft: PlanDraft) => void;
  onEditArea: () => void;
  onEditCrop: () => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const isMy = locale === "my";
  const mainCrop = getCropById(mainCropId);

  return (
    <section className="flex flex-col gap-6" aria-labelledby="preview-heading">
      <div className="flex flex-col gap-3 border-b border-line pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="preview-heading" className="text-balance text-title text-ink">
              {isMy ? `${place.name} အနီးရှိ ဒေသဆိုင်ရာ သီးလှည့်နမူနာများ` : `Regional examples near ${place.name}`}
            </h2>
            <p className="max-w-measure text-pretty text-body text-ink-muted">
              {isMy
                ? `${REGIONS[place.region].name} နှင့် ${mainCrop?.names.local[0] ?? mainCrop?.names.common ?? mainCropId} ကို အခြေခံထားသည်။ ${draft.refinements.sequence.state === "confirmed" ? "သင့်အစီအစဉ်ကို သီးခြားသိမ်းဆည်းထားပြီး ဤနမူနာများသည် သင့်စိုက်ခင်းအတွက် တွက်ချက်ထားခြင်း မဟုတ်ပါ။" : "သင့်လက်တွေ့ သီးလှည့်နှင့် စိုက်ခင်းအခြေအနေများကို မသိရှိပါ။"}`
                : `Based only on ${REGIONS[place.region].name} and ${mainCrop?.names.common ?? mainCropId}. ${draft.refinements.sequence.state === "confirmed" ? "Your reported sequence is saved separately; these regional examples are not calculated for your field." : "We do not know your actual rotation or field conditions."}`}
            </p>
          </div>
          <span className="inline-flex min-h-8 items-center rounded-pill border border-field bg-field-soft px-3 text-body-sm font-medium text-field">
            {isMy ? "ဒေသဆိုင်ရာ နမူနာ" : "Regional preview"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon="location" onClick={onEditArea}>
            {isMy ? "ဒေသ ပြင်ဆင်ရန်" : "Edit area"}
          </Button>
          <Button variant="secondary" icon="rotation" onClick={onEditCrop}>
            {isMy ? "အဓိကသီးနှံ ပြင်ဆင်ရန်" : "Edit main crop"}
          </Button>
        </div>
      </div>

      <Message tone={preview.availability === "templates-unavailable" ? "caution" : "info"} title={preview.message} />
      <RefinementDrawers draft={draft} onChange={onDraftChange} />
      <PlanHandoff draft={draft} />

      {preview.patterns.length > 0 ? (
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {preview.patterns.map((pattern, index) => (
            <li key={pattern.id}>
              <Panel as="article" radius="lg" className="flex flex-col gap-5 p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-balance flex flex-wrap items-center gap-2 text-headline font-semibold text-ink">
                    {pattern.crops.map((crop, cropIndex) => (
                      <span key={`${pattern.id}-${crop.id}`} className="inline-flex items-center gap-2">
                        {cropIndex > 0 ? <Icon name="next" size={16} className="text-ink-muted" /> : null}
                        <span>{isMy ? (crop.local || crop.english) : crop.english}</span>
                      </span>
                    ))}
                  </h3>
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-pill bg-field-soft px-2.5 text-body-sm font-semibold text-field tabular-nums">
                    <Icon name="stack" size={15} />
                    {isMy ? `ဒေသဆိုင်ရာ နမူနာ ${index + 1}` : `Regional example ${index + 1}`}
                  </span>
                </div>

                <dl className="m-0 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-body-sm font-medium text-ink-muted">
                      {isMy ? "လမ်းညွှန်တွင် ထည့်သွင်းထားရသည့် အကြောင်းရင်း" : "Why it is in the catalog"}
                    </dt>
                    <dd className="m-0 mt-1 text-pretty text-body text-ink">{pattern.rationale}</dd>
                  </div>
                  <div>
                    <dt className="text-body-sm font-medium text-ink-muted">
                      {isMy ? "ကန့်သတ်ချက်" : "Limitation"}
                    </dt>
                    <dd className="m-0 mt-1 text-pretty text-body text-ink">{pattern.limitation}</dd>
                  </div>
                  <div>
                    <dt className="text-body-sm font-medium text-ink-muted">
                      {isMy ? "အထောက်အထား အခြေအနေ" : "Evidence status"}
                    </dt>
                    <dd className="m-0 mt-1 text-pretty text-body-sm text-ink">
                      {pattern.evidenceLabel}. {isMy ? "ဤနမူနာအတွက် NASA သို့ အချက်အလက်တောင်းဆိုထားခြင်း မရှိပါ။" : "No NASA request has been made for this preview."}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-body-sm font-medium text-ink-muted">
                      {isMy ? "ဒေသအလိုက် လက်တွေ့စစ်ဆေးရန်" : "Check locally"}
                    </dt>
                    <dd className="m-0 mt-1 text-pretty text-body-sm text-ink">{pattern.localCheck}</dd>
                  </div>
                </dl>
              </Panel>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon="learn"
          title={isMy ? "ရွေးချယ်ထားသော အချက်အလက်အတွက် နမူနာ မရှိပါ" : "Templates unavailable for this selection"}
          body={isMy
            ? "အခြားအဓိကသီးနှံ သို့မဟုတ် ဒေသကို ရွေးချယ်ပါ။ သင့်ရွေးချယ်မှုကို သိမ်းဆည်းထားပြီး စိုက်ခင်းအချက်အလက်ကို သီးခြားတွက်ချက်ထားခြင်း မရှိပါ။"
            : "Choose another main crop or area. Your selection is still saved locally, and no personal field result has been inferred."}
        >
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" icon="rotation" onClick={onEditCrop}>
              {isMy ? "အဓိကသီးနှံ ပြောင်းလဲရန်" : "Change main crop"}
            </Button>
            <Button variant="quiet" icon="location" onClick={onEditArea}>
              {isMy ? "ဒေသ ပြောင်းလဲရန်" : "Change area"}
            </Button>
          </div>
        </EmptyState>
      )}

      <p className="m-0 text-pretty text-body-sm text-ink-muted tabular-nums">
        {isMy
          ? `နမူနာဗားရှင်း - ${preview.catalogVersion} · ${preview.cropLibraryVersion} · ဒေသဆိုင်ရာ နမူနာပုံစံများသာ ဖြစ်ပြီး အဆင့်သတ်မှတ်ထားခြင်း မဟုတ်ပါ။`
          : `Preview contract: ${preview.catalogVersion} · ${preview.cropLibraryVersion} · illustrative regional patterns, not a ranked result.`}
      </p>
    </section>
  );
}
