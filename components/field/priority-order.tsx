"use client";

import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { priorityWeights } from "@/lib/engine/mcda";
import type { PriorityId } from "@/lib/types";

export const PRIORITY_IDS: PriorityId[] = ["water", "soil", "income", "forage", "lower-inputs"];

/** Plain-language names and one-line explanations. What each one measures is what the ranking engine actually reads. */
export const PRIORITY_INFO: Record<PriorityId, { label: string; help: string; icon: IconName }> = {
  water: { label: "Save water", help: "Prefer crops where rain covers more of what the crop needs.", icon: "water" },
  soil: { label: "Improve soil", help: "Prefer more legumes, and fewer bare days with no crop in the field.", icon: "soil" },
  income: { label: "Earn more", help: "Prefer a higher margin, using your own yield, price and cost ranges.", icon: "price" },
  forage: { label: "Feed for animals", help: "Prefer rotations with a crop that gives fodder or forage.", icon: "organic" },
  "lower-inputs": { label: "Use less nitrogen fertiliser", help: "Prefer crops that need less nitrogen, using library values.", icon: "cost" },
};

const PLACE = ["First", "Second", "Third", "Fourth", "Fifth"];

/** Words for how much a place counts, taken from the engine's own weights so the text cannot drift from the ranking. */
export function influenceWords(order: PriorityId[]): Record<string, string> {
  const w = priorityWeights({ order, weights: {} });
  if (!w || order.length === 0) return {};
  const max = w[order[0]] ?? 0;
  const out: Record<string, string> = {};
  order.forEach((id, i) => {
    const share = (w[id] ?? 0) / max;
    out[id] = i === 0 ? "Counts most" : share >= 0.6 ? "Counts a lot" : share >= 0.3 ? "Counts some" : "Counts a little";
  });
  return out;
}

