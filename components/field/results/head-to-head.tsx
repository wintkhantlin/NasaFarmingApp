import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { OptionRef, VerdictRow } from "@/lib/plan/results-model";

/** Share of checked past seasons with no rain or heat stress, or null when none could be checked. */
export const goodShare = (r: VerdictRow) => (r.good !== null && r.known ? r.good / r.known : null);
export const incomeMid = (r: VerdictRow) => (r.income ? (r.income[0] + r.income[1]) / 2 : null);

/** The id of the one row with the strictly best value, or null when there is no clear winner (ties, or too little data). */
export function uniqueBest(rows: VerdictRow[], value: (r: VerdictRow) => number | null, better: "high" | "low"): string | null {
  const scored = rows.map((r) => ({ id: r.optionId, v: value(r) })).filter((x): x is { id: string; v: number } => x.v !== null);
  if (scored.length < 2) return null;
  const target = better === "high" ? Math.max(...scored.map((x) => x.v)) : Math.min(...scored.map((x) => x.v));
  const winners = scored.filter((x) => x.v === target);
  return winners.length === 1 ? winners[0].id : null;
}

const millions = (n: number) => (Math.abs(n) >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : Math.round(n).toLocaleString());
const cleanCrop = (c: string) => c.replace(/\s*\(.*\)\s*$/, "");

/** Label column, bar, value: the value sits under the bar on a phone and at the row's end from 40rem. */
const LANE = "grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)_8.5rem]";

function Lane({ option, winner, value, children }: { option: OptionRef | undefined; winner: boolean; value: ReactNode; children: ReactNode }) {
  return (
    <li className={LANE}>
      <span className="row-span-2 flex min-w-0 flex-col sm:row-span-1">
        <span className={cn("flex items-center gap-1 text-body-sm font-medium [overflow-wrap:anywhere]", winner ? "font-semibold text-ink" : "text-ink")}>
          {winner ? <Icon name="check" size={14} strokeWidth={2.8} className="shrink-0 text-accent-text" aria-label="Ahead on this measure" /> : null}
          {option?.name}
        </span>
        {option && option.crops.length > 0 ? (
          <span className="text-body-sm text-ink-muted [overflow-wrap:anywhere]">{option.crops.map(cleanCrop).join(", ")}</span>
        ) : null}
      </span>
      <span className="min-w-0">{children}</span>
      <span className={cn("tabular col-start-2 text-body-sm sm:col-start-3 sm:text-right", winner ? "font-semibold text-ink" : "text-ink-muted")}>{value}</span>
    </li>
  );
}

function Measure({ title, direction, children }: { title: string; direction: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="m-0 text-body-sm font-semibold text-ink">{title}</h4>
        <span className="text-body-sm text-ink-muted">{direction}</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">{children}</ul>
    </div>
  );
}

/** A bar on a shared track. It is drawn at full size; a CSS-only grow plays on first paint, so the figure is there without scripting or motion. */
function Track({ children }: { children?: ReactNode }) {
  return <span aria-hidden className="relative block h-3 overflow-hidden rounded-pill bg-surface-sunken">{children}</span>;
}

/**
 * The season replay scoreboard: every plan raced on one shared scale per measure, so the gap
 * between plans is seen before it is read. Every bar keeps its number beside it.
 */
export function HeadToHead({ rows, options, period }: { rows: VerdictRow[]; options: OptionRef[]; period: string }) {
  if (rows.length < 2) return null;
  const optionOf = (id: string) => options.find((o) => o.id === id);

  const bestGood = uniqueBest(rows, goodShare, "high");
  const bestGap = uniqueBest(rows, (r) => r.gapMm, "low");
  const bestIncome = uniqueBest(rows, incomeMid, "high");

  const maxGap = Math.max(1, ...rows.map((r) => r.gapMm ?? 0));
  const lows = rows.flatMap((r) => (r.income ? [r.income[0]] : []));
  const highs = rows.flatMap((r) => (r.income ? [r.income[1]] : []));
  const axisMin = lows.length ? Math.min(0, ...lows) : 0;
  const axisMax = highs.length ? Math.max(...highs) : 1;
  const at = (n: number) => ((n - axisMin) / (axisMax - axisMin || 1)) * 100;

  return (
    <section aria-labelledby="scoreboard-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id="scoreboard-title" className="m-0 text-headline text-ink">
          How each plan did
        </h3>
        <p className="m-0 max-w-measure text-body-sm text-ink-muted">{period}</p>
      </div>

      <Measure title="Good seasons" direction="More is better">
        {rows.map((r) => (
          <Lane key={r.optionId} option={optionOf(r.optionId)} winner={r.optionId === bestGood} value={r.goodText}>
            {r.good !== null && r.known ? (
              <span aria-hidden className="flex gap-1">
                {Array.from({ length: r.known }, (_, i) => (
                  <span
                    key={i}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className={cn(
                      "h-3 min-w-0 flex-1 rounded-sm",
                      i < r.good! ? cn("fs-fade", r.optionId === bestGood ? "bg-healthy" : "bg-healthy/50") : "bg-surface-sunken",
                    )}
                  />
                ))}
              </span>
            ) : (
              <Track />
            )}
          </Lane>
        ))}
      </Measure>

      <Measure title="Water gap" direction="Less is better">
        {rows.map((r) => (
          <Lane key={r.optionId} option={optionOf(r.optionId)} winner={r.optionId === bestGap} value={r.gapText}>
            <Track>
              {r.gapMm !== null ? (
                <span
                  className={cn("fs-grow absolute inset-y-0 left-0 min-w-1.5 rounded-pill", r.optionId === bestGap ? "bg-water" : "bg-water/45")}
                  style={{ width: `${(r.gapMm / maxGap) * 100}%` }}
                />
              ) : null}
            </Track>
          </Lane>
        ))}
      </Measure>

      <Measure title="Income range" direction="Higher is better">
        {rows.map((r) => (
          <Lane key={r.optionId} option={optionOf(r.optionId)} winner={r.optionId === bestIncome} value={r.income ? `${millions(r.income[0])} to ${millions(r.income[1])}` : r.incomeText}>
            <Track>
              {r.income ? (
                <>
                  <span
                    className={cn("fs-grow absolute inset-y-0 rounded-pill", r.optionId === bestIncome ? "bg-field" : "bg-field/40")}
                    style={{ left: `${at(r.income[0])}%`, width: `${at(r.income[1]) - at(r.income[0])}%` }}
                  />
                </>
              ) : null}
            </Track>
          </Lane>
        ))}
        <li aria-hidden className={LANE}>
          <span className="col-start-2 flex justify-between gap-2 text-body-sm text-ink-muted tabular">
            <span>{millions(axisMin)}</span>
            <span className="hidden text-center sm:inline">MMK per hectare, after listed costs</span>
            <span>{millions(axisMax)}</span>
          </span>
        </li>
      </Measure>
    </section>
  );
}
