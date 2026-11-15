import type { ReactNode } from "react";
import { Bilingual } from "@/components/ui/bilingual";
import { Disclosure } from "@/components/ui/disclosure";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { OptionRef, VerdictRow } from "@/lib/plan/results-model";
import { goodShare, incomeMid } from "@/components/field/results/head-to-head";

/**
 * A three-step scale a farmer can read without numbers: Good, Fair or Risky.
 * Every step is an icon plus a word plus filled bars, never colour alone.
 */
export type Level = "good" | "fair" | "risky" | "unknown";

// TODO native review: Burmese wording for the scale words
const LEVELS: Record<Level, { word: string; my: string; icon: IconName; bars: 0 | 1 | 2 | 3; tone: string; bar: string }> = {
  good: { word: "Good", my: "ကောင်း", icon: "success", bars: 3, tone: "text-healthy", bar: "bg-healthy" },
  fair: { word: "Fair", my: "အသင့်အတင့်", icon: "alert", bars: 2, tone: "text-drought", bar: "bg-drought" },
  risky: { word: "Risky", my: "အန္တရာယ်ရှိ", icon: "warning", bars: 1, tone: "text-heat", bar: "bg-heat" },
  unknown: { word: "Not known", my: "မသိရသေး", icon: "help", bars: 0, tone: "text-unknown-text", bar: "bg-unknown-text" },
};

/** One rating: icon, word, three bars. `detail` is read aloud only; the numbers live in the disclosure. */
export function Rating({ level, detail, className }: { level: Level; detail?: string; className?: string }) {
  const l = LEVELS[level];
  return (
    <span className={cn("flex min-w-0 flex-col items-start gap-1", className)}>
      <span className="inline-flex items-center gap-1.5">
        <Icon name={l.icon} size={20} strokeWidth={2.4} className={cn("shrink-0", l.tone)} aria-hidden />
        <span className="text-body font-semibold text-ink">{l.word}</span>
      </span>
      <span lang="my" className="text-body-sm text-ink-muted">{l.my}</span>
      <span aria-hidden className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn("h-1.5 w-6 rounded-pill", level !== "unknown" && n <= l.bars ? l.bar : "bg-line-strong/60")} />
        ))}
      </span>
      {detail ? <span className="sr-only">{detail}</span> : null}
    </span>
  );
}

const EVIDENCE_LEVEL: Record<"strong" | "fair" | "weak", Level> = { strong: "good", fair: "fair", weak: "risky" };

/** How firm the answer is, as an icon plus words ("Fair evidence"). Not colour alone. */
export function EvidenceTag({ level, label }: { level: "strong" | "fair" | "weak"; label: string }) {
  const l = LEVELS[EVIDENCE_LEVEL[level]];
  return (
    <span className="inline-flex items-center gap-1.5 text-body-sm font-medium text-ink">
      <Icon name={l.icon} size={18} strokeWidth={2.4} className={cn("shrink-0", l.tone)} aria-hidden />
      {label}
    </span>
  );
}

/** Share of past seasons with no rain or heat stress: 7 in 10 is good, 4 in 10 is fair. */
export function weatherLevel(r: VerdictRow): Level {
  const share = goodShare(r);
  if (share === null) return "unknown";
  return share >= 0.7 ? "good" : share >= 0.4 ? "fair" : "risky";
}

/** Typical rain gap per crop: up to 100 mm is good, up to 250 mm is fair. */
export function gapLevel(mm: number | null): Level {
  if (mm === null) return "unknown";
  return mm <= 100 ? "good" : mm <= 250 ? "fair" : "risky";
}

export function waterLevel(r: VerdictRow): Level {
  return gapLevel(r.gapMm);
}

/** Return after listed costs: a range that can fall below zero is risky; otherwise within a quarter of the best is good. */
export function moneyLevel(r: VerdictRow, rows: VerdictRow[]): Level {
  const mid = incomeMid(r);
  if (mid === null || !r.income) return "unknown";
  if (r.income[0] < 0) return "risky";
  const best = Math.max(...rows.map((x) => incomeMid(x) ?? -Infinity));
  return best > 0 && mid >= best * 0.75 ? "good" : "fair";
}

