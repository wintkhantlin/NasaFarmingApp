"use client";

import Link from "next/link";
import { useState } from "react";
import { SeasonStripMini } from "@/components/field/season-strip";
import { PriorityOrder } from "@/components/field/priority-order";
import { Button, buttonClass } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Icon } from "@/components/ui/icon";
import { Message } from "@/components/ui/message";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { buildVerdict, type ResultsModel } from "@/lib/plan/results-model";
import { prioritiesSchema } from "@/lib/schemas/field";
import { useFieldsStore } from "@/lib/store/fields-store";
import type { Field, PriorityId } from "@/lib/types";

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
      <button
        type="button"
        aria-label="Change priorities"
        onClick={() => { setOrder(saved); setOpen(true); }}
        className="inline-flex min-h-tap cursor-pointer items-center text-label text-field underline"
      >
        Change
      </button>
    );
  }
  return (
    <div className="flex basis-full flex-col gap-3 border-t border-line pt-3">
      <PriorityOrder value={order} onChange={setOrder} />
      {error ? <p role="alert" className="m-0 text-body-sm text-ink">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!changed || busy} onClick={save}>Update comparison</Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

const cellClass = (known: boolean) => cn("tabular px-2 py-2.5 align-top text-body-sm sm:px-3", known ? "text-ink" : "text-ink-muted");

/**
 * The answer to "which crops?" in one place: a plain verdict, the three numbers behind it, one
 * warning if it needs one, and the single next step. Everything else on the page is detail below.
 */
export function VerdictCard({ field, model }: { field: Field; model: ResultsModel }) {
  const verdict = buildVerdict(model);
  const nitrogen = verdict.evidence.find((e) => e.kind === "nitrogen");
  const numbers = verdict.evidence.filter((e) => e.kind !== "nitrogen");
  const stripOptions = model.options.filter((o) => (model.strips[o.id] ?? []).length > 0);
  const visibleUnknowns = model.unknowns.filter((item) => item.kind !== "not-applicable").slice(0, 2);

  return (
    <Panel as="section" id="overview" aria-labelledby="verdict-title" tone="field" radius="lg" className="flex scroll-mt-24 flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-col gap-1.5">
        <h2 id="verdict-title" className="m-0 max-w-measure text-balance text-headline text-ink">{verdict.headline}</h2>
        {verdict.detail ? <p className="m-0 max-w-measure text-body text-ink">{verdict.detail}</p> : null}
      </div>

      <div className="flex flex-col gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href={`/fields/${field.id}/report`} className={buttonClass("primary", "w-full sm:w-auto", "lg")}>
            <Icon name="report" />
            See my farmer summary
          </Link>
          <Link href={`/fields/${field.id}/rotation`} className="inline-flex min-h-tap items-center text-label text-field underline hover:text-ink">
            Change my crops
          </Link>
        </div>
        <p className="m-0 max-w-measure text-source text-ink-muted">{verdict.nextStep}</p>
      </div>

      {verdict.rows.length > 0 ? (
        <>
        <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
          {verdict.rows.map((r) => (
            <li key={r.optionId} className="border-t border-line pt-3 first:border-0 first:pt-0">
              <h3 className="m-0 mb-2 text-label font-semibold text-ink [overflow-wrap:anywhere]">{r.name}</h3>
              <dl className="m-0 grid grid-cols-3 gap-2 text-body-sm">
                <div><dt className="text-ink-muted">Good seasons</dt><dd className={cn("tabular m-0", r.good === null ? "text-ink-muted" : "text-ink")}>{r.goodText}</dd></div>
                <div><dt className="text-ink-muted">Water gap</dt><dd className={cn("tabular m-0", r.gapMm === null ? "text-ink-muted" : "text-ink")}>{r.gapText}</dd></div>
                <div><dt className="text-ink-muted">Income range</dt><dd className={cn("tabular m-0", r.income === null ? "text-ink-muted" : "text-ink")}>{r.incomeText}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">The plans side by side: good seasons, water gap and income range</caption>
            <thead>
              <tr className="text-source text-ink-muted">
                <th scope="col" className="px-2 py-2 font-medium sm:px-3">Plan</th>
                <th scope="col" className="px-2 py-2 font-medium sm:px-3">Good seasons</th>
                <th scope="col" className="px-2 py-2 font-medium sm:px-3">Water gap</th>
                <th scope="col" className="px-2 py-2 font-medium sm:px-3">Income range</th>
              </tr>
            </thead>
            <tbody>
              {verdict.rows.map((r) => (
                <tr key={r.optionId} className="border-t border-line">
                  <th scope="row" className="px-2 py-2.5 align-top text-left text-body-sm font-semibold text-ink [overflow-wrap:anywhere] sm:px-3">{r.name}</th>
                  <td className={cellClass(r.good !== null)}>{r.goodText}</td>
                  <td className={cellClass(r.gapMm !== null)}>{r.gapText}</td>
                  <td className={cellClass(r.income !== null)}>{r.incomeText}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 border-t border-line pt-2 text-source text-ink-muted">
            Good season: enough rain and no heat stress. Water gap: rain missing per crop in a typical season. Income: estimated MMK per hectare after listed costs over the cycle; not promised. {model.period}
          </p>
        </div>
        <p className="m-0 border-t border-line pt-2 text-source text-ink-muted md:hidden">
          Good season: enough rain and no heat stress. Water gap: rain missing per crop in a typical season. Income: estimated per hectare after listed costs; not promised. {model.period}
        </p>
        </>
      ) : null}

      {/* The same numbers as words, for screen readers. */}
      <ul className="sr-only">{numbers.map((e) => <li key={e.kind}>{e.text}</li>)}</ul>

      {nitrogen ? (
        <Message tone="caution" compact role="status" title="Deficit">
          {nitrogen.text.replace(/^Nitrogen deficit: /, "")}
        </Message>
      ) : null}
      {verdict.caution ? (
        <Message tone="caution" compact role="status" title={model.status !== "complete" ? model.statusTitle : verdict.caution}>
          {model.status === "complete" ? verdict.caution : null}
          {model.status !== "complete" ? model.statusDetail : null}
        </Message>
      ) : null}

      {visibleUnknowns.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-line pt-3" aria-label="Important unknowns to check">
          <h3 className="m-0 text-label font-semibold text-ink">Still to check before changing crops</h3>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
            {visibleUnknowns.map((item) => <li key={`${item.where}-${item.text}`}>{item.text}</li>)}
          </ul>
          {model.unknowns.length > visibleUnknowns.length ? (
            <p className="m-0 text-source text-ink-muted">{model.unknowns.length - visibleUnknowns.length} more checks are in the detailed comparison.</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 border-t border-line pt-1 text-body-sm text-ink">
        <span>
          <span className="text-ink-muted">Counting: </span>
          <strong className="font-semibold">{model.priorities.length > 0 ? model.priorities.map((p) => p.label).join(" > ") : "all goals equally"}</strong>
          {model.prioritiesAssumed && model.priorities.length > 0 ? <span className="ml-2 text-source text-ink-muted">(assumed)</span> : null}
        </span>
        <span aria-hidden className="text-ink-muted">·</span>
        <PriorityEditor field={field} />
      </div>

      {stripOptions.length > 0 ? (
        <Disclosure title="See season by season" hint="Which past years were good">
          <ul className="m-0 grid list-none gap-x-5 gap-y-3 p-0 lg:grid-cols-3">
            {stripOptions.map((o) => (
              <li key={o.id} className="flex flex-col gap-1.5 border-t border-line pt-3 first:border-0 first:pt-0">
                <span className="text-label font-semibold text-ink">{verdict.rows.find((r) => r.optionId === o.id)?.name ?? o.name}</span>
                <SeasonStripMini strip={model.strips[o.id] ?? []} />
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </Panel>
  );
}
