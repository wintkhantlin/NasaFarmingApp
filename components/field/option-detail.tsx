import { useState } from "react";
import TextField from "@mui/material/TextField";
import { CropCalendar } from "@/components/field/crop-calendar";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Provenance, ScopeBadge } from "@/components/ui/provenance";
import { RiskChip } from "@/components/ui/risk-chip";
import { copy } from "@/lib/copy/en";
import type { EvaluatedOption, FitStatus, SlotEvaluation } from "@/lib/engine/compare";
import type { FitLevel } from "@/lib/engine/suitability";
import { ofSeasons } from "@/lib/evidence/indicator";
import { formatSpan } from "@/lib/rotation-format";
import { useFieldsStore } from "@/lib/store/fields-store";
import type { Hazard } from "@/components/ui/icons";

const fmt = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? "unknown" : n.toFixed(d));
const mmk = (n: number) => `${Math.round(n).toLocaleString()} MMK`;

export const FIT_HAZARD: Record<FitStatus, Hazard> = { fits: "healthy", "does-not-fit": "heat", "not-confirmed": "drought" };
const LEVEL: Record<FitLevel, { hazard: Hazard; word: string }> = {
  preferred: { hazard: "healthy", word: "Preferred" },
  tolerated: { hazard: "drought", word: "Tolerated" },
  outside: { hazard: "heat", word: "Outside range" },
  unknown: { hazard: "drought", word: "Unknown" },
};

