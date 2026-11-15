"use client";

import { ScopeBadge } from "@/components/ui/provenance";
import { Panel } from "@/components/ui/panel";
import { CROP_LIBRARY_VERSION, type StrategyCrop } from "@/lib/data/crops";
import { REGIONS, REGION_IDS } from "@/lib/data/regions";
import { useLocaleStore } from "@/lib/store/locale-store";
import type { CropStage, RegionalCalendar, RuleScope } from "@/lib/types";

export function CropLibraryView({ crops }: { crops: StrategyCrop[] }) {
  const locale = useLocaleStore((s) => s.locale);
  const isMy = locale === "my";

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink sm:text-display">
          {isMy ? "သီးနှံလမ်းညွှန်" : "Crop guide"}
        </h1>
        <p className="max-w-measure text-body text-ink-muted">
          {isMy
            ? `မူကွဲ ${CROP_LIBRARY_VERSION}။ ဤလမ်းညွှန်တွင် မော်ဒယ်က ဖော်ပြနိုင်သော သီးနှံများကို ပြသထားပါသည်။ ၎င်းသည် မျိုးစိတ်အဆင့် ရည်ညွှန်းချက်သာဖြစ်ပြီး သင့်စိုက်ခင်း သို့မဟုတ် မျိုးကွဲနှင့် ကိုက်ညီမည်ဟု အာမမခံပါ။ စိုက်ပျိုးရာသီ၊ မျိုးစေ့၊ ဝယ်ယူမည့်သူနှင့် မျိုးကွဲကို ဒေသအလိုက် လက်တွေ့စစ်ဆေးပါ။`
            : `Version ${CROP_LIBRARY_VERSION}. This guide names crops the model can describe. It is species-level reference information, not a promise that a crop suits your field or variety. Check season, seed, buyer and variety locally before deciding.`}
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-body-sm text-ink-muted">
          {REGION_IDS.map((r) => (
            <li key={r}>
              <strong className="text-ink">{REGIONS[r].name}:</strong> {REGIONS[r].focus}
            </li>
          ))}
        </ul>
        <p className="m-0 max-w-measure text-body-sm text-ink-muted">
          {isMy
            ? "ECOCROP နှစ်စဉ် မိုးရေချိန် အတိုင်းအတာများသည် ယေဘုယျ ဂေဟဗေဒဆိုင်ရာ ဖြစ်သည်။ အက်ပ်သည် ၎င်းတို့ကို ရာသီတစ်ခု၏ မိုးရေချိန်နှင့် မည်သည့်အခါမျှ တိုက်ရိုက်မနှိုင်းယှဉ်ပါ။"
            : "ECOCROP annual rainfall ranges are broad ecology. The app never compares them with one season's rain. Pulses and cover crops from the team brief are resolved to green gram, chickpea and pigeon pea (Magway), and lablab and sunn hemp (Shan)."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {crops.map((c) => {
          const p = c.profile!;
          const cropTitle = isMy ? (c.names.local[0] ?? c.names.common) : c.names.common;
          return (
            <Panel as="article" key={c.id} className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-headline text-ink">{cropTitle}</h2>
                <p className="m-0 text-body-sm text-ink-muted">
                  <em>{c.names.scientific}</em> · {c.family} · cycle {c.cycleDays.min} to {c.cycleDays.max} days (usual {c.cycleDays.typ})
                </p>
              </div>
              <dl className="m-0 flex flex-col gap-2 text-body-sm">
                {([
                  ["What to consider", `Temperature reference ${p.tempC.optMin.value} to ${p.tempC.optMax.value} °C; confirm local variety and season.`, p.tempC.optMin.scope],
                  ["Soil pH", `preferred ${p.ph.optMin.value} to ${p.ph.optMax.value}, tolerated ${p.ph.absMin.value} to ${p.ph.absMax.value}`, p.ph.optMin.scope],
                  ["Annual rain (ecology only)", `${p.ecologyAnnualRainMm.value[0]} to ${p.ecologyAnnualRainMm.value[1]} mm`, p.ecologyAnnualRainMm.scope],
                  ["Crop coefficients (Kc) by stage", p.stages.map((s: CropStage) => `${s.label} ${s.kc.value}`).join(" · "), p.stages[0].kc.scope],
                  ...(p.nFixKgHa ? [["Nitrogen fixed", `${p.nFixKgHa.value[0]} to ${p.nFixKgHa.value[1]} kg N/ha per crop`, p.nFixKgHa.scope] as const] : []),
                  ["Fodder or forage", p.forage ? p.forage.note : "No entry", p.forage?.scope ?? "analyst-assumption"],
                  ...(Object.entries(p.regionalCalendars) as [string, RegionalCalendar][]).map(([r, cal]) => [`Usual sowing reference, ${REGIONS[r as keyof typeof REGIONS]?.name ?? r}`, `${cal.sowWindow[0]} to ${cal.sowWindow[1]}, ${cal.durationDays[0]} to ${cal.durationDays[1]} days; confirm locally`, cal.scope] as const),
                ] as Array<readonly [string, string, RuleScope]>).map(([k, v, scope]) => (
                  <div key={k} className="flex flex-col gap-0.5 border-t border-line pt-2 first:border-0 first:pt-0">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="m-0 flex flex-wrap items-center gap-2 text-ink">
                      {v}
                      <ScopeBadge scope={scope} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="m-0 text-source text-ink-muted">{p.note}</p>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-source text-ink-muted">
                {c.sources.map((s: { field: string; ref: string }) => (
                  <li key={s.field}>{s.field}: {s.ref}</li>
                ))}
                {p.tempC.optMin.url ? (
                  <li>
                    <a href={p.tempC.optMin.url} className="text-field underline" target="_blank" rel="noreferrer">
                      FAO ECOCROP data sheet
                    </a>
                  </li>
                ) : null}
              </ul>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
