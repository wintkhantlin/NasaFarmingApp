"use client";

import { Icon } from "@/components/ui/icon";
import { usePick } from "@/components/shell/use-pick";
import { cn } from "@/lib/cn";
import { monthPartOf, type MonthPart } from "@/lib/plan/auto-dates";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_MY = ["ဇန်", "ဖေ", "မတ်", "ဧပြီ", "မေ", "ဇွန်", "ဇူ", "ဩ", "စက်", "အောက်", "နို", "ဒီ"];

const PARTS: Array<{ id: MonthPart; en: string; my: string; days: string }> = [
  { id: "early", en: "Early", my: "အစ", days: "1–10" },
  { id: "mid", en: "Middle", my: "အလယ်", days: "11–20" },
  { id: "late", en: "Late", my: "အကုန်", days: "21–end" },
];

/**
 * "When do you sow?" as two taps: a month, then early, middle or late in it.
 * Replaces typing or picking a calendar date. Months in the crop's usual sowing window are marked
 * with the word "Usual" (never colour alone). The harvest date follows from the crop's usual length.
 */
export function SowingPicker({
  cropName,
  plantDate,
  usualMonths,
  onPick,
}: {
  cropName: string;
  /** ISO date, or "" when none is set yet. */
  plantDate: string;
  usualMonths: number[];
  onPick: (month: number, part: MonthPart) => void;
}) {
  const pick = usePick();
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(plantDate);
  const month = hasDate ? Number(plantDate.slice(5, 7)) : 0;
  const part = hasDate ? monthPartOf(plantDate) : "mid";
  const names = (i: number) => pick(MONTHS_EN[i], MONTHS_MY[i]);

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="p-0 text-body font-semibold text-ink">
        {pick(`When do you sow ${cropName}?`, `${cropName} ကို ဘယ်အချိန် စိုက်မလဲ။`)}
      </legend>

      <div className="grid grid-cols-4 gap-2">
        {MONTHS_EN.map((_, i) => {
          const m = i + 1;
          const selected = month === m;
          const usual = usualMonths.includes(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={selected}
              aria-label={`${MONTHS_EN[i]}${usual ? ", usual month" : ""}`}
              onClick={() => onPick(m, part)}
              className={cn(
                "relative flex min-h-[52px] cursor-pointer flex-col items-center justify-center rounded-md border px-1 py-1 text-body-sm font-semibold transition-colors active:scale-[0.97]",
                selected
                  ? "border-field bg-field text-on-field"
                  : usual
                    ? "border-field/50 bg-field-soft text-ink hover:border-field"
                    : "border-line-strong bg-surface-raised text-ink hover:border-ink/40",
              )}
            >
              <span className="flex items-center gap-1">
                {selected ? <Icon name="done" size={15} strokeWidth={3} /> : null}
                {names(i)}
              </span>
              {usual ? (
                <span className={cn("text-source font-medium leading-tight", selected ? "text-on-field" : "text-field")}>
                  {pick("Usual", "ပုံမှန်")}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {usualMonths.length > 0 ? (
        <p className="m-0 flex items-center gap-1.5 text-body-sm text-ink-muted">
          <Icon name="sun" size={15} aria-hidden />
          {pick("Months marked Usual are when farmers here normally sow this crop.", "ပုံမှန်ဟု ဖော်ပြထားသော လများတွင် ဒေသခံတို့ ဤသီးနှံကို ပုံမှန်စိုက်ကြသည်။")}
        </p>
      ) : null}

      {month ? (
        <div role="group" aria-label={pick(`Which part of ${MONTHS_EN[month - 1]}?`, `${names(month - 1)} လ၏ ဘယ်အပိုင်းလဲ။`)} className="grid grid-cols-3 gap-2">
          {PARTS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={part === p.id}
              aria-label={`${p.en} ${MONTHS_EN[month - 1]}`}
              onClick={() => onPick(month, p.id)}
              className={cn(
                "flex min-h-tap cursor-pointer flex-col items-center justify-center rounded-md border px-2 py-1.5 text-body-sm font-semibold transition-colors active:scale-[0.98]",
                part === p.id ? "border-field bg-field text-on-field" : "border-line-strong bg-surface-raised text-ink hover:border-ink/40",
              )}
            >
              <span>{pick(p.en, p.my)}</span>
              <span className={cn("text-source font-normal", part === p.id ? "text-on-field" : "text-ink-muted")}>{p.days}</span>
            </button>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
