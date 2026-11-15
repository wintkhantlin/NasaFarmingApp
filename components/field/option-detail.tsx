import { useState } from "react";
import TextField from "@mui/material/TextField";
import { CropCalendar } from "@/components/field/crop-calendar";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { IndicatorCard } from "@/components/ui/indicator-card";
import { ScopeBadge } from "@/components/ui/provenance";
import { Message } from "@/components/ui/message";
import { RiskChip } from "@/components/ui/risk-chip";
import { copy } from "@/lib/copy/en";
import type { EvaluatedOption, FitStatus, SlotEvaluation } from "@/lib/engine/compare";
import type { FitLevel } from "@/lib/engine/suitability";
import { ofSeasons } from "@/lib/evidence/indicator";
import { formatSpan, slotName } from "@/lib/rotation-format";
import { getCropById } from "@/lib/data/crops";
import { useFieldsStore } from "@/lib/store/fields-store";
import type { Hazard } from "@/components/ui/icons";
import type { RuleScope } from "@/lib/types";

const fmt = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? "unknown" : n.toFixed(d));
const mmk = (n: number) => `${Math.round(n).toLocaleString()} MMK`;

export const FIT_HAZARD: Record<FitStatus, Hazard> = { fits: "healthy", "does-not-fit": "heat", "not-confirmed": "drought" };
const LEVEL: Record<FitLevel, { hazard: Hazard; word: string }> = {
  preferred: { hazard: "healthy", word: "Preferred" },
  tolerated: { hazard: "drought", word: "Tolerated" },
  outside: { hazard: "heat", word: "Outside range" },
  unknown: { hazard: "drought", word: "Unknown" },
};

