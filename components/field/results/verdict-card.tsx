"use client";

import { useState } from "react";
import { HeadToHead } from "@/components/field/results/head-to-head";
import { EvidenceTag, PlanScale } from "@/components/field/results/plan-scale";
import { SeasonStripMini } from "@/components/field/season-strip";
import { PriorityOrder } from "@/components/field/priority-order";
import { Button } from "@/components/ui/button";
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
function PriorityEditor({ field, label = "Change" }: { field: Field; label?: string }) {
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
        className="inline-flex min-h-tap cursor-pointer items-center text-body-sm font-medium text-field underline"
      >
        {label}
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

const GOALS: Array<{ id: PriorityId | "all"; label: string }> = [
  { id: "income", label: "Earn more" },
  { id: "water", label: "Save water" },
  { id: "soil", label: "Build soil" },
  { id: "forage", label: "Animal feed" },
  { id: "all", label: "All equally" },
];

/**
 * One-tap goal selector. It switches what the comparison counts, so it is a segmented control:
 * a tray of equal segments that wraps on a phone, so every goal stays visible.
 */
function GoalChips({ field }: { field: Field }) {
  const update = useFieldsStore((s) => s.update);
  const currentOrder = field.priorities?.order ?? [];
  const activeId: PriorityId | "all" = currentOrder.length > 0 ? currentOrder[0] : "all";

  const handleSelect = async (id: PriorityId | "all") => {
    const newOrder: PriorityId[] = id === "all" ? [] : [id];
    const prev = field.priorities;
    const priorities = newOrder.length
      ? {
          order: newOrder,
          weights: {},
          soil: newOrder.includes("soil") ? prev?.soil : undefined,
          income: newOrder.includes("income") ? prev?.income : undefined,
        }
      : undefined;
    await update(field.id, { priorities });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body-sm font-semibold text-ink">What matters most to you?</span>
      <div
        role="radiogroup"
        aria-label="Choose farming goal"
        className="flex flex-wrap gap-1 rounded-md border border-line bg-surface-sunken p-1 sm:w-fit"
      >
        {GOALS.map((goal) => {
          const isSelected = activeId === goal.id;
          return (
            <button
              key={goal.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => void handleSelect(goal.id)}
              className={cn(
                "inline-flex min-h-tap flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-3 text-body-sm font-medium whitespace-nowrap transition-colors sm:flex-none",
                isSelected ? "bg-field font-semibold text-on-field shadow-xs" : "text-ink hover:bg-surface-raised",
              )}
            >
              {goal.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The answer to "which crops?" in one place: a plain sentence, one reason, the warning if there is one,
 * then every plan on a Good / Fair / Risky scale. The goal that shapes the answer and all the figures sit below.
 * The one action (see my summary) is the FlowNav at the bottom of the page, in the same place as every screen.
 */
export function VerdictCard({ field, model }: { field: Field; model: ResultsModel }) {
  const verdict = buildVerdict(model);
  const nitrogen = verdict.evidence.find((e) => e.kind === "nitrogen");
  const numbers = verdict.evidence.filter((e) => e.kind !== "nitrogen");
  const stripOptions = model.options.filter((o) => (model.strips[o.id] ?? []).length > 0);
  const visibleUnknowns = model.unknowns.filter((item) => item.kind !== "not-applicable").slice(0, 2);
  const decision = model.decision;
  // "Other plans handle dry weather far better" has no counterpart in the decision summary, so it keeps its own sentence.
  const legacy = !decision || /far better than what you grow now/.test(verdict.headline);
  const top = model.ranking[0];
  const legacyBest = model.status === "complete" && top && !top.closeToNext ? top.optionId : undefined;
  const bestOptionId = legacy ? legacyBest : decision.verdict === "clear" ? (decision.winnerId ?? undefined) : undefined;
  const bestId = bestOptionId && verdict.rows.some((r) => r.optionId === bestOptionId) ? bestOptionId : undefined;
  const pickedRow = verdict.rows.find((r) => r.optionId === bestId);
  const headline = legacy ? verdict.headline : decision.headline;
  // One short reason: the decision's own line, otherwise the trade-off, otherwise the plain weather fact for the picked plan.
  const reason = legacy
    ? (verdict.detail ?? (pickedRow && pickedRow.known ? `In past weather it had ${pickedRow.goodText} good seasons. This is not a forecast.` : null))
    : decision.whyShort && decision.whyShort.trim() !== decision.headline.trim() ? decision.whyShort : null;
  const overline = bestId
    ? { icon: "goal" as const, text: "Plan to try first" }
    : decision && !legacy && decision.verdict === "close"
      ? { icon: "compare" as const, text: "Too close to call" }
      : { icon: "help" as const, text: "No clear winner yet" };
  const watchOut = !legacy && decision.watchOut ? decision.watchOut : null;
  const hasCaution = Boolean(watchOut) || Boolean(nitrogen) || (verdict.caution && model.status !== "unresolved");

  return (
    <section id="overview" aria-labelledby="verdict-title" className="flex scroll-mt-24 flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className={cn("m-0 flex items-center gap-1.5 text-body-sm font-semibold", bestId ? "text-field" : "text-ink-muted")}>
          <Icon name={overline.icon} size={18} aria-hidden />
          {overline.text}
        </p>
        <h2 id="verdict-title" className="m-0 max-w-measure text-balance text-title text-ink [overflow-wrap:break-word] sm:text-display">{headline}</h2>
        {reason ? <p className="m-0 max-w-measure text-body text-ink">{reason}</p> : null}
        {!legacy ? <EvidenceTag level={decision.evidenceLevel} label={decision.evidenceLabel} /> : null}
      </div>

      {/* A warning that could change the decision is read before the scale, never tucked away. */}
      {hasCaution ? (
        <div className="flex flex-col gap-3">
          {watchOut ? (
            <Message tone={decision?.limitConflict ? "problem" : "caution"} compact title={watchOut} />
          ) : null}
          {nitrogen ? (
            <Message tone="caution" compact role="status" title="Deficit">
              {nitrogen.text.replace(/^Nitrogen deficit: /, "")}
            </Message>
          ) : null}
          {verdict.caution && model.status !== "unresolved" ? (
            <Message tone="caution" compact role="status" title={model.status !== "complete" ? model.statusTitle : verdict.caution}>
              {model.status === "complete" ? null : model.statusDetail}
            </Message>
          ) : null}
        </div>
      ) : null}

      {/* The signature: every plan on one Good / Fair / Risky scale. The exact figures are one tap away. */}
      {verdict.rows.length > 1 ? (
        <PlanScale rows={verdict.rows} options={model.options} bestId={bestId}>
          <HeadToHead rows={verdict.rows} options={model.options} period={model.period} />
        </PlanScale>
      ) : null}

      {/* The same numbers as words, for screen readers. */}
      <ul className="sr-only">{numbers.map((e) => <li key={e.kind}>{e.text}</li>)}</ul>

      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <GoalChips field={field} />
        {model.priorities.length > 1 ? (
          <div className="flex flex-wrap items-center gap-x-2 text-body-sm text-ink">
            <span>
              <span className="text-ink-muted">Counting: </span>
              <strong className="font-semibold">{model.priorities.map((p) => p.label).join(" > ")}</strong>
              {model.prioritiesAssumed ? <span className="ml-2 text-body-sm text-ink-muted">(assumed)</span> : null}
            </span>
            <PriorityEditor field={field} />
          </div>
        ) : (
          <div className="flex">
            <PriorityEditor field={field} label="Rank more than one goal" />
          </div>
        )}
      </div>

      {visibleUnknowns.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-line pt-4" aria-label="Important unknowns to check">
          <h3 className="m-0 flex items-center gap-1.5 text-headline text-ink">
            <Icon name="checklist" size={20} className="text-ink-muted" aria-hidden />
            Still to check before changing crops
          </h3>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
            {visibleUnknowns.map((item) => <li key={`${item.where}-${item.text}`}>{item.text}</li>)}
          </ul>
          {model.unknowns.length > visibleUnknowns.length ? (
            <p className="m-0 text-body-sm text-ink-muted">{model.unknowns.length - visibleUnknowns.length} more checks are in the detailed comparison.</p>
          ) : null}
        </div>
      ) : null}

      {!legacy && decision.whatWouldChange.length > 0 ? (
        <Disclosure title="What could change this answer">
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-body-sm text-ink">
            {decision.whatWouldChange.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Disclosure>
      ) : null}

      {stripOptions.length > 0 ? (
        <Disclosure title="See season by season">
          <ul className="m-0 grid list-none gap-x-5 gap-y-3 p-0 lg:grid-cols-3">
            {stripOptions.map((o) => (
              <li key={o.id} className="flex flex-col gap-1.5 border-t border-line pt-3 first:border-0 first:pt-0">
                <span className="text-body-sm font-semibold text-ink">{verdict.rows.find((r) => r.optionId === o.id)?.name ?? o.name}</span>
                <SeasonStripMini strip={model.strips[o.id] ?? []} />
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </section>
  );
}
