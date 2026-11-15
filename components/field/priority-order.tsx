"use client";

import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { priorityWeights } from "@/lib/engine/mcda";
import { usePick } from "@/components/shell/use-pick";
import { useAppCopy } from "@/lib/store/locale-store";
import type { PriorityId } from "@/lib/types";

export const PRIORITY_IDS: PriorityId[] = ["water", "soil", "income", "forage", "lower-inputs"];

const ICON: Record<PriorityId, IconName> = { water: "water", soil: "soil", income: "price", forage: "organic", "lower-inputs": "cost" };

/**
 * English names and one-line explanations. The name is the same one used on every other screen
 * (`profile.priority`), so one priority never has two names. What each one measures is what the ranking engine reads.
 */
export const PRIORITY_INFO: Record<PriorityId, { label: string; help: string; icon: IconName }> = Object.fromEntries(
  PRIORITY_IDS.map((id) => [id, { label: copy.profile.priority[id], help: copy.profile.priorityHelp[id], icon: ICON[id] }]),
) as Record<PriorityId, { label: string; help: string; icon: IconName }>;

/** The parts of the order copy the two plain helpers read, so English or Burmese text can be passed in. */
interface OrderText {
  counts: { most: string; lot: string; some: string; little: string };
  summaryNone: string;
  summaryOnly: (name: string) => string;
  summaryMany: (first: string, rest: string) => string;
}
type Names = Record<PriorityId, string>;

/** Words for how much a place counts, taken from the engine's own weights so the text cannot drift from the ranking. */
export function influenceWords(order: PriorityId[], t: OrderText = copy.profile.order): Record<string, string> {
  const w = priorityWeights({ order, weights: {} });
  if (!w || order.length === 0) return {};
  const max = w[order[0]] ?? 0;
  const out: Record<string, string> = {};
  order.forEach((id, i) => {
    const share = (w[id] ?? 0) / max;
    out[id] = i === 0 ? t.counts.most : share >= 0.6 ? t.counts.lot : share >= 0.3 ? t.counts.some : t.counts.little;
  });
  return out;
}