export function YourCallMarker({
  topic,
  note,
  fieldId,
}: {
  topic: string;
  note: string;
  fieldId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [disagreeText, setDisagreeText] = useState("");
  const [saved, setSaved] = useState(false);
  const update = useFieldsStore((s) => s.update);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));

  const handleSaveDisagreement = async () => {
    if (!fieldId || !disagreeText.trim() || !field) return;
    const existing = field.localNotes ? field.localNotes.split("\n") : [];
    const entry = `[${topic}]: ${disagreeText.trim()}`;
    const updated = [...existing.filter((line) => !line.startsWith(`[${topic}]:`)), entry].join("\n");
    await update(fieldId, { localNotes: updated });
    setSaved(true);
    setTimeout(() => {
      setOpen(false);
      setSaved(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface p-3 text-body-sm">
      <Message
        tone="info"
        compact
        title={topic}
        action={
          fieldId ? (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="inline-flex min-h-tap cursor-pointer items-center text-label text-field underline hover:text-ink"
            >
              {open ? "Close" : "Not right for my field?"}
            </button>
          ) : null
        }
      >
        {note}
      </Message>
      {open ? (
        <div className="mt-2 flex flex-col gap-2 border-t border-line pt-2">
          <p className="text-source text-ink font-medium">
            Add what you see on your land (saved to your adviser report):
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <TextField
              slotProps={{ htmlInput: { "aria-label": "Local field observation for adviser report" } }}
              value={disagreeText}
              onChange={(e) => setDisagreeText(e.target.value)}
              placeholder="e.g. Canal water is available here until February"
              size="small"
              className="w-full sm:flex-1"
            />
            <Button variant="primary" onClick={handleSaveDisagreement} disabled={!disagreeText.trim()} className="w-full sm:w-auto">
              {saved ? "Saved" : "Save note"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const Section = ({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) => (
  <Panel as="section" aria-labelledby={id} className="flex flex-col gap-3 p-4 sm:p-5">
    <PanelHeader id={id} as="h3" title={title} description={description} />
    {children}
  </Panel>
);

function SuitabilityBlock({ e }: { e: SlotEvaluation }) {
  if (!e.suitability) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3">
        <p className="m-0 text-label text-ink">{e.name}</p>
        {e.unknowns.map((u) => (
          <p key={u} className="m-0 text-body-sm text-ink-muted">
            {u}
          </p>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-label text-ink">
          {e.name} <span className="text-body-sm font-normal text-ink-muted">{formatSpan(e.slot.plantDate, e.slot.harvestDate)}</span>
        </p>
        {e.suitability.overall !== "unknown" ? <RiskChip hazard={LEVEL[e.suitability.overall].hazard}>{LEVEL[e.suitability.overall].word}</RiskChip> : null}
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {e.suitability.checks.map((c) => (
          <li key={c.id} className="flex flex-col gap-0.5 border-t border-line pt-1.5 first:border-0 first:pt-0">
            <span className="flex flex-wrap items-center gap-2 text-body-sm text-ink">
              <span className="font-medium">{c.label}</span>
              {c.level !== "unknown" ? <RiskChip hazard={LEVEL[c.level].hazard}>{LEVEL[c.level].word}</RiskChip> : null}
            </span>
            <span className="text-body-sm text-ink-muted">{c.detail}</span>
            <span className="flex flex-wrap items-center gap-2 text-source text-ink-muted">
              {c.inputSource ? <span>Input: {c.inputSource}</span> : null}
              {c.ruleSource ? <ScopeBadge scope={c.ruleSource.scope} refText={c.ruleSource.ref} /> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WaterBlock({ e }: { e: SlotEvaluation }) {
  if (!e.hasRules) return null;
  const n = e.rain.windows;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3 text-body-sm">
      <p className="m-0 text-label text-ink">{e.name}</p>
      <p className="tabular m-0 text-data text-ink">
        Rain {fmt(e.rain.total.p50)} mm, demand {fmt(e.water?.etc.p50 ?? null)} mm, short by {fmt(e.water?.shortfall.p50 ?? null)} mm
      </p>
      <p className="m-0 text-ink-muted">
        Medians over {ofSeasons(e.rain.eligible, n)} usable. Longest dry run: median {fmt(e.rain.longestDry.p50)} days, driest tenth {fmt(e.rain.longestDry.p90)} days.
        {e.irrigated ? " Marked irrigated, so rain alone is not the whole picture." : ""}
      </p>
      {e.rootZone?.status === "ok" ? (
        <p className="tabular m-0 text-data text-ink">
          Root zone: crop got {fmt(e.rootZone.actualEtMm)} mm of {fmt(e.rootZone.actualEtMm + e.rootZone.unmetDemandMm)} mm, {e.rootZone.daysBeyondHalfTaw} days past the stress point, mean stress factor {e.rootZone.meanStressCoefficient.toFixed(2)}
        </p>
      ) : null}
      {e.rootZone?.status === "ok" ? e.rootZone.assumptions.filter((a) => /capped|field capacity/.test(a)).map((a) => <p key={a} className="m-0 text-ink-muted">{a}</p>) : null}
      {e.paddy?.status === "ok" ? (
        <p className="tabular m-0 text-data text-ink">
          Paddy pond: crop got {fmt(e.paddy.actualEtMm)} mm of {fmt(e.paddy.actualEtMm + e.paddy.unmetEtMm)} mm, pond empty {e.paddy.dryPondDays} days, {fmt(e.paddy.spillMm)} mm spilled over the bund
        </p>
      ) : null}
      {e.paddy?.status === "unknown" ? <p className="m-0 text-ink-muted">Paddy balance not run: needs {e.paddy.missing.join(", ")}.</p> : null}
      {e.rootZone?.status === "unknown" ? <p className="m-0 text-ink-muted">Root-zone balance not run: needs {e.rootZone.missing.join(", ")}.</p> : null}
    </div>
  );
}

interface Citation {
  scope: RuleScope;
  ref: string;
  url?: string;
}

/** The sourced nitrogen-fixation range behind each legume in the option. */
function nitrogenSources(o: EvaluatedOption): Citation[] {
  const seen = new Map<string, Citation>();
  for (const slot of o.rotation.slots) {
    const n = slot.cropId ? getCropById(slot.cropId)?.profile?.nFixKgHa : undefined;
    if (n && !seen.has(n.ref)) seen.set(n.ref, { scope: n.scope, ref: n.ref, url: n.url });
  }
  return [...seen.values()];
}

/**
 * When there is no crop-after-crop pair to check (one crop, or overlapping crops),
 * show each crop's family from the library and what repeating it means, with the source.
 */
function familyEvidence(o: EvaluatedOption): Array<Citation & { key: string; family: string; text: string; repeats: boolean }> {
  const crops = o.rotation.slots.filter((sl) => sl.kind !== "fallow" && sl.cropId);
  const families = new Map<string, string[]>();
  for (const sl of crops) {
    const c = getCropById(sl.cropId as string);
    if (!c) continue;
    families.set(c.family, [...(families.get(c.family) ?? []), slotName(sl)]);
  }
  const single = crops.length === 1;
  return [...families.entries()].map(([family, names]) => {
    const crop = getCropById(crops.find((sl) => getCropById(sl.cropId as string)?.family === family)?.cropId as string);
    const selfRule = crop?.profile?.rotationRules.find((r) => r.avoidAfterFamilies.includes(family));
    const repeats = single || names.length > 1;
    const who = [...new Set(names)].join(" and ");
    const text = single
      ? `${who} is grown every cycle, so pests and diseases of the ${family} family can carry over from one season to the next.${selfRule ? ` ${selfRule.reason}` : ""}`
      : repeats
        ? `${who} share the ${family} family, so their pests and diseases can pass between them.`
        : `${who} is the only ${family} crop in this sequence.`;
    const source: Citation = selfRule
      ? { scope: selfRule.scope, ref: selfRule.ref }
      : { scope: "analyst-assumption", ref: `Crop family from the crop library${crop?.sources[0] ? ` (${crop.sources[0].field}: ${crop.sources[0].ref})` : ""}; general host-family rotation guidance` };
    return { key: family, family, text, repeats, ...source };
  });
}

/** Everything the engine knows about one option, in the order a farmer or adviser would ask for it. */
const NoCall = () => null;

export function OptionDetail({
  option,
  rainyMonths,
  fieldId,
  region,
  showCalls = true,
  yearsChecked,
}: {
  option: EvaluatedOption;
  rainyMonths: number[];
  fieldId?: string;
  region?: string;
  /** The "Your call" notes are the same for every option, so a page shows them once. */
  showCalls?: boolean;
  /** How many complete past years were checked in all, so "N of M dry years" has a stated denominator. */
  yearsChecked?: number;
}) {
  const o = option;
  const YC = showCalls ? YourCallMarker : NoCall;
  return (
    <div className="flex flex-col gap-4">
      {o.fit === "does-not-fit" && o.noFitReason ? (
        <Panel as="div" tone="plain" className="flex flex-col gap-1 p-4">
          <p className="m-0 text-label text-ink">Not a fit here</p>
          <p className="m-0 text-body text-ink">{o.noFitReason}</p>
        </Panel>
      ) : null}

      <Section id={`${o.id}-cal`} title={copy.calendar.title} description={copy.calendar.lead}>
        <CropCalendar option={o} rainyMonths={rainyMonths} />
        {o.lowCover.length > 0 ? (
          <div className="flex flex-col gap-1">
            <h4 className="m-0 text-label text-ink">{copy.compare.lowCoverTitle}</h4>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body-sm text-ink">
              {o.lowCover.map((g) => (
                <li key={g.gap.from}>
                  {g.gap.from.slice(5)} to {g.gap.to.slice(5)} ({g.gap.days} days): {g.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <YC
          topic="Variety and sowing dates"
          note="Sowing windows come from the regional crop calendar. Your variety and when the monsoon arrives on your field fine-tune them."
          fieldId={fieldId}
        />
        {region === "ayeyarwady" ? (
          <YC
            topic="Flooded rice and bare soil"
            note="Satellite water readings show where water stands. How fast it drains from your field depends on your bunds and is best judged on the ground."
            fieldId={fieldId}
          />
        ) : null}
      </Section>

      <Section id={`${o.id}-fit`} title={copy.compare.suitabilityTitle} description="Each check compares past seasons at this field with published temperature, rain and soil ranges for the crop.">
        <div className="grid gap-3 lg:grid-cols-2">
          {o.slots.map((e) => (
            <SuitabilityBlock key={e.slot.id} e={e} />
          ))}
        </div>
      </Section>

      <Section id={`${o.id}-water`} title={copy.compare.waterTitle} description="Rain and crop water demand for each crop window, replayed over past seasons at this field.">
        {o.slots.some(s => s.evaluationStatus === "not-evaluated") ? <p className="text-body-sm text-ink-muted">Not-evaluated: overlapping or relay crops cannot use the sequential water/ET model. Check drainage and topsoil locally.</p> : null}
        <div className="grid gap-3 lg:grid-cols-2">
          {o.slots.map((e) => (
            <WaterBlock key={e.slot.id} e={e} />
          ))}
        </div>
        <p className="m-0 text-body-sm text-ink-muted">
          Dry-season replay: {o.dryYear.evaluated > 0 ? `Passed ${o.dryYear.passes} of ${o.dryYear.evaluated} severe dry ${o.dryYear.evaluated === 1 ? "year" : "years"}${yearsChecked ? ` (of ${yearsChecked} years checked)` : ""}, meeting every crop's checks` : "needs complete past dry seasons for these crop windows"}. {o.dryYear.note}
          {o.dryYear.label ? ` ${o.dryYear.label}.` : ""}
        </p>
        <YC
          topic="Water on your field"
          note="Soil moisture comes from NASA SMAP, one value per 9 km area. What you see from your canal, tube well or low corner sharpens it for your field."
          fieldId={fieldId}
        />
      </Section>

      <Section id={`${o.id}-soil`} title={copy.compare.soilTitle} description="Published nitrogen and soil-cover ranges for these crops, with their sources.">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3 text-body-sm">
            <h4 className="m-0 text-label text-ink">{copy.compare.nitrogenTitle}</h4>
            <p className="m-0 text-ink">
              {o.nitrogen.fixedKgHa ? `Legumes here can fix about ${fmt(o.nitrogen.fixedKgHa[0])} to ${fmt(o.nitrogen.fixedKgHa[1])} kg N/ha per cycle.` : "No nitrogen-fixing crop in this cycle."}
            </p>
            <p className="m-0 text-ink-muted">
              {o.nitrogen.removedKgHa !== null ? `Grain from your yields removes about ${fmt(o.nitrogen.removedKgHa)} kg N/ha.` : "Nitrogen removed in grain is unknown without your yields."}
            </p>
            <p className="m-0 text-ink-muted">{o.nitrogen.note}</p>
            {nitrogenSources(o).map((src) => (
              <ScopeBadge key={src.ref} scope={src.scope} refText={src.ref} url={src.url} className="self-start" />
            ))}
            {o.nitrogen.scope && nitrogenSources(o).length === 0 ? <ScopeBadge scope={o.nitrogen.scope} className="self-start" /> : null}
          </div>
          <div className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3 text-body-sm">
            <h4 className="m-0 text-label text-ink">{copy.compare.erosionTitle}</h4>
            <RiskChip hazard={o.erosion.exposure === "elevated" ? "heat" : o.erosion.exposure === "possible" ? "drought" : o.erosion.exposure === "not-flagged" ? "healthy" : "drought"}>
              {o.erosion.exposure === "needs-slope-data" ? "Needs slope data" : o.erosion.exposure === "not-flagged" ? "Not flagged" : o.erosion.exposure === "possible" ? "Possible exposure" : "Elevated exposure"}
            </RiskChip>
            <ul className="m-0 list-disc pl-4 text-ink">
              {o.erosion.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="m-0 text-ink-muted">{o.erosion.caveats[0]}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3 text-body-sm">
          <h4 className="m-0 text-label text-ink">{copy.compare.organicTitle}</h4>
          {o.mechanisms.length === 0 ? <p className="m-0 text-ink-muted">No clear mechanism in this cycle.</p> : null}
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {o.mechanisms.map((m) => (
              <li key={m.id} className="flex flex-col gap-0.5">
                <span className="text-ink"><strong>{m.title}.</strong> {m.text}</span>
                <ScopeBadge scope={m.scope} refText={m.ref} className="self-start" />
              </li>
            ))}
          </ul>
        </div>
        <YC
          topic="Soil fertility"
          note="Soil values come from SoilGrids, one value per 250 m. A soil test or your own experience gives the field-level answer."
          fieldId={fieldId}
        />
        {region === "shan" ? (
          <YC
            topic="Slope and erosion"
            note="Slope comes from NASA SRTM elevation data. Your contour bunds, terraces and cover crops decide how much soil stays in place."
            fieldId={fieldId}
          />
        ) : null}
      </Section>

      <Section id={`${o.id}-pest`} title={copy.compare.pestTitle} description="Checked against crop families and the named pests and diseases each pair of crops shares. Each finding shows its source.">
        {o.slots.some((sl) => sl.evaluationStatus === "not-evaluated") ? (
          <p className="m-0 text-body-sm text-ink-muted">These crops overlap in the field, so each crop&apos;s family is listed below instead of a crop-after-crop check.</p>
        ) : null}
        {o.pest.length > 0 && !o.slots.some((sl) => sl.evaluationStatus === "not-evaluated") ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {o.pest.map((p, i) => (
              <li key={i} className="flex flex-col gap-1 text-body-sm">
                <span className="flex flex-wrap items-center gap-2 text-ink">
                  {p.result !== "unknown" ? (
                    <RiskChip hazard={p.result === "same-family" || p.shared.some((h) => h.severity === "caution") ? "drought" : "healthy"}>
                      {p.shared.some((h) => h.severity === "caution")
                        ? "Shares a soil disease or pest"
                        : p.result === "same-family"
                          ? "Same family"
                          : "Different family"}
                    </RiskChip>
                  ) : null}
                  {p.text}
                </span>
                {p.shared.map((h) => (
                  <span key={h.organismId} className="text-ink-muted">
                    <span className="text-ink">{h.name}</span> (<i>{h.scientific}</i>): {h.advice}
                  </span>
                ))}
                {p.scope ? <ScopeBadge scope={p.scope} refText={p.ref} /> : null}
                {p.shared[0] ? <ScopeBadge scope={p.shared[0].scope} refText={p.shared.map((h) => h.ref).join("; ")} /> : null}
              </li>
            ))}
            {o.hostReturns.map((h) => (
              <li key={`return-${h.organismId}`} className="flex flex-col gap-1 text-body-sm">
                <span className="flex flex-wrap items-center gap-2 text-ink">
                  <RiskChip hazard="drought">Comes back too soon</RiskChip>
                  {h.text}
                </span>
                <ScopeBadge scope={h.scope} refText={h.ref} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {familyEvidence(o).map((f) => (
              <li key={f.key} className="flex flex-col gap-1 text-body-sm">
                <span className="flex flex-wrap items-center gap-2 text-ink">
                  <RiskChip hazard={f.repeats ? "drought" : "healthy"}>{f.family}</RiskChip>
                  {f.text}
                </span>
                <ScopeBadge scope={f.scope} refText={f.ref} />
              </li>
            ))}
          </ul>
        )}
        <YC
          topic="Pests and disease"
          note="Family rules come from the crop library. Pests and diseases you have seen on this field add evidence the library does not have."
          fieldId={fieldId}
        />
      </Section>

      <Section id={`${o.id}-forage`} title={copy.compare.forageTitle} description="Feed use of each crop, from the crop library.">
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body-sm text-ink">
          {o.forage.forage.map((f) => (
            <li key={f.cropId}>
              <strong>{f.name}:</strong> {f.use === "none" ? "not a feed crop." : f.note}
            </li>
          ))}
        </ul>
        <p className="m-0 text-body-sm text-ink-muted">Still needed: {o.forage.needs.join("; ")}.</p>
      </Section>

      <Section id={`${o.id}-econ`} title={copy.compare.economicsTitle} description="Price, yield and cost ranges for each crop, with where each range comes from.">
        {o.economics.slots.length === 0 ? null : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body-sm text-ink">
            {o.economics.slots.map((s) => (
              <li key={s.slotId}>
                <strong>{s.name}:</strong>{" "}
                {s.marginMmkHa ? `${mmk(s.marginMmkHa[0])} to ${mmk(s.marginMmkHa[1])} per ha (${s.source ?? "your numbers"})` : `unknown, missing ${s.missing.join(", ")}`}
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 text-body-sm text-ink-muted">
          {o.economics.cycleMarginMmkHa
            ? `Whole cycle: ${mmk(o.economics.cycleMarginMmkHa[0])} to ${mmk(o.economics.cycleMarginMmkHa[1])} per ha${o.economics.cycleMarginMmk ? `, ${mmk(o.economics.cycleMarginMmk[0])} to ${mmk(o.economics.cycleMarginMmk[1])} for this field` : ""}.`
            : "No cycle total: some crops lack a yield, price or cost range."}
        </p>
        <YC
          topic="Markets, prices and labour"
          note="Prices and costs come from the ranges shown above. Your local buyers, farmgate prices and harvest labour give the current picture."
          fieldId={fieldId}
        />
      </Section>

      <Section id={`${o.id}-why`} title={copy.compare.explanationTitle}>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {o.explanations.map((x) => (
            <li key={x.id} className="flex flex-col gap-0.5 border-b border-line pb-3 text-body-sm last:border-0 last:pb-0">
              <p className="m-0 text-label text-ink">{x.claim}</p>
              <p className="m-0 text-ink-muted"><span className="text-ink">Rule:</span> {x.rule}</p>
              <p className="m-0 text-ink-muted"><span className="text-ink">Input:</span> {x.input} · <span className="text-ink">Period:</span> {x.period}</p>
              <p className="m-0 text-ink-muted"><span className="text-ink">Data:</span> {x.source}</p>
              <p className="m-0 text-ink-muted"><span className="text-ink">Metric:</span> {x.metric}</p>
              <p className="m-0 text-ink-muted"><span className="text-ink">{copy.compare.changeIf}:</span> {x.changeIf}</p>
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section id={`${o.id}-evidence`} title={copy.compare.evidenceTitle}>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {o.evidence.map((ev) => (
              <li key={ev.id} className="border-b border-line pb-3.5 last:border-0 last:pb-0">
                <IndicatorCard indicator={ev.indicator} claim={ev.claim} comparedTo={ev.comparedTo} />
              </li>
            ))}
          </ul>
        </Section>

        <div className="flex min-w-0 flex-col gap-4">
          {o.risks.length > 0 ? (
            <Section id={`${o.id}-risks`} title="What could go wrong">
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {o.risks.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1 border-t border-line pt-2.5 first:border-0 first:pt-0">
                    <p className="m-0 text-label text-ink">{r.text}</p>
                    <p className="m-0 text-body-sm text-ink-muted">
                      <span className="text-ink font-medium">What to check: </span>
                      {r.action}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <Section id={`${o.id}-unknowns`} title={copy.compare.groupUnknowns} description={copy.compare.unknownsWarning}>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
              {o.unknowns.length === 0 ? <li>Nothing more is needed for what is shown here.</li> : o.unknowns.map((u) => <li key={u}>{u}</li>)}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

