"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PriorityOrder, orderSummary } from "@/components/field/priority-order";
import { Button } from "@/components/ui/button";
import { topicsForIndicator } from "@/lib/learn/topics";
import { useFieldsStore } from "@/lib/store/fields-store";
import { prioritiesSchema } from "@/lib/schemas/field";
import { SeasonStrip } from "@/components/field/season-strip";
import { Disclosure } from "@/components/ui/disclosure";
import { Icon, type IconName } from "@/components/ui/icon";
import { Message } from "@/components/ui/message";
import { cn } from "@/lib/cn";
import {
  BASIS_WORDS,
  MISSING_WORDS,
  type Cell,
  type Dimension,
  type EconomicsRow,
  type MissingKind,
  type OptionRef,
  type ResultsModel,
  type WaterRow,
} from "@/lib/plan/results-model";
import type { Field, PriorityId } from "@/lib/types";
import type { Spread } from "@/lib/engine/rain";

const mmk = (n: number) => Math.round(n).toLocaleString();
const span = (r: [number, number] | null, unit: string) => (r ? `${mmk(r[0])} to ${mmk(r[1])} ${unit}` : null);
const sp = (s: Spread, unit = "mm") => (s.p50 === null ? "not known" : `${Math.round(s.p50)} ${unit} (usually ${Math.round(s.p10 ?? s.p50)} to ${Math.round(s.p90 ?? s.p50)})`);

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "compare", label: "Compare" },
  { id: "water-climate", label: "Water & climate" },
  { id: "soil", label: "Soil" },
  { id: "money", label: "Money" },
  { id: "why", label: "Why" },
  { id: "unknowns", label: "Unknowns" },
] as const;

const MISSING_ICON: Record<MissingKind, IconName> = { unknown: "help", "not-measured": "help", "not-available": "info", "not-applicable": "info" };

function MissingTag({ kind }: { kind: MissingKind }) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1 rounded-pill border border-dashed border-unknown-border bg-unknown-bg px-2 text-source font-medium text-unknown-text">
      <Icon name={MISSING_ICON[kind]} size={14} aria-hidden />
      {MISSING_WORDS[kind].label}
    </span>
  );
}

function CellView({ cell }: { cell: Cell }) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-1">
      {cell.missing ? <MissingTag kind={cell.missing} /> : null}
      <span className={cn("text-body-sm", cell.missing ? "text-ink-muted" : "text-ink")}>{cell.text}</span>
      {cell.basis ? <span className="text-source text-ink-muted">{BASIS_WORDS[cell.basis]}</span> : null}
    </span>
  );
}

