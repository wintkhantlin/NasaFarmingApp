"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeftGlyph, PrintGlyph } from "@/components/ui/icons";
import { JudgmentNote } from "@/components/ui/judgment-note";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy/en";
import { generateStrategies, type EvaluatedOption } from "@/lib/engine/strategies";
import { formatPoint } from "@/lib/geo/format";
import { sequenceText, shortSlotName } from "@/lib/rotation-format";
import { getCachedConditions } from "@/lib/store/data-cache";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";

const ASSUMED_RAIN_MM = 720;
const signed = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}`;

/** Questions an adviser can answer, taken from what the options themselves flagged. */
function adviserQuestions(options: EvaluatedOption[]): string[] {
  const [now, ...alts] = options;
  const nowCrops = new Set(now.rotation.slots.map((s) => s.cropId));
  const questions: string[] = [];

  for (const alt of alts) {
    const fresh = [
      ...new Set(alt.rotation.slots.filter((s) => s.kind !== "fallow" && !nowCrops.has(s.cropId)).map(shortSlotName)),
    ];
    if (fresh.length > 0) {
      questions.push(`Which ${fresh.join(", ")} varieties do well in our district, and where can I get the seed?`);
    }
  }
  for (const alt of alts) {
    if (alt.risks[0]) questions.push(`${alt.risks[0].action}`);
    if (alt.unknowns[0]) questions.push(`${alt.unknowns[0]}: what do you see locally?`);
  }
  questions.push("Should I get a full soil nutrient test before I change how much nitrogen I apply?");
  return [...new Set(questions)].slice(0, 6);
}

export function ReportView({ fieldId }: { fieldId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);
  const [readRainMm, setReadRainMm] = useState<number | null>(null);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  useEffect(() => {
    let mounted = true;
    void getCachedConditions(fieldId).then((c) => {
      if (mounted) setReadRainMm(c?.annualRainMm ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [fieldId]);

  const comparison = useMemo(
    () =>
      field && rotations[0] && rotations[0].slots.length > 0
        ? generateStrategies(field, rotations[0], readRainMm ?? ASSUMED_RAIN_MM)
        : null,
    [field, rotations, readRainMm],
  );

  if (status === "idle" || status === "loading") {
    return (
      <div role="status" aria-label={copy.home.loading} className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!field) {
    return (
      <EmptyState title="Field not found" body="This field isn't saved in this browser. Please return to your fields list.">
        <Link href="/" className={buttonClass("primary")}>
          Back to your fields
        </Link>
      </EmptyState>
    );
  }

  if (!comparison) {
    return (
      <EmptyState title="Nothing to report yet" body="The report compares your rotation with other options, so it needs your rotation first.">
        <Link href={`/fields/${field.id}/rotation`} className={buttonClass("primary")}>
          Add your rotation
        </Link>
      </EmptyState>
    );
  }

  const options = [comparison.current, ...comparison.alternatives];
  const questions = adviserQuestions(options);

  const specs: Array<[string, string]> = [
    ["Location", formatPoint(field.centroid)],
    ["Area", field.areaHa === null ? copy.home.pinOnly : copy.home.area(field.areaHa)],
    ["Water", copy.irrigation[field.irrigation]],
    ["Soil", field.soilOverride?.texture ? `${field.soilOverride.texture}, from a soil test` : "From the regional soil map"],
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 print:hidden">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            href={`/fields/${field.id}/compare`}
            className="inline-flex min-h-tap items-center gap-1.5 text-body-sm text-ink-muted no-underline hover:text-ink hover:underline"
          >
            <ArrowLeftGlyph />
            {copy.report.backToCompare}
          </Link>
          <h1 className="text-title text-ink sm:text-display">{copy.report.title}</h1>
        </div>
        <Button variant="primary" onClick={() => window.print()} className="max-sm:w-full">
          <PrintGlyph />
          {copy.report.printButton}
        </Button>
      </div>

      <JudgmentNote className="print:hidden" />

      <article
        aria-label={`${copy.report.title}: ${field.name}`}
        className="flex flex-col gap-7 rounded-lg border border-line bg-surface-raised p-5 sm:p-8 print:gap-5 print:rounded-none print:border-0 print:bg-transparent print:p-0"
      >
        <header className="flex flex-col gap-2 border-b border-line pb-5">
          <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-4 text-body-sm text-ink-muted">
            <span>{copy.app.name}</span>
            <time className="tabular font-mono text-source">
              {new Date().toLocaleDateString(undefined, { dateStyle: "long" })}
            </time>
          </p>
          <h2 className="text-balance text-display text-ink">{field.name}</h2>
          <p className="m-0 max-w-measure text-body text-ink-muted">{copy.report.subtitle}</p>
        </header>

        <section aria-labelledby="r-field" className="flex flex-col gap-3">
          <h3 id="r-field" className="text-headline text-ink">
            {copy.report.fieldSummary}
          </h3>
          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {specs.map(([term, value]) => (
              <div key={term} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-body-sm text-ink-muted">{term}</dt>
                <dd className="tabular m-0 break-words font-mono text-data text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="r-options" className="flex flex-col gap-3">
          <h3 id="r-options" className="text-headline text-ink">
            {copy.report.rotationComparison}
          </h3>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {options.map((opt, i) => (
              <li key={opt.id} className="flex break-inside-avoid flex-col gap-2 rounded-md border border-line bg-surface p-4 print:bg-transparent">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="m-0 flex items-center gap-2.5 text-label text-ink">
                    <span
                      aria-hidden="true"
                      className="tabular grid size-6 place-items-center rounded-pill border border-line-strong font-mono text-source"
                    >
                      {i + 1}
                    </span>
                    {i === 0 ? copy.compare.yourRotationTab : opt.label}
                  </p>
                  <p className="m-0 text-body-sm text-ink-muted">{opt.badge}</p>
                </div>
                <p className="m-0 text-body-sm text-ink-muted">{opt.reason}</p>
                <dl className="m-0 grid gap-x-6 gap-y-1 text-body-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                  <dt className="text-ink-muted">Crops in order</dt>
                  <dd className="m-0 text-ink">{sequenceText(opt.rotation, " → ")}</dd>
                  <dt className="text-ink-muted">Nitrogen balance</dt>
                  <dd className="tabular m-0 font-mono text-ink">{signed(opt.estimatedNBalanceKgHa)} kg/ha</dd>
                  <dt className="text-ink-muted">Drought resilience</dt>
                  <dd className="m-0 text-ink">{opt.waterResilience}</dd>
                </dl>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="r-questions" className="flex break-inside-avoid flex-col gap-2 border-t border-line pt-5">
          <h3 id="r-questions" className="text-headline text-ink">
            {copy.report.adviserQuestionsTitle}
          </h3>
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-body-sm text-ink">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </section>

        <footer className="flex flex-col gap-1 border-t border-line pt-4 text-source text-ink-muted">
          <p className="m-0">{copy.judgment.short} {copy.judgment.long}</p>
          <p className="m-0">{copy.report.footerNotice}</p>
          <p className="tabular m-0 font-mono">
            Data: NASA POWER 0.5° long-term means; ISRIC SoilGrids v2 250 m (not NASA).
            {readRainMm === null ? ` Rainfall assumed at ${ASSUMED_RAIN_MM} mm a year, not read for this field.` : ""}
          </p>
        </footer>
      </article>

      <div className="flex justify-end print:hidden">
        <Button variant="secondary" onClick={() => window.print()} className="max-sm:w-full">
          <PrintGlyph />
          {copy.report.printButton}
        </Button>
      </div>
    </>
  );
}