const KIND_TAGS: Record<string, string> = {
  observation: "Satellite",
  "model-estimate": "Weather model",
  "farmer-report": "You told us",
  "soil-test": "Soil test",
  scenario: "What-if",
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RiskChip hazard="drought">Your call</RiskChip>
          <span className="font-medium text-ink">{topic}</span>
        </div>
        {fieldId ? (
          <Button variant="link" onClick={() => setOpen(!open)} className="!text-source">
            {open ? "Close" : "Not right for my field?"}
          </Button>
        ) : null}
      </div>
      <p className="m-0 text-ink-muted">{note}</p>
      {open ? (
        <div className="mt-2 flex flex-col gap-2 border-t border-line pt-2">
          <p className="text-source text-ink font-medium">
            Add what you see on your land (saved to your adviser report):
          </p>
          <div className="flex gap-2 items-center">
            <TextField
              slotProps={{ htmlInput: { "aria-label": "Local field observation for adviser report" } }}
              value={disagreeText}
              onChange={(e) => setDisagreeText(e.target.value)}
              placeholder="e.g. Canal water is available here until February"
              size="small"
              className="flex-1"
            />
            <Button variant="primary" onClick={handleSaveDisagreement} disabled={!disagreeText.trim()}>
              {saved ? "Saved" : "Save note"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UnitExplanation({ units }: { units?: string }) {
  if (!units) return null;
  const clean = units.trim().toLowerCase();
  let explanation = "";
  if (clean.includes("mm")) {
    explanation = "1 mm of rain is about 1 litre of water on each square metre of soil.";
  } else if (clean.includes("kg n/ha") || clean.includes("kg/ha")) {
    explanation = "Kilograms per hectare. 100 kg/ha is about 40 kg per acre.";
  } else if (clean.includes("mmk")) {
    explanation = "Myanmar Kyat.";
  }
  if (!explanation) return null;
  return (
    <p className="m-0 text-source text-ink-muted italic">
      What this means: {explanation}
    </p>
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
        <RiskChip hazard={LEVEL[e.suitability.overall].hazard}>{LEVEL[e.suitability.overall].word}</RiskChip>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {e.suitability.checks.map((c) => (
          <li key={c.id} className="flex flex-col gap-0.5 border-t border-line pt-1.5 first:border-0 first:pt-0">
            <span className="flex flex-wrap items-center gap-2 text-body-sm text-ink">
              <span className="font-medium">{c.label}</span>
              <RiskChip hazard={LEVEL[c.level].hazard}>{LEVEL[c.level].word}</RiskChip>
            </span>
            <span className="text-body-sm text-ink-muted">{c.detail}</span>
            <span className="flex flex-wrap items-center gap-2 text-source text-ink-muted">
              {c.inputSource ? <span>Input: {c.inputSource}</span> : null}
              {c.ruleSource ? <ScopeBadge scope={c.ruleSource.scope} /> : null}
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

/** Everything the engine knows about one option, in the order a farmer or adviser would ask for it. */
const NoCall = () => null;

export function OptionDetail({
  option,
  rainyMonths,
  fieldId,
  region,
  showCalls = true,
}: {
  option: EvaluatedOption;
  rainyMonths: number[];
  fieldId?: string;
  region?: string;
  /** The "Your call" notes are the same for every option, so a page shows them once. */
  showCalls?: boolean;
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
          note="Sowing calendars are general species baselines. Sowing dates should be tuned to local varieties and the arrival of the monsoon."
          fieldId={fieldId}
        />
        {region === "ayeyarwady" ? (
          <YC
            topic="Flooded rice and bare soil"
            note="Satellite water pixels do not mean bare ground. Standing water and flood recession timing depend on local bunding."
            fieldId={fieldId}
          />
        ) : null}
      </Section>

      <Section id={`${o.id}-fit`} title={copy.compare.suitabilityTitle} description="Each check is preferred, tolerated, outside or unknown. Unknown is never a pass.">
        <div className="grid gap-3 lg:grid-cols-2">
          {o.slots.map((e) => (
            <SuitabilityBlock key={e.slot.id} e={e} />
          ))}
        </div>
      </Section>

      <Section id={`${o.id}-water`} title={copy.compare.waterTitle} description="Historical seasons replayed over these crop windows. Not a forecast.">
        {o.slots.some(s => s.evaluationStatus === "not-evaluated") ? <p className="text-body-sm text-ink-muted">Not-evaluated: overlapping or relay crops cannot use the sequential water/ET model. Check drainage and topsoil locally.</p> : null}
        <div className="grid gap-3 lg:grid-cols-2">
          {o.slots.map((e) => (
            <WaterBlock key={e.slot.id} e={e} />
          ))}
        </div>
        <p className="m-0 text-body-sm text-ink-muted">
          Dry-season replay: {o.dryYear.evaluated > 0 ? `${ofSeasons(o.dryYear.passes, o.dryYear.evaluated)} met every crop's checks` : "not evaluated"}. {o.dryYear.note}
          {o.dryYear.label ? ` ${o.dryYear.label}.` : ""}
        </p>
        <YC
          topic="Water on your field"
          note="SMAP is a 9 km cell and cannot see your canal, tube well or low corner. Your experience with local moisture beats the satellite model."
          fieldId={fieldId}
        />
      </Section>

      <Section id={`${o.id}-soil`} title={copy.compare.soilTitle} description="Mechanisms and ranges, not predictions of soil carbon or yield.">
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
            {o.nitrogen.scope ? <ScopeBadge scope={o.nitrogen.scope} className="self-start" /> : null}
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
                <ScopeBadge scope={m.scope} className="self-start" />
              </li>
            ))}
          </ul>
        </div>
        <YC
          topic="Soil fertility"
          note="The soil map is 250 m and global. Your own soil test or hands-on experience beats any regional map."
          fieldId={fieldId}
        />
        {region === "shan" ? (
          <YC
            topic="Slope and erosion"
            note="Weather models cannot resolve every mountain slope or valley. Contour bunds, terracing and cover crops depend on your topography."
            fieldId={fieldId}
          />
        ) : null}
      </Section>

      <Section id={`${o.id}-pest`} title={copy.compare.pestTitle} description="From crop family relationships only. Weather cannot identify a disease.">
        {o.slots.some(s => s.evaluationStatus === "not-evaluated") ? <p className="text-body-sm text-ink-muted">Not-evaluated: disease and family-sequence interpretation for overlapping crops is unverified.</p> : o.pest.length === 0 ? (
          <p className="m-0 text-body-sm text-ink-muted">Only one crop, so there is no sequence to check.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {o.pest.map((p, i) => (
              <li key={i} className="flex flex-col gap-0.5 text-body-sm">
                <span className="flex flex-wrap items-center gap-2 text-ink">
                  <RiskChip hazard={p.result === "same-family" ? "drought" : p.result === "different-family" ? "healthy" : "drought"}>
                    {p.result === "same-family" ? "Same family" : p.result === "different-family" ? "Different family" : "Unknown"}
                  </RiskChip>
                  {p.text}
                </span>
                {p.scope ? <ScopeBadge scope={p.scope} className="self-start" /> : null}
              </li>
            ))}
          </ul>
        )}
        <YC
          topic="Pests and disease"
          note="NASA data cannot identify insect pests, stem borers, or soil-borne fungi or guarantee that a rotation breaks their cycle."
          fieldId={fieldId}
        />
      </Section>

      <Section id={`${o.id}-forage`} title={copy.compare.forageTitle} description="Environmental feasibility only. Greenness is not forage quality.">
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body-sm text-ink">
          {o.forage.forage.map((f) => (
            <li key={f.cropId}>
              <strong>{f.name}:</strong> {f.use === "none" ? "not a feed crop." : f.note}
            </li>
          ))}
        </ul>
        <p className="m-0 text-body-sm text-ink-muted">Still needed: {o.forage.needs.join("; ")}.</p>
      </Section>

      <Section id={`${o.id}-econ`} title={copy.compare.economicsTitle} description="From the price, yield and cost ranges you entered. Weather does not change them.">
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
          note="No satellite can see current farmgate prices, buyer presence, or harvest labour availability in your township."
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
            {o.evidence.map((ev) => {
              const kindTag = KIND_TAGS[ev.indicator.kind] ?? ev.indicator.kind;
              return (
                <li key={ev.id} className="flex flex-col gap-1.5 border-b border-line pb-3.5 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="m-0 text-label text-ink">{ev.claim}</p>
                    <span className="inline-flex items-center rounded-pill border border-line-strong bg-surface px-2.5 py-0.5 text-source font-medium text-ink-muted">
                      {kindTag}
                    </span>
                  </div>
                  <p className="tabular m-0 font-mono text-data text-ink">
                    {ev.indicator.value === null ? copy.provenance.unknown : `${ev.indicator.value} ${ev.indicator.units}`}
                  </p>
                  <UnitExplanation units={ev.indicator.units} />
                  {ev.comparedTo ? <p className="m-0 text-body-sm text-ink-muted">{ev.comparedTo}</p> : null}
                  <Provenance indicator={ev.indicator} />
                </li>
              );
            })}
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

