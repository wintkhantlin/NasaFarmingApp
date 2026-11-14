import { copy } from "@/lib/copy/en";
import { cn } from "@/lib/cn";
import type { EvaluatedOption } from "@/lib/engine/compare";
import { stageWindows } from "@/lib/engine/season";
import { getCropById } from "@/lib/data/crops";
import { shortSlotName } from "@/lib/rotation-format";
import type { StageId } from "@/lib/types";

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const STAGE_TONE: Record<StageId, string> = { ini: "bg-field-soft", dev: "bg-field-soft", mid: "bg-field/20", late: "bg-field-soft" };

const dayNumber = (iso: string) => Date.parse(iso) / 86_400_000;

/** Left and width (0 to 1) of [from, to] inside calendar year `year`, or null when it does not touch it. */
function segment(year: number, from: string, to: string): { left: number; width: number } | null {
  const y0 = Date.UTC(year, 0, 1) / 86_400_000;
  const y1 = Date.UTC(year + 1, 0, 1) / 86_400_000;
  const a = Math.max(dayNumber(from), y0);
  const b = Math.min(dayNumber(to) + 1, y1);
  if (b <= a) return null;
  return { left: (a - y0) / (y1 - y0), width: (b - a) / (y1 - y0) };
}

/**
 * Planting, growth stages and harvest across the cycle, with rainy months shaded, gaps with no crop,
 * overlaps and possible low-cover periods. Dates are the planned dates: a calendar, not an observation.
 */
export function CropCalendar({ option, rainyMonths, className }: { option: EvaluatedOption; rainyMonths: number[]; className?: string }) {
  const slots = option.rotation.slots.filter((s) => s.kind !== "fallow");
  if (slots.length === 0) return null;
  const firstYear = Math.min(...slots.map((s) => Number(s.plantDate.slice(0, 4))));
  const lastYear = Math.max(...slots.map((s) => Number(s.harvestDate.slice(0, 4))));
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-end">
        <span />
        <div className="grid grid-cols-12 text-center text-source text-ink-muted" aria-hidden="true">
          {MONTH_INITIALS.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      </div>
      {years.map((year) => (
        <div key={year} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center">
          <span className="tabular font-mono text-source text-ink-muted">{year}</span>
          <div className="relative h-12 overflow-hidden rounded-sm bg-surface-raised">
            <div className="absolute inset-0 grid grid-cols-12" aria-hidden="true">
              {MONTH_INITIALS.map((_, i) => (
                <span key={i} className={cn("border-line", i > 0 && "border-l", rainyMonths.includes(i + 1) && "bg-water-soft")} />
              ))}
            </div>
            {option.structure.gaps.map((g) => {
              const seg = segment(year, g.from, g.to);
              if (!seg) return null;
              const low = option.lowCover.find((l) => l.gap.from === g.from && l.label === "possible-low-cover");
              return (
                <span
                  key={`${g.from}-${year}`}
                  title={low ? low.text : copy.calendar.gap}
                  className="absolute bottom-0 flex h-3 items-center justify-center border-t border-dashed border-line-strong bg-surface-sunken text-source text-ink-muted"
                  style={{ left: `${seg.left * 100}%`, width: `${seg.width * 100}%` }}
                >
                  {low && seg.width > 0.12 ? "low cover?" : null}
                </span>
              );
            })}
            {slots.map((s) => {
              const seg = segment(year, s.plantDate, s.harvestDate);
              if (!seg) return null;
              const crop = s.cropId ? getCropById(s.cropId) : undefined;
              const stages = crop ? stageWindows(crop, s.plantDate, s.harvestDate) : [];
              return (
                <span
                  key={`${s.id}-${year}`}
                  className="absolute top-1 flex h-8 min-w-0 items-center overflow-hidden rounded-sm border border-field px-1.5 text-body-sm text-ink"
                  style={{ left: `${seg.left * 100}%`, width: `${seg.width * 100}%` }}
                >
                  {stages.map((st) => {
                    const total = dayNumber(s.harvestDate) - dayNumber(s.plantDate) + 1;
                    const len = dayNumber(st.to) - dayNumber(st.from) + 1;
                    return (
                      <span
                        key={st.id}
                        aria-hidden="true"
                        title={copy.calendar.stageLabel[st.id]}
                        className={cn("absolute inset-y-0 border-r border-field/30", STAGE_TONE[st.id])}
                        style={{ left: `${((dayNumber(st.from) - dayNumber(s.plantDate)) / total) * 100}%`, width: `${(len / total) * 100}%` }}
                      />
                    );
                  })}
                  <span className="relative truncate">{shortSlotName(s)}</span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-source text-ink-muted">
        <li>{copy.calendar.legendCrop}: stages shaded, flowering darker</li>
        <li>{copy.calendar.legendGap}</li>
        <li>{copy.calendar.legendRain}</li>
      </ul>
      {option.overlaps.length > 0 ? (
        <p className="m-0 text-body-sm text-heat">{option.overlaps.map((o) => copy.calendar.overlap(o.days)).join(" ")}</p>
      ) : null}
    </div>
  );
}