/** One sentence per situation, stating the same rule the engine applies. */
export function orderSummary(order: PriorityId[], t: OrderText = copy.profile.order, names: Names = copy.profile.priority): string {
  if (order.length === 0) return t.summaryNone;
  const lower = order.map((id) => names[id].toLowerCase());
  if (order.length === 1) return t.summaryOnly(lower[0]);
  return t.summaryMany(names[order[0]], lower.slice(1).join(", then "));
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
  const t = useAppCopy().profile.order;
  return (
    <div className={cn("flex flex-col gap-1 rounded-md bg-surface-sunken p-3 text-body-sm text-ink-muted", className)}>
      <p className="m-0"><strong className="font-semibold text-ink">{t.explainerTitle}</strong> {t.explainer1}</p>
      <p className="m-0">{t.explainer2}</p>
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
  const profile = useAppCopy().profile;
  const t = profile.order;
  const names = profile.priority;
  const info = (id: PriorityId) => ({ label: names[id], help: profile.priorityHelp[id], icon: ICON[id] });
  const place = (i: number) => t.places[i].toLowerCase();
  const [dragId, setDragId] = useState<PriorityId | null>(null);
  const [announce, setAnnounce] = useState("");
  const chosen = value.filter((id) => PRIORITY_IDS.includes(id));
  const rest = PRIORITY_IDS.filter((id) => !chosen.includes(id));
  const words = influenceWords(chosen, t);

  const set = (next: PriorityId[], message: string) => {
    onChange(next);
    setAnnounce(message);
  };
  const shift = (id: PriorityId, by: -1 | 1) => {
    const i = chosen.indexOf(id);
    const j = i + by;
    if (j < 0 || j >= chosen.length) return;
    set(move(chosen, i, j), t.nowPlace(names[id], place(j)));
  };
  const add = (id: PriorityId) => set([...chosen, id], t.addedAs(names[id], place(chosen.length)));
  const remove = (id: PriorityId) => set(chosen.filter((x) => x !== id), t.markedNot(names[id]));
  const drop = (target: PriorityId) => {
    if (!dragId || dragId === target) return;
    const j = chosen.indexOf(target);
    set(move(chosen, chosen.indexOf(dragId), j), t.nowPlace(names[dragId], place(j)));
    setDragId(null);
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      {chosen.length > 0 ? (
        <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-label={t.listLabel}>
          {chosen.map((id, i) => {
            const row = info(id);
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-field text-label font-semibold text-on-field" aria-hidden>{i + 1}</span>
                    <Icon name={row.icon} className="mt-1 shrink-0 text-field" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-label font-semibold text-ink">{row.label}</span>
                      <span className="block text-body-sm text-ink-muted">{row.help}</span>
                      {chosen.length > 1 ? <span className="mt-0.5 block text-body-sm text-ink-muted">{t.placeLine(t.places[i], words[id])}</span> : null}
                    </span>
                  </div>
                  <span className="grid grid-cols-3 gap-1 sm:ml-auto sm:flex sm:shrink-0 sm:flex-wrap sm:items-center">
                    <button type="button" className="inline-flex min-h-tap items-center gap-1 rounded-md border border-line-strong px-3 text-label text-ink hover:bg-surface-sunken disabled:opacity-40" aria-label={t.moveUpAria(row.label)} disabled={i === 0} onClick={() => shift(id, -1)}><Icon name="up" size={16} aria-hidden />{t.up}</button>
                    <button type="button" className="inline-flex min-h-tap items-center gap-1 rounded-md border border-line-strong px-3 text-label text-ink hover:bg-surface-sunken disabled:opacity-40" aria-label={t.moveDownAria(row.label)} disabled={i === chosen.length - 1} onClick={() => shift(id, 1)}><Icon name="down" size={16} aria-hidden />{t.down}</button>
                    <button type="button" className="min-h-tap rounded-md px-2 text-label text-field hover:bg-field-soft sm:px-3" aria-label={t.notImportantAria(row.label)} onClick={() => remove(id)}>{t.notImportant}</button>
                  </span>
                </div>
                {renderDetail?.(id)}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="m-0 rounded-md border border-dashed border-line-strong p-3 text-body text-ink-muted">{t.empty}</p>
      )}

      {rest.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-label text-ink">{chosen.length ? t.alsoAdd : t.chooseWhat}</h3>
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {rest.map((id) => {
              const row = info(id);
              return (
                <li key={id}>
                  <button type="button" onClick={() => add(id)} aria-label={t.addAria(row.label)} className="flex min-h-tap w-full items-start gap-3 rounded-md border border-line-strong bg-surface-raised p-3 text-left hover:bg-surface-sunken">
                    <Icon name={row.icon} className="mt-0.5 text-ink-muted" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-label font-semibold text-ink">{row.label}</span>
                      <span className="block text-body-sm text-ink-muted">{row.help}</span>
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
        <h3 className="m-0 text-label text-ink">{t.yourOrder}</h3>
        <p className="m-0 mt-1 text-body text-ink">{orderSummary(chosen, t, names)}</p>
      </div>
      <PriorityExplainer />
    </div>
  );
}

export interface PriorityTilesProps {
  /** Chosen priorities, most important first (the order they were tapped). */
  value: PriorityId[];
  onChange: (next: PriorityId[]) => void;
  className?: string;
}

/**
 * The phone-first way to pick priorities. Each of the five is one big full-width tile (icon, name, one line).
 * Tap to include: the badge shows its place (1, 2, 3 in tap order, first counts most). Tap again to remove.
 * It reads and writes the same plain ordered list as PriorityOrder, so the saved shape does not change.
 */
export function PriorityTiles({ value, onChange, className }: PriorityTilesProps) {
  const profile = useAppCopy().profile;
  const t = profile.order;
  const names = profile.priority;
  const pick = usePick();
  const [announce, setAnnounce] = useState("");
  const chosen = value.filter((id) => PRIORITY_IDS.includes(id));

  const toggle = (id: PriorityId) => {
    if (chosen.includes(id)) {
      onChange(chosen.filter((x) => x !== id));
      setAnnounce(t.markedNot(names[id]));
    } else {
      onChange([...chosen, id]);
      setAnnounce(t.addedAs(names[id], t.places[chosen.length].toLowerCase()));
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="m-0 text-body-sm text-ink-muted">
        {pick("Tap what matters, most important first. The first one you tap counts most.", "အရေးကြီးသည်များကို အရေးကြီးဆုံးမှ စ၍ ထိပါ။ ပထမဆုံးထိသည်က အရေးအကြီးဆုံးဖြစ်ပါသည်။")}
      </p>
      {/* Screen readers hear the order after every tap; sighted farmers read it from the badges. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announce ? `${announce} ` : ""}
        {orderSummary(chosen, t, names)}
      </p>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {PRIORITY_IDS.map((id) => {
          const rank = chosen.indexOf(id) + 1;
          const on = rank > 0;
          return (
            <li key={id} className="min-w-0">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(id)}
                className={cn(
                  "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                  on ? "border-field bg-field-soft ring-1 ring-field" : "border-line-strong bg-surface-raised hover:bg-surface-sunken",
                )}
              >
                <Icon name={ICON[id]} size={24} className={cn("shrink-0", on ? "text-field" : "text-ink-muted")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-ink">{names[id]}</span>
                  <span className="block text-body-sm text-ink-muted">{profile.priorityHelp[id]}</span>
                </span>
                {on ? (
                  <span className="grid size-9 shrink-0 place-items-center rounded-pill bg-field text-body font-semibold text-on-field">
                    <span aria-hidden>{rank}</span>
                    <span className="sr-only">{`${pick("Priority", "ဦးစားပေး")} ${rank}`}</span>
                  </span>
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-pill border border-dashed border-line-strong text-ink-muted">
                    <Icon name="add" size={18} />
                    <span className="sr-only">{pick("Not chosen. Tap to add.", "မရွေးရသေးပါ။ ထည့်ရန် ထိပါ။")}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