/** One sentence per situation, stating the same rule the engine applies. */
export function orderSummary(order: PriorityId[]): string {
  if (order.length === 0) return "No order chosen. The options are weighed on all five priorities equally, and no priority is favoured.";
  const names = order.map((id) => PRIORITY_INFO[id].label.toLowerCase());
  if (order.length === 1) return `Only ${names[0]} is used to compare the options.`;
  return `${PRIORITY_INFO[order[0]].label} counts most, then ${names.slice(1).join(", then ")}.`;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Why the order matters, in the farmer's words. Shown beside the picker and on the results. */
export function PriorityExplainer({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-md bg-surface-sunken p-3 text-body-sm text-ink-muted", className)}>
      <p className="m-0"><strong className="font-semibold text-ink">How your order is used.</strong> The comparison looks at each rotation on the priorities you chose. The first one counts most and each next one counts a little less.</p>
      <p className="m-0">Priorities you do not choose are left out. Two priorities cannot share a place, so one always comes first. Where we have no evidence for a rotation, it is shown as unknown, never as zero.</p>
    </div>
  );
}

export interface PriorityOrderProps {
  /** Chosen priorities, most important first. */
  value: PriorityId[];
  onChange: (next: PriorityId[]) => void;
  /** Extra controls under a chosen priority, such as the finer soil and income choices. */
  renderDetail?: (id: PriorityId) => ReactNode;
  className?: string;
}

/**
 * Ordering of the five farmer priorities. Cards can be dragged, and every card has Move up / Move down buttons
 * so the order can be set with a keyboard or a screen reader. The result is the plain ordered list the Rank-Sum
 * engine already takes (`FarmerPriorities.order`); no percentages are asked for.
 */
export function PriorityOrder({ value, onChange, renderDetail, className }: PriorityOrderProps) {
  const [dragId, setDragId] = useState<PriorityId | null>(null);
  const [announce, setAnnounce] = useState("");
  const chosen = value.filter((id) => PRIORITY_IDS.includes(id));
  const rest = PRIORITY_IDS.filter((id) => !chosen.includes(id));
  const words = influenceWords(chosen);

  const set = (next: PriorityId[], message: string) => {
    onChange(next);
    setAnnounce(message);
  };
  const shift = (id: PriorityId, by: -1 | 1) => {
    const i = chosen.indexOf(id);
    const j = i + by;
    if (j < 0 || j >= chosen.length) return;
    set(move(chosen, i, j), `${PRIORITY_INFO[id].label} is now ${PLACE[j].toLowerCase()}.`);
  };
  const add = (id: PriorityId) => set([...chosen, id], `${PRIORITY_INFO[id].label} added as ${PLACE[chosen.length].toLowerCase()}.`);
  const remove = (id: PriorityId) => set(chosen.filter((x) => x !== id), `${PRIORITY_INFO[id].label} removed.`);
  const drop = (target: PriorityId) => {
    if (!dragId || dragId === target) return;
    const j = chosen.indexOf(target);
    set(move(chosen, chosen.indexOf(dragId), j), `${PRIORITY_INFO[dragId].label} is now ${PLACE[j].toLowerCase()}.`);
    setDragId(null);
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      {chosen.length > 0 ? (
        <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Your priorities, most important first">
          {chosen.map((id, i) => {
            const info = PRIORITY_INFO[id];
            return (
              <li
                key={id}
                draggable
                onDragStart={() => setDragId(id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(id)}
                className={cn("flex flex-col gap-2 rounded-md border bg-surface-raised p-3", dragId === id ? "border-field opacity-60" : "border-field")}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-field text-label font-semibold text-on-field" aria-hidden>{i + 1}</span>
                  <Icon name={info.icon} className="text-field" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-label font-semibold text-ink">{info.label}</span>
                    <span className="block text-body-sm text-ink-muted">{info.help}</span>
                    {chosen.length > 1 ? <span className="mt-0.5 block text-source text-ink-muted">{PLACE[i]} place. {words[id]}.</span> : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    <button type="button" className="min-h-tap rounded-md border border-line-strong px-3 text-label text-ink hover:bg-surface-sunken disabled:opacity-40" aria-label={`Move up: ${info.label}`} disabled={i === 0} onClick={() => shift(id, -1)}>↑ Up</button>
                    <button type="button" className="min-h-tap rounded-md border border-line-strong px-3 text-label text-ink hover:bg-surface-sunken disabled:opacity-40" aria-label={`Move down: ${info.label}`} disabled={i === chosen.length - 1} onClick={() => shift(id, 1)}>↓ Down</button>
                    <button type="button" className="min-h-tap rounded-md px-3 text-label text-field hover:bg-field-soft" aria-label={`Remove: ${info.label}`} onClick={() => remove(id)}>Remove</button>
                  </span>
                </div>
                {renderDetail?.(id)}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="m-0 rounded-md border border-dashed border-line-strong p-3 text-body-sm text-ink-muted">Nothing chosen yet. Pick what matters, most important first. You can also skip this.</p>
      )}

      {rest.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-label text-ink">{chosen.length ? "Also add" : "Choose what matters"}</h3>
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {rest.map((id) => {
              const info = PRIORITY_INFO[id];
              return (
                <li key={id}>
                  <button type="button" onClick={() => add(id)} aria-label={`Add: ${info.label}`} className="flex min-h-tap w-full items-start gap-3 rounded-md border border-line-strong bg-surface-raised p-3 text-left hover:bg-surface-sunken">
                    <Icon name={info.icon} className="mt-0.5 text-ink-muted" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-label font-semibold text-ink">{info.label}</span>
                      <span className="block text-body-sm text-ink-muted">{info.help}</span>
                    </span>
                    <Icon name="add" className="mt-0.5 text-field" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="rounded-md border border-line bg-surface p-3" aria-live="polite">
        <h3 className="m-0 text-label text-ink">Your order</h3>
        <p className="m-0 mt-1 text-body-sm text-ink">{orderSummary(chosen)}</p>
      </div>
      <PriorityExplainer />
    </div>
  );
}