const MEASURES: Array<{ id: "weather" | "water" | "money"; label: string; my: string; icon: IconName }> = [
  { id: "weather", label: "Weather", my: "ရာသီဥတု", icon: "rain" },
  { id: "water", label: "Water", my: "ရေ", icon: "water" },
  { id: "money", label: "Money", my: "ငွေကြေး", icon: "price" },
];

function PickBadge() {
  return (
    <span className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-pill bg-field px-2.5 text-body-sm font-semibold text-on-field">
      <Icon name="check" size={14} strokeWidth={2.8} aria-hidden />
      Try this first
    </span>
  );
}

/**
 * Every plan on one three-step scale, side by side. A farmer reads icon + word per plan;
 * the exact figures are one tap away in "Numbers behind these ratings".
 */
export function PlanScale({
  rows,
  options,
  bestId,
  children,
}: {
  rows: VerdictRow[];
  options: OptionRef[];
  bestId?: string;
  /** The exact figures, shown in the disclosure under the scale. */
  children?: ReactNode;
}) {
  if (rows.length === 0) return null;
  const optionOf = (id: string) => options.find((o) => o.id === id);
  const levels = (r: VerdictRow): Record<(typeof MEASURES)[number]["id"], Level> => ({
    weather: weatherLevel(r),
    water: waterLevel(r),
    money: moneyLevel(r, rows),
  });
  const details = (r: VerdictRow) => ({
    weather: r.known ? `${r.goodText} past seasons had no rain or heat stress.` : "Past seasons could not be checked.",
    water: r.gapMm !== null ? `Typical rain gap per crop is ${r.gapText}.` : "Rain gap is not known.",
    money: r.income ? `Return after costs is ${r.incomeText} MMK per hectare.` : "Return is not known.",
  });

  return (
    <section aria-labelledby="plan-scale-title" className="flex flex-col gap-2">
      <h3 id="plan-scale-title" className="m-0 text-headline text-ink">
        <Bilingual en="How each plan looks" my="အစီအစဉ်တစ်ခုချင်း အခြေအနေ" />
      </h3>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => {
          const best = r.optionId === bestId;
          const lv = levels(r);
          const d = details(r);
          const crops = optionOf(r.optionId)?.crops.map((c) => c.replace(/\s*\(.*\)\s*$/, "")) ?? [];
          return (
            <li
              key={r.optionId}
              aria-label={`${r.name}${best ? ", try this first" : ""}`}
              className={cn("flex flex-col gap-3 border-t border-line py-4 first:border-0", best && "-mx-3 rounded-md border-0 bg-field-soft/60 px-3")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-body font-semibold text-ink [overflow-wrap:anywhere]">{r.name}</span>
                  {r.isYours && crops.length > 0 ? <span className="text-body-sm text-ink-muted">{crops.join(", ")}</span> : null}
                </div>
                {best ? <PickBadge /> : null}
              </div>
              <dl className="m-0 grid grid-cols-3 gap-x-3 gap-y-2">
                {MEASURES.map((m) => (
                  <div key={m.id} className="flex min-w-0 flex-col gap-1.5">
                    <dt className="flex items-center gap-1 text-body-sm text-ink-muted">
                      <Icon name={m.icon} size={16} aria-hidden />
                      {m.label}
                    </dt>
                    <dd className="m-0">
                      <Rating level={lv[m.id]} detail={d[m.id]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
      <Disclosure title="Numbers and how Good, Fair and Risky are worked out">
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink-muted">
          <li>Weather: Good when 7 or more in 10 past seasons had no rain or heat stress, Fair from 4 to 6, Risky below that.</li>
          <li>Water: Good when the typical rain gap per crop is 100 mm or less, Fair up to 250 mm, Risky above that.</li>
          <li>Money: Risky when the estimated return after listed costs can fall below zero. Otherwise Good when within a quarter of the best plan, Fair when lower.</li>
          <li>These describe past seasons. They are not a forecast.</li>
        </ul>
        {children}
      </Disclosure>
    </section>
  );
}