/** Change the priority order after seeing the comparison. Saving rewrites only the order; finer soil and income choices are kept while their priority stays chosen. */
function PriorityEditor({ field }: { field: Field }) {
  const update = useFieldsStore((s) => s.update);
  const saved = field.priorities?.order ?? [];
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<PriorityId[]>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = order.join() !== saved.join();
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const prev = field.priorities;
      const priorities = order.length
        ? prioritiesSchema.parse({ order, weights: {}, soil: order.includes("soil") && prev?.soil?.length ? prev.soil : undefined, income: order.includes("income") && prev?.income?.length ? prev.income : undefined })
        : undefined;
      await update(field.id, { priorities });
      setOpen(false);
    } catch {
      setError("Your order could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  };
  if (!open) {
    return (
      <button type="button" onClick={() => { setOrder(saved); setOpen(true); }} className="inline-flex min-h-tap items-center self-start text-label text-field underline">
        Change my order
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <PriorityOrder value={order} onChange={setOrder} />
      {error ? <p role="alert" className="m-0 text-body-sm text-ink">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!changed || busy} onClick={save}>Update comparison</Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="m-0 text-headline text-ink">{title}</h2>
        {intro ? <p className="m-0 max-w-measure text-body-sm text-ink-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function CropLine({ crops }: { crops: string[] }) {
  if (crops.length === 0) return <span className="text-body-sm text-ink-muted">No crops recorded</span>;
  return (
    <ol aria-label="Crops in order" className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
      {crops.map((c, i) => (
        <li key={`${c}-${i}`} className="flex items-center gap-1">
          {i > 0 ? <Icon name="next" size={14} className="text-ink-muted" aria-hidden /> : null}
          <span className="rounded-pill bg-field-soft px-2.5 py-0.5 text-body-sm font-semibold text-ink">{c.replace(/\s*\(.*\)\s*$/, "")}</span>
        </li>
      ))}
    </ol>
  );
}

function Switcher({ options, value, onChange }: { options: OptionRef[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="group" aria-label="Choose a rotation to look at" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-tap cursor-pointer rounded-pill border px-4 text-label transition-colors",
            value === o.id ? "border-field bg-field text-on-field" : "border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken",
          )}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

function DimensionHelp({ d }: { d: Dimension }) {
  const learn = topicsForIndicator(d.id);
  return (
    <>
      <dl className="m-0 flex flex-col gap-2 text-body-sm">
        <div><dt className="font-medium text-ink">What it measures</dt><dd className="m-0 text-ink-muted">{d.measures}</dd></div>
        {d.matters ? <div><dt className="font-medium text-ink">Why it matters</dt><dd className="m-0 text-ink-muted">{d.matters}</dd></div> : null}
        <div><dt className="font-medium text-ink">Which way is better</dt><dd className="m-0 text-ink-muted">{d.better}</dd></div>
        <div><dt className="font-medium text-ink">Limits</dt><dd className="m-0 text-ink-muted">{d.limits}</dd></div>
      </dl>
      {learn.length > 0 ? (
        <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0 text-body-sm">
          {learn.map((t) => (
            <li key={t.id}>
              <Link href={`/data/${t.id}`} className="inline-flex min-h-tap items-center text-field">Learn: {t.question.en}</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/* ---------------- A: overview ---------------- */

function Overview({ field, model, focusId }: { field: Field; model: ResultsModel; focusId: string }) {
  const tone = model.status === "complete" ? "success" : model.status === "partial" ? "needs" : "caution";
  return (
    <Section id="overview" title="Comparison overview">
      <Message tone={tone} title={model.statusTitle} role="status">
        {model.statusDetail}
      </Message>
      <div className="grid gap-3 md:grid-cols-2">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {model.options.map((o) => (
            <li key={o.id} className={cn("flex flex-col gap-1.5 rounded-lg border bg-surface-raised p-3", o.id === focusId ? "border-field" : "border-line")}>
              <span className="text-label font-semibold text-ink-muted">{o.name}</span>
              <CropLine crops={o.crops} />
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4">
          <div>
            <h3 className="m-0 text-label text-ink">What matters to you</h3>
            {model.priorities.length > 0 && !model.prioritiesAssumed ? (
              <ol className="m-0 mt-1 flex list-decimal flex-col gap-0.5 pl-5 text-body-sm text-ink">
                {model.priorities.map((p) => <li key={p.id}>{p.label}</li>)}
              </ol>
            ) : (
              <p className="m-0 mt-1 text-body-sm text-ink-muted">No priority order set. Every priority was weighted equally.</p>
            )}
            <p className="m-0 mt-1 text-body-sm text-ink">{orderSummary(model.priorities.map((p) => p.id))}</p>
            <p className="m-0 mt-1 text-source text-ink-muted">The order changes the comparison: your first priority counts most, each next one a little less. Priorities you did not choose are left out.</p>
          </div>
          <p className="m-0 text-body-sm text-ink-muted">{model.period}</p>
          <PriorityEditor field={field} />
          <div className="flex flex-wrap gap-2">
            <Link href={`/fields/${field.id}/profile`} className="inline-flex min-h-tap items-center text-label text-field underline">Edit my priorities</Link>
            <Link href={`/fields/${field.id}/location`} className="inline-flex min-h-tap items-center text-label text-field underline">Edit field location</Link>
            <Link href={`/fields/${field.id}/rotation`} className="inline-flex min-h-tap items-center text-label text-field underline">Edit my crops</Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ---------------- B: comparison ---------------- */

function CompareSection({ model, focusId, setFocus }: { model: ResultsModel; focusId: string; setFocus: (id: string) => void }) {
  const yours = model.options[0];
  const focus = model.options.find((o) => o.id === focusId) ?? yours;
  return (
    <Section id="compare" title="Rotation comparison" intro="Each line says what was found, which way is better, and whether it is an estimate or something you entered.">
      <Switcher options={model.options} value={focus.id} onChange={setFocus} />

      {/* Desktop: all rotations side by side */}
      <div className="hidden overflow-x-auto rounded-lg border border-line md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Rotation comparison by dimension</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[22%] bg-surface-raised p-3"><span className="sr-only">Dimension</span></th>
              {model.options.map((o) => (
                <th key={o.id} scope="col" className={cn("p-3 align-top", o.id === focus.id && "bg-field-soft/50")}>
                  <span className="block text-label text-ink">{o.name}</span>
                  <span className="mt-1 block font-normal"><CropLine crops={o.crops} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.dimensions.map((d) => (
              <tr key={d.id} className="border-t border-line align-top">
                <th scope="row" className="bg-surface-raised p-3 text-left font-normal">
                  <span className="block text-label font-semibold text-ink">{d.label}</span>
                  <span className="block text-source text-ink-muted">{d.better}</span>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-source text-field">About this</summary>
                    <div className="pt-2"><DimensionHelp d={d} /></div>
                  </details>
                </th>
                {model.options.map((o) => (
                  <td key={o.id} className={cn("p-3", o.id === focus.id && "bg-field-soft/50")}>
                    <CellView cell={d.cells[o.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one rotation card at a time, with yours underneath each line */}
      <article aria-label={`${focus.name} compared`} className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4 md:hidden">
        <CropLine crops={focus.crops} />
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {model.dimensions.map((d) => (
            <li key={d.id} className="flex flex-col gap-1.5 border-t border-line pt-3 first:border-0 first:pt-0">
              <span className="text-label font-semibold text-ink">{d.label}</span>
              <CellView cell={d.cells[focus.id]} />
              {!focus.isYours ? <span className="text-source text-ink-muted">Yours now: {d.cells[yours.id].text}</span> : null}
              <details>
                <summary className="min-h-tap cursor-pointer py-2 text-source text-field">About this</summary>
                <DimensionHelp d={d} />
              </details>
            </li>
          ))}
        </ul>
      </article>
    </Section>
  );
}

/* ---------------- C: water and climate ---------------- */

function WaterBlock({ opt, rows }: { opt: OptionRef; rows: WaterRow[] }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4">
      <h3 className="m-0 text-label font-semibold text-ink">{opt.name}</h3>
      {rows.length === 0 ? (
        <p className="m-0 text-body-sm text-ink-muted"><MissingTag kind="not-available" /> Water results are not available for these crops.</p>
      ) : (
        rows.map((r) => (
          <div key={r.cropName} className="flex flex-col gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
            <p className="m-0 text-body text-ink">
              <strong className="font-semibold">{r.cropName}.</strong>{" "}
              {r.eligible === 0
                ? "Not enough weather to compare seasons."
                : r.shortSeasons === 0
                  ? `Rain covered crop water demand in all ${r.eligible} past seasons checked.`
                  : `Crop water demand was higher than rainfall in ${r.shortSeasons} of ${r.eligible} past seasons.`}
              {r.irrigated ? " You recorded irrigation; the rain figures ignore it." : ""}
            </p>
            <Disclosure title="Measurements and method">
              <dl className="m-0 grid gap-2 text-body-sm sm:grid-cols-2">
                <div><dt className="text-ink-muted">Crop water demand (ETc)</dt><dd className="tabular m-0 text-ink">{sp(r.demand)}</dd></div>
                <div><dt className="text-ink-muted">Rain in the crop window</dt><dd className="tabular m-0 text-ink">{sp(r.rain)}</dd></div>
                <div><dt className="text-ink-muted">Rain shortfall</dt><dd className="tabular m-0 text-ink">{sp(r.shortfall)}</dd></div>
                <div><dt className="text-ink-muted">Longest dry spell</dt><dd className="tabular m-0 text-ink">{sp(r.longestDry, "days")}</dd></div>
              </dl>
              {r.stages.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-body-sm">
                    <caption className="mb-1 text-left text-label text-ink">Heat, cold and heavy rain by growth stage (past seasons)</caption>
                    <thead><tr className="text-ink-muted"><th scope="col" className="py-1 pr-2 font-normal">Stage</th><th scope="col" className="py-1 pr-2 font-normal">Hot days</th><th scope="col" className="py-1 pr-2 font-normal">Cold days</th><th scope="col" className="py-1 font-normal">Heavy rain</th></tr></thead>
                    <tbody>
                      {r.stages.map((s) => (
                        <tr key={s.label} className="border-t border-line"><th scope="row" className="py-1 pr-2 text-left font-normal text-ink">{s.label}</th><td className="py-1 pr-2">{s.heat}</td><td className="py-1 pr-2">{s.cold}</td><td className="py-1">{s.wet}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="m-0 text-body-sm text-ink-muted"><MissingTag kind="unknown" /> No stage thresholds in the crop library for this crop.</p>}
              <p className="m-0 text-source text-ink-muted">Demand = crop coefficient × reference evapotranspiration from NASA POWER weather. Shortfall = demand − rain, never below zero. Runoff, stored soil water and irrigation are ignored.</p>
            </Disclosure>
          </div>
        ))
      )}
    </article>
  );
}

function WaterClimate({ field, model, focusId }: { field: Field; model: ResultsModel; focusId: string }) {
  const yours = model.options[0];
  const focus = model.options.find((o) => o.id === focusId) ?? yours;
  const shown = focus.id === yours.id ? [yours] : [yours, focus];
  return (
    <Section id="water-climate" title="Water and climate" intro="How each rotation would have handled the past seasons in the weather record. This replays history. It is not a forecast of next season.">
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((o) => <WaterBlock key={o.id} opt={o} rows={model.water[o.id] ?? []} />)}
      </div>
      <Message tone="info" compact title="Soil water" >
        {model.regionalMoisture.missing ? <MissingTag kind={model.regionalMoisture.missing} /> : null} {model.regionalMoisture.text}
      </Message>
      {model.strips[focus.id]?.length ? (
        <div className="flex flex-col gap-1">
          <p className="m-0 text-label text-ink">Season by season: {focus.name}</p>
          <SeasonStrip strip={model.strips[focus.id]} field={field} />
        </div>
      ) : null}
    </Section>
  );
}

/* ---------------- D: soil ---------------- */

function SoilSection({ model }: { model: ResultsModel }) {
  return (
    <Section id="soil" title="Soil and environment" intro="These describe the plan you entered and crop-library rules. None is a measurement of your soil.">
      <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
        {model.soil.map((d) => (
          <li key={d.id} className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised p-4">
            <h3 className="m-0 text-label font-semibold text-ink">{d.label}</h3>
            <p className="m-0 text-body-sm text-ink-muted">{d.measures}</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {model.options.map((o) => (
                <li key={o.id} className="flex flex-col gap-0.5 border-t border-line pt-2">
                  <span className="text-source font-medium text-ink-muted">{o.name}</span>
                  <CellView cell={d.cells[o.id]} />
                </li>
              ))}
            </ul>
            <Disclosure title="Why it matters and limits"><DimensionHelp d={d} /></Disclosure>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------------- E: money ---------------- */

function EconomicsBlock({ opt, rows, total, basisText }: { opt: OptionRef; rows: EconomicsRow[]; total: Cell; basisText: string }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4">
      <h3 className="m-0 text-label font-semibold text-ink">{opt.name}</h3>
      <CellView cell={total} />
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((r, i) => (
          <li key={`${r.crop}-${i}`} className="flex flex-col gap-1 border-t border-line pt-2">
            <span className="text-body-sm font-semibold text-ink">{r.crop}</span>
            <dl className="m-0 grid grid-cols-1 gap-1 text-body-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Yield range</dt><dd className="tabular m-0">{span(r.yieldKgHa, "kg/ha") ?? "Not entered"}</dd></div>
              <div><dt className="text-ink-muted">Selling price range</dt><dd className="tabular m-0">{span(r.priceMmkKg, "MMK/kg") ?? "Not entered"}</dd></div>
              <div><dt className="text-ink-muted">Variable cost range</dt><dd className="tabular m-0">{span(r.costMmkHa, "MMK/ha") ?? "Not entered"}</dd></div>
              <div><dt className="text-ink-muted">Margin range</dt><dd className="tabular m-0">{span(r.marginMmkHa, "MMK/ha") ?? "Needs all three ranges"}</dd></div>
            </dl>
            <span className="text-source text-ink-muted">
              {r.basis === "farmer" ? "Entered by you" : r.basis === "benchmark" ? `Regional benchmark${r.source ? `: ${r.source}` : ""}` : "No yield, price or cost values"}
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 text-source text-ink-muted">{basisText}</p>
    </article>
  );
}

function Money({ model }: { model: ResultsModel }) {
  const margin = model.dimensions.find((d) => d.id === "economics")!;
  return (
    <Section id="money" title="Money" intro="Estimated return after listed costs, shown as a range. It is not promised income.">
      <div className="grid gap-4 md:grid-cols-3">
        {model.options.map((o) => (
          <EconomicsBlock key={o.id} opt={o} rows={model.economics[o.id] ?? []} total={margin.cells[o.id]} basisText="Range = lowest yield × lowest price − highest cost, to highest yield × highest price − lowest cost." />
        ))}
      </div>
      {model.benchmarkText ? <p className="m-0 max-w-measure text-body-sm text-ink-muted">{model.benchmarkText}</p> : null}
      <p className="m-0 max-w-measure text-body-sm text-ink-muted">Fixed costs, labour you do not pay for, and price swings are not all included. Replace benchmark values with your own on the field profile.</p>
    </Section>
  );
}

/* ---------------- F: why ---------------- */

function ContribList({ title, items, icon }: { title: string; items: ResultsModel["why"][string]["supports"]; icon: IconName }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h4 className="m-0 flex items-center gap-1.5 text-label text-ink"><Icon name={icon} size={16} aria-hidden />{title}</h4>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
        {items.map((c) => (
          <li key={c.criterion}>{c.label}: {c.value}{c.yoursValue ? <span className="text-ink-muted"> (yours now: {c.yoursValue})</span> : null}</li>
        ))}
      </ul>
    </div>
  );
}

function WhySection({ model }: { model: ResultsModel }) {
  const alts = model.options.filter((o) => !o.isYours);
  const nameOf = (id: string) => model.options.find((o) => o.id === id)?.name ?? id;
  return (
    <Section id="why" title="Why this rotation?" intro="Reasons come straight from the ranking and checks. Where the engine gave no reason, none is made up.">
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4">
        <h3 className="m-0 text-label text-ink">How the options were ordered</h3>
        {model.status === "unresolved" ? (
          <p className="m-0 text-body text-ink">No fair order yet. Read each choice below instead of looking for a winner.</p>
        ) : model.ranking.length === 0 ? (
          <p className="m-0 text-body-sm text-ink-muted">No order was produced for this comparison.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {model.ranking.map((r) => (
              <li key={r.optionId} className="flex flex-wrap items-center gap-2 text-body-sm">
                <span className="tabular grid min-h-7 min-w-9 place-items-center rounded-pill border border-line-strong px-2 font-mono text-source">{r.place}</span>
                <span className="text-ink">{nameOf(r.optionId)}</span>
                {r.closeToNext ? <span className="text-source text-ink-muted">Very close to the next one</span> : null}
              </li>
            ))}
          </ol>
        )}
        <p className="m-0 text-source text-ink-muted">Your priority order changes this order. The order is a guide, not a score out of 100.</p>
        {model.sensitivity.length > 0 ? (
          <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-body-sm text-ink-muted">{model.sensitivity.map((s) => <li key={s}>{s}</li>)}</ul>
        ) : null}
        {model.rankingNotes.length > 0 ? (
          <Disclosure title="Ranking notes"><ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink-muted">{model.rankingNotes.map((n) => <li key={n}>{n}</li>)}</ul></Disclosure>
        ) : null}
      </div>

      {alts.length === 0 ? <p className="m-0 text-body-sm text-ink-muted">There are no alternatives to explain yet.</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {alts.map((o) => {
          const w = model.why[o.id];
          if (!w) return null;
          const nothing = w.supports.length === 0 && w.tradeOffs.length === 0 && w.similar.length === 0;
          return (
            <article key={o.id} aria-labelledby={`why-${o.id}`} className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4">
              <div className="flex flex-col gap-1.5">
                <h3 id={`why-${o.id}`} className="m-0 text-label font-semibold text-ink">{o.name}</h3>
                <CropLine crops={o.crops} />
                <p className="m-0 text-body-sm text-ink-muted">{w.rankPlace ? `Place ${w.rankPlace} for your priorities. ` : ""}{w.rankNote}</p>
              </div>
              <p className="m-0 text-body-sm text-ink">{w.reason}</p>
              {nothing ? (
                <p className="m-0 text-body-sm text-ink-muted">The engine gave no per-priority comparison with what you grow now, so none is shown.</p>
              ) : (
                <>
                  <ContribList title="Supports it" items={w.supports} icon="done" />
                  <ContribList title="Trade-offs" items={w.tradeOffs} icon="compare" />
                  <ContribList title="About the same as now" items={w.similar} icon="info" />
                </>
              )}
              {w.risks.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <h4 className="m-0 flex items-center gap-1.5 text-label text-ink"><Icon name="alert" size={16} aria-hidden />Risks</h4>
                  <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">{w.risks.map((r) => <li key={r}>{r}</li>)}</ul>
                </div>
              ) : null}
              {w.missing.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <h4 className="m-0 flex items-center gap-1.5 text-label text-ink"><Icon name="help" size={16} aria-hidden />Still missing</h4>
                  <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink-muted">{w.missing.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul>
                </div>
              ) : null}
              {w.explanations.length > 0 ? (
                <Disclosure title="Evidence behind this">
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {w.explanations.map((e) => (
                      <li key={e.id} className="flex flex-col gap-0.5 text-body-sm">
                        <span className="font-medium text-ink">{e.claim}</span>
                        <span className="text-ink-muted">Rule: {e.rule}</span>
                        <span className="text-ink-muted">Input: {e.input} · {e.period}</span>
                        <span className="text-ink-muted">Source: {e.source}</span>
                        <span className="text-ink-muted">Could change if: {e.changeIf}</span>
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              ) : null}
            </article>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------------- G: unknowns ---------------- */

function Unknowns({ model }: { model: ResultsModel }) {
  const kinds: MissingKind[] = ["unknown", "not-measured", "not-available", "not-applicable"];
  return (
    <Section id="unknowns" title="What we still do not know" intro="A missing value is never counted as zero or as good news. It is left out and listed here.">
      <dl className="m-0 grid gap-2 sm:grid-cols-2">
        {kinds.map((k) => (
          <div key={k} className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3">
            <dt><MissingTag kind={k} /></dt>
            <dd className="m-0 text-body-sm text-ink-muted">{MISSING_WORDS[k].meaning}</dd>
          </div>
        ))}
      </dl>
      {kinds.map((k) => {
        const items = model.unknowns.filter((u) => u.kind === k);
        if (items.length === 0) return null;
        return (
          <div key={k} className="flex flex-col gap-1.5">
            <h3 className="m-0 text-label text-ink">{MISSING_WORDS[k].label} ({items.length})</h3>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {items.map((u) => (
                <li key={`${u.where}-${u.text}`} className="rounded-md border border-dashed border-unknown-border bg-unknown-bg p-3 text-body-sm text-ink">
                  <span className="text-source font-medium text-unknown-text">{u.where}</span>
                  <span className="block">{u.text}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {model.assumptions.length > 0 ? (
        <Disclosure title="Assumptions that are not yet validated locally">
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink-muted">{model.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </Disclosure>
      ) : null}
      <p className="m-0 max-w-measure text-source text-ink-muted">
        Field Shift is a research prototype. It replays past weather; it does not forecast next season, promise yields or income, measure your soil moisture from regional satellites, predict diseases in your field, or replace a local adviser. Check with someone who knows your land before you change crops.
      </p>
    </Section>
  );
}

/* ---------------- Hub ---------------- */

export function ComparisonResults({ field, model }: { field: Field; model: ResultsModel }) {
  const firstAlt = model.options.find((o) => !o.isYours) ?? model.options[0];
  const [focusId, setFocus] = useState(firstAlt.id);
  const focus = model.options.some((o) => o.id === focusId) ? focusId : firstAlt.id;

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Results sections" className="sticky top-0 z-20 -mx-4 flex items-center gap-1 overflow-x-auto border-b border-line bg-surface/95 px-4 py-1 backdrop-blur print:hidden">
        <span className="mr-2 inline-flex shrink-0 items-center gap-1 text-source font-medium text-ink-muted" aria-label={`Status: ${model.statusTitle}`}>
          <Icon name={model.status === "complete" ? "done" : model.status === "partial" ? "help" : "alert"} size={14} aria-hidden />
          {model.statusTitle}
        </span>
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="inline-flex min-h-tap shrink-0 items-center px-2 text-label text-field no-underline hover:underline">{s.label}</a>
        ))}
      </nav>
      <Overview field={field} model={model} focusId={focus} />
      <CompareSection model={model} focusId={focus} setFocus={setFocus} />
      <WaterClimate field={field} model={model} focusId={focus} />
      <SoilSection model={model} />
      <Money model={model} />
      <WhySection model={model} />
      <Unknowns model={model} />
    </div>
  );
}
