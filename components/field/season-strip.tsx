"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { knownCount, stressedCount, type StripYear } from "@/lib/engine/strip";
import { useFieldsStore } from "@/lib/store/fields-store";
import type { Field, Recall } from "@/lib/types";

const ANSWERS: Array<{ value: Recall["answer"]; label: string }> = [
  { value: "dry", label: "Dry" },
  { value: "normal", label: "Normal" },
  { value: "wet", label: "Wet" },
  { value: "not-sure", label: "Don't know" },
];

/** Seasons as two rows of five full years. Tap a year you remember; the data's label shows only after you answer. */
export function SeasonStrip({ strip, field }: { strip: StripYear[]; field: Field }) {
  const update = useFieldsStore((s) => s.update);
  const [open, setOpen] = useState<number | null>(null);
  const recall = field.recall ?? [];
  const answerFor = (y: number) => recall.find((r) => r.year === y)?.answer;

  const save = async (year: number, answer: Recall["answer"]) => {
    await update(field.id, { recall: [...recall.filter((r) => r.year !== year), { year, answer }] });
  };

  const sel = strip.find((s) => s.year === open);
  const mine = open ? answerFor(open) : undefined;
  const dataWord = (s: StripYear) => (s.stressed === null ? "not known" : s.stressed ? "short of rain or hot at a sensitive stage" : "no stress found");

  return (
    <Panel as="section" aria-labelledby="strip-title" className="flex flex-col gap-3 p-4 sm:p-5">
      <PanelHeader id="strip-title" as="h3" title="Tap a year you remember" description="Past seasons at village scale. Not a forecast." />
      {knownCount(strip) > 0 ? (
        <p className="m-0 text-body text-ink">
          <strong className="font-semibold">{stressedCount(strip)} of {knownCount(strip)}</strong> past seasons were short of rain or too hot.
        </p>
      ) : null}
      <ol className="m-0 grid list-none grid-cols-5 gap-1.5 p-0 sm:gap-2">
        {strip.map((s) => (
          <li key={s.year} className="min-w-0">
            <button
              type="button"
              aria-pressed={open === s.year}
              onClick={() => setOpen(open === s.year ? null : s.year)}
              className={cn(
                "relative flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border px-0.5 py-1.5 transition-colors",
                s.stressed === true && "border-stress/40 bg-stress-bg text-stress",
                s.stressed === false && "border-line bg-surface text-ink",
                s.stressed === null && "border-dashed border-unknown-border bg-unknown-bg text-unknown-text",
                open === s.year && "ring-2 ring-field ring-offset-1",
              )}
            >
              <span className="tabular font-mono text-body-sm font-semibold leading-none">{s.year}</span>
              {s.stressed === true ? (
                <Icon name="close" size={16} strokeWidth={2.6} aria-hidden />
              ) : s.stressed === false ? (
                <Icon name="done" size={16} strokeWidth={2.6} className="text-healthy" aria-hidden />
              ) : (
                <span aria-hidden className="text-body-sm font-semibold leading-4">?</span>
              )}
              <span className="sr-only">{s.stressed === true ? "stressed. Rain fell short or heat at a sensitive stage" : s.stressed === null ? "not known. Data missing" : "no stress found"}</span>
              {answerFor(s.year) ? <span aria-label="You answered" className="absolute right-1 top-1 size-1.5 rounded-full bg-field" /> : null}
            </button>
          </li>
        ))}
      </ol>
      <ul aria-label="What the marks mean" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-source text-ink-muted">
        <li className="flex items-center gap-1.5">
          <Icon name="close" size={14} strokeWidth={2.6} className="text-stress" aria-hidden />
          Short of rain or too hot
        </li>
        <li className="flex items-center gap-1.5">
          <Icon name="done" size={14} strokeWidth={2.6} className="text-healthy" aria-hidden />
          No problem found
        </li>
        {strip.some((s) => s.stressed === null) ? (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="font-semibold text-unknown-text">?</span>
            No data
          </li>
        ) : null}
      </ul>
      {open && sel ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-body text-ink">How was {open} at your field?</p>
          <div role="group" aria-label={`How was ${open}`} className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {ANSWERS.map((a) => (
              <button
                key={a.value}
                type="button"
                aria-pressed={mine === a.value}
                onClick={() => void save(open, a.value)}
                className={cn("flex min-h-tap items-center justify-center rounded-md border px-3 text-label text-center", mine === a.value ? "border-field bg-field-soft text-ink" : "border-line bg-surface text-ink")}
              >
                {a.label}
              </button>
            ))}
          </div>
          {mine ? (
            <p className="m-0 text-body-sm text-ink-muted">
              You told us {open} was {mine === "not-sure" ? "not remembered" : mine}. The data shows {dataWord(sel)} at village scale.
              {mine === "dry" && sel.stressed === false ? " These disagree. Both are shown; neither is overruled." : ""}
              {mine === "wet" && sel.stressed === true ? " These disagree. Both are shown; neither is overruled." : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

/** A small read-only row of past seasons for one option, so options can be compared at a glance. Tapping a year to recall it stays in the full strip. */
export function SeasonStripMini({ strip }: { strip: StripYear[] }) {
  const known = knownCount(strip);
  if (strip.length === 0) return null;
  return (
    <div className="@container flex flex-col gap-1">
      <p className="m-0 text-source text-ink-muted">
        {known > 0
          ? `${stressedCount(strip)} of ${known} past seasons short of rain or too hot`
          : "Past-season stress not known"}
      </p>
      <ol aria-label="Past seasons" className="m-0 grid list-none grid-cols-5 gap-1 p-0 @sm:grid-cols-10">
        {strip.map((s) => (
          <li
            key={s.year}
            className={cn(
              "flex min-w-0 flex-col items-center gap-0.5 rounded-sm border px-0.5 py-1",
              s.stressed === true && "border-stress/40 bg-stress-bg text-stress",
              s.stressed === false && "border-line bg-surface text-ink",
              s.stressed === null && "border-dashed border-unknown-border bg-unknown-bg text-unknown-text",
            )}
          >
            <span className="tabular font-mono text-source leading-none">{s.year}</span>
            {s.stressed === true ? (
              <Icon name="close" size={12} strokeWidth={2.6} aria-hidden />
            ) : s.stressed === false ? (
              <Icon name="done" size={12} strokeWidth={2.6} className="text-healthy" aria-hidden />
            ) : (
              <span aria-hidden className="text-source font-semibold leading-3">?</span>
            )}
            <span className="sr-only">{s.stressed === true ? "short of rain or too hot" : s.stressed === null ? "not known" : "no stress found"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
