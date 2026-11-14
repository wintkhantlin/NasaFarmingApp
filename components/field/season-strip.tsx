"use client";

import { useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import type { StripYear } from "@/lib/engine/strip";
import { useFieldsStore } from "@/lib/store/fields-store";
import type { Field, Recall } from "@/lib/types";
import { Button, ButtonRow, Pressable } from "@/components/ui/button";

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
      <ol className="m-0 grid list-none grid-cols-5 gap-2 p-0">
        {strip.map((s) => (
          <li key={s.year}>
            <Pressable
              aria-pressed={open === s.year}
              onClick={() => setOpen(open === s.year ? null : s.year)}
              className={cn(
                "relative flex min-h-tap w-full flex-col items-center justify-center rounded-sm border px-1 py-2 text-label tabular",
                s.stressed === true && "border-transparent bg-stress text-white",
                s.stressed === false && "border-transparent bg-surface-sunken text-ink",
                s.stressed === null && "border border-dashed border-unknown-border bg-unknown-bg text-unknown-text",
                open === s.year && "outline outline-2 outline-offset-1 outline-field",
              )}
            >
              <span className="flex items-center gap-1">
                {s.year}
                {s.stressed === true ? <span aria-hidden>×</span> : s.stressed === null ? <span aria-hidden>?</span> : null}
              </span>
              <span className="sr-only">{s.stressed === true ? "stressed. Rain fell short or heat at a sensitive stage" : s.stressed === null ? "not known. Data missing" : "no stress found"}</span>
              {answerFor(s.year) ? <span aria-label="You answered" className="absolute bottom-1 right-1 size-1.5 rounded-full bg-ink" /> : null}
            </Pressable>
          </li>
        ))}
      </ol>
      {open && sel ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-body text-ink">How was {open} at your field?</p>
          <ButtonRow layout="wrap" role="group" aria-label={`How was ${open}`}>
            {ANSWERS.map((a) => (
              <Button key={a.value} variant="choice" aria-pressed={mine === a.value} onClick={() => void save(open, a.value)}>
                {a.label}
              </Button>
            ))}
          </ButtonRow>
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
