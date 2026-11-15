"use client";

import { useMemo, useState } from "react";
import { ScopeBadge } from "@/components/ui/provenance";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Icon } from "@/components/ui/icon";
import { CROP_LIBRARY_VERSION, type StrategyCrop } from "@/lib/data/crops";
import { REGIONS, REGION_IDS } from "@/lib/data/regions";
import { useLocaleStore } from "@/lib/store/locale-store";
import type { CropStage, RegionalCalendar, RuleScope } from "@/lib/types";

export function CropLibraryView({ crops }: { crops: StrategyCrop[] }) {
  const locale = useLocaleStore((s) => s.locale);
  const isMy = locale === "my";
  const [search, setSearch] = useState("");

  const filteredCrops = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return crops;
    return crops.filter((c) => {
      const matchCommon = c.names.common.toLowerCase().includes(q);
      const matchScientific = c.names.scientific.toLowerCase().includes(q);
      const matchFamily = c.family.toLowerCase().includes(q);
      const matchLocal = c.names.local.some((l) => l.toLowerCase().includes(q));
      return matchCommon || matchScientific || matchFamily || matchLocal;
    });
  }, [crops, search]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-title text-ink sm:text-display">
          {isMy ? "သီးနှံလမ်းညွှန်" : "Crop guide"}
        </h1>
        <p className="max-w-measure text-pretty text-body text-ink-muted">
          {isMy
            ? `မူကွဲ ${CROP_LIBRARY_VERSION}။ ဤလမ်းညွှန်တွင် မော်ဒယ်က ဖော်ပြနိုင်သော သီးနှံများကို ပြသထားပါသည်။ ၎င်းသည် မျိုးစိတ်အဆင့် ရည်ညွှန်းချက်သာဖြစ်ပြီး သင့်စိုက်ခင်း သို့မဟုတ် မျိုးကွဲနှင့် ကိုက်ညီမည်ဟု အာမမခံပါ။ စိုက်ပျိုးရာသီ၊ မျိုးစေ့၊ ဝယ်ယူမည့်သူနှင့် မျိုးကွဲကို ဒေသအလိုက် လက်တွေ့စစ်ဆေးပါ။`
            : `Version ${CROP_LIBRARY_VERSION}. This guide names crops the model can describe. It is species-level reference information, not a promise that a crop suits your field or variety. Check season, seed, buyer and variety locally before deciding.`}
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-body-sm text-ink-muted">
          {REGION_IDS.map((r) => (
            <li key={r}>
              <strong className="text-ink">{REGIONS[r].name}:</strong> {REGIONS[r].focus}
            </li>
          ))}
        </ul>
        <p className="m-0 max-w-measure text-pretty text-body-sm text-ink-muted">
          {isMy
            ? "ECOCROP နှစ်စဉ် မိုးရေချိန် အတိုင်းအတာများသည် ယေဘုယျ ဂေဟဗေဒဆိုင်ရာ ဖြစ်သည်။ အက်ပ်သည် ၎င်းတို့ကို ရာသီတစ်ခု၏ မိုးရေချိန်နှင့် မည်သည့်အခါမျှ တိုက်ရိုက်မနှိုင်းယှဉ်ပါ။"
            : "ECOCROP annual rainfall ranges are broad ecology. The app never compares them with one season's rain. Pulses and cover crops from the team brief are resolved to green gram, chickpea and pigeon pea (Magway), and lablab and sunn hemp (Shan)."}
        </p>
      </header>

      <div className="max-w-md">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={isMy ? "သီးနှံအမည်ဖြင့် ရှာဖွေပါ…" : "Search crop by name, family, or species…"}
          aria-label={isMy ? "သီးနှံ ရှာဖွေရန်" : "Search crops"}
          clearLabel={isMy ? "ရှာထားသည်ကို ဖျက်ရန်" : "Clear search"}
        />
      </div>

      {filteredCrops.length === 0 ? (
        <EmptyState
          icon="search"
          title={isMy ? "ကိုက်ညီသော သီးနှံ မတွေ့ပါ" : "No crops match your search"}
          body={isMy ? "အခြားသီးနှံအမည် သို့မဟုတ် မျိုးရင်းဖြင့် ရှာကြည့်ပါ။" : "Try searching by a common name, scientific name, or family."}
        >
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="inline-flex min-h-tap cursor-pointer items-center text-label text-field underline underline-offset-4"
            >
              {isMy ? "ရှာဖွေမှုကို ရှင်းလင်းပါ" : "Clear search filter"}
            </button>
          ) : null}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredCrops.map((c) => {
            const p = c.profile!;
            const cropTitle = isMy ? (c.names.local[0] ?? c.names.common) : c.names.common;
            return (
              <Panel as="article" key={c.id} className="flex flex-col gap-3 p-4 sm:p-5">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-balance text-headline font-semibold text-ink">{cropTitle}</h2>
                  <p className="m-0 text-pretty text-body-sm text-ink-muted">
                    <em>{c.names.scientific}</em> · {c.family} · cycle <span className="tabular-nums">{c.cycleDays.min}</span> to <span className="tabular-nums">{c.cycleDays.max}</span> days (usual <span className="tabular-nums">{c.cycleDays.typ}</span>)
                  </p>
                </div>
                <dl className="m-0 flex flex-col gap-2 text-body-sm">
                  {([
                    [isMy ? "အဓိကအချက်များ" : "What to consider", `Temperature reference ${p.tempC.optMin.value} to ${p.tempC.optMax.value} °C; confirm local variety and season.`, p.tempC.optMin.scope],
                    [isMy ? "မြေဆီလွှာ pH" : "Soil pH", `preferred ${p.ph.optMin.value} to ${p.ph.optMax.value}, tolerated ${p.ph.absMin.value} to ${p.ph.absMax.value}`, p.ph.optMin.scope],
                    [isMy ? "နှစ်စဉ် မိုးရေချိန် (ဂေဟဗေဒ)" : "Annual rain (ecology only)", `${p.ecologyAnnualRainMm.value[0]} to ${p.ecologyAnnualRainMm.value[1]} mm`, p.ecologyAnnualRainMm.scope],
                    [isMy ? "ရေလိုအပ်ချက် အညွှန်း (Kc)" : "Crop coefficients (Kc) by stage", p.stages.map((s: CropStage) => `${s.label} ${s.kc.value}`).join(" · "), p.stages[0].kc.scope],
                    ...(p.nFixKgHa ? [[isMy ? "နိုက်ထရိုဂျင် ပိုမိုစေမှု" : "Nitrogen fixed", `${p.nFixKgHa.value[0]} to ${p.nFixKgHa.value[1]} kg N/ha per crop`, p.nFixKgHa.scope] as const] : []),
                    [isMy ? "တိရစ္ဆာန်အစာ အသုံးပြုမှု" : "Fodder or forage", p.forage ? p.forage.note : (isMy ? "မရှိပါ" : "No entry"), p.forage?.scope ?? "analyst-assumption"],
                    ...(Object.entries(p.regionalCalendars) as [string, RegionalCalendar][]).map(([r, cal]) => [
                      `${isMy ? "ပုံမှန် စိုက်ပျိုးချိန် ရည်ညွှန်းချက်" : "Usual sowing reference"}, ${REGIONS[r as keyof typeof REGIONS]?.name ?? r}`,
                      `${cal.sowWindow[0]} to ${cal.sowWindow[1]}, ${cal.durationDays[0]} to ${cal.durationDays[1]} days; confirm locally`,
                      cal.scope,
                    ] as const),
                  ] as Array<readonly [string, string, RuleScope]>).map(([k, v, scope]) => (
                    <div key={k} className="flex flex-col gap-0.5 border-t border-line pt-2 first:border-0 first:pt-0">
                      <dt className="text-body-sm text-ink-muted">{k}</dt>
                      <dd className="m-0 flex flex-wrap items-center gap-2 text-ink tabular-nums">
                        <span className="text-pretty">{v}</span>
                        <ScopeBadge scope={scope} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="m-0 text-pretty text-source text-ink-muted">{p.note}</p>

                {/* Collapsible evidence sources to distill default reading flow */}
                <details className="group/sources border-t border-line/60 pt-2 text-source text-ink-muted">
                  <summary className="flex min-h-tap cursor-pointer items-center gap-1.5 font-medium text-field select-none hover:underline">
                    <Icon name="provenance" size={16} />
                    <span>{isMy ? "အချက်အလက် ကိုးကားချက်များ" : "Sources & citations"} ({c.sources.length})</span>
                  </summary>
                  <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 pl-1 text-source text-ink-muted">
                    {c.sources.map((s: { field: string; ref: string }) => (
                      <li key={s.field}>
                        <strong className="text-ink">{s.field}:</strong> {s.ref}
                      </li>
                    ))}
                    {p.tempC.optMin.url ? (
                      <li className="pt-0.5">
                        <a href={p.tempC.optMin.url} className="text-field underline underline-offset-4" target="_blank" rel="noreferrer">
                          FAO ECOCROP data sheet
                        </a>
                      </li>
                    ) : null}
                  </ul>
                </details>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
