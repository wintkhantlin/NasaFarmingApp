"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { FieldPageHeader } from "@/components/field/field-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionBar } from "@/components/ui/action-bar";
import { Disclosure } from "@/components/ui/disclosure";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { compareRotations, type EvaluatedOption } from "@/lib/engine/compare";
import { useFieldAnalysis } from "@/lib/analysis/use-analysis";
import { regionName } from "@/lib/data/regions";
import { missingText, provenanceLine } from "@/lib/evidence/indicator";
import { formatPoint } from "@/lib/geo/format";
import { sequenceText, shortSlotName } from "@/lib/rotation-format";
import { useFieldRotations, useFieldsStore } from "@/lib/store/fields-store";
import { useLocaleStore } from "@/lib/store/locale-store";
import { formatArea } from "@/lib/units";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Questions an adviser can answer, taken from what the options themselves flagged as unknown or to check. */
function adviserQuestions(options: EvaluatedOption[]): string[] {
  const [now, ...alts] = options;
  const nowCrops = new Set(now.rotation.slots.map((s) => s.cropId));
  const questions: string[] = [];
  for (const alt of alts) {
    const fresh = [...new Set(alt.rotation.slots.filter((s) => s.kind !== "fallow" && !nowCrops.has(s.cropId)).map(shortSlotName))];
    if (fresh.length > 0) questions.push(`Which ${fresh.join(", ")} varieties do well in our district, and where can I get the seed?`);
  }
  for (const o of options) {
    for (const r of o.risks.filter((x) => x.kind === "local-review" || x.severity === "important")) questions.push(r.action);
    if (o.unknowns[0]) questions.push(`${o.unknowns[0]}: what do you see locally?`);
  }
  questions.push("Are the crop rules shown (temperature, pH, sowing window, Kc) right for the varieties used here?");
  questions.push("Should I get a soil test for pH, texture and drainage before I change what I plant?");
  return [...new Set(questions)].slice(0, 8);
}

export function ReportView({ fieldId }: { fieldId: string }) {
  const status = useFieldsStore((s) => s.status);
  const field = useFieldsStore((s) => s.fields.find((f) => f.id === fieldId));
  const rotations = useFieldRotations(fieldId);
  const load = useFieldsStore((s) => s.load);
  const loadRotations = useFieldsStore((s) => s.loadRotations);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (fieldId) void loadRotations(fieldId);
  }, [fieldId, loadRotations]);

  const analysis = useFieldAnalysis(field);
  const { engineData } = analysis;
  const areaUnit = useLocaleStore((s) => s.areaUnit);

  const localNotesList = useMemo(() => {
    if (!field?.localNotes) return [];
    return field.localNotes
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^\[(.*?)\]:\s*(.*)$/);
        if (match) {
          return { topic: match[1], text: match[2] };
        }
        return { topic: "Field note", text: line };
      });
  }, [field]);

  const comparison = useMemo(
    () => (engineData && rotations[0] && rotations[0].slots.length > 0 ? compareRotations(engineData, rotations[0]) : null),
    [engineData, rotations],
  );

  if (status === "idle" || status === "loading" || (field && analysis.phase === "loading" && !analysis.conditions)) {
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

  const soil = engineData?.soil;
  const specs: Array<[string, string]> = [
    ["Location", `${formatPoint(field.centroid)}${field.locationConfirmed ? ", confirmed by you" : ", not confirmed"}`],
    ["Region", regionName(field.region)],
    ["Area", field.areaHa === null ? copy.home.pinOnly : formatArea(field.areaHa, areaUnit)],
    ["Water", copy.irrigation[field.irrigation]],
    ["Soil pH", soil?.ph ? `${soil.ph.value.toFixed(1)} (${soil.ph.from === "farmer" ? "yours" : "regional map"}: ${soil.ph.note})` : "Unknown"],
    ["Soil texture", soil?.texture ? `${soil.texture.value} (${soil.texture.from === "farmer" ? "yours" : "regional map"})` : "Unknown"],
    ["Priorities", field.priorities?.order.length ? field.priorities.order.map((p) => copy.profile.priority[p]).join(", then ") : "Not chosen"],
  ];
  const allEvidence = options.flatMap((o) => o.evidence.map((e) => ({ option: o.label, ev: e })));

  return (
    <>
      <div className="print:hidden">
        <FieldPageHeader
          title={copy.report.title}
          summary={copy.report.subtitle}
        />
      </div>

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
        </header>

        <section aria-labelledby="r-field" className="flex flex-col gap-3">
          <h3 id="r-field" className="text-headline text-ink">
            {copy.report.fieldSummary}
          </h3>
          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {specs.map(([term, value]) => {
              const isCoord = term === "Location";
              return (
                <div key={term} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-body-sm text-ink-muted">{term}</dt>
                  <dd className={cn("m-0 break-words text-data text-ink", isCoord ? "tabular font-mono" : "font-sans")}>{value}</dd>
                </div>
              );
            })}
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
                  <p className="m-0 text-body-sm text-ink-muted">{copy.compare.fitLabel[opt.fit]}{opt.badges.length ? ` · ${opt.badges.join(" · ")}` : ""}</p>
                </div>
                <p className="m-0 text-body-sm text-ink-muted">{opt.reason}</p>
                <dl className="m-0 grid gap-x-6 gap-y-1 text-body-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                  <dt className="text-ink-muted">Crops in order</dt>
                  <dd className="m-0 text-ink">{sequenceText(opt.rotation, " → ")}</dd>
                  <dt className="text-ink-muted">A crop in the field</dt>
                  <dd className="tabular m-0 font-mono text-ink">{pct(opt.structure.coveredShare)} of the cycle</dd>
                  <dt className="text-ink-muted">Legumes</dt>
                  <dd className="tabular m-0 font-mono text-ink">{opt.structure.legumeShare === null ? "Unknown" : pct(opt.structure.legumeShare)} of crops</dd>
                  <dt className="text-ink-muted">Median rain shortfall</dt>
                  <dd className="tabular m-0 font-mono text-ink">{opt.metrics["water-shortfall"] == null ? "Unknown" : `${Math.round(opt.metrics["water-shortfall"])} mm per crop`}</dd>
                  <dt className="text-ink-muted">Dry seasons every crop got through</dt>
                  <dd className="tabular m-0 font-mono text-ink">{opt.dryYear.evaluated === 0 ? "Unknown" : `${opt.dryYear.passes} of ${opt.dryYear.evaluated}`}</dd>
                  <dt className="text-ink-muted">Erosion exposure</dt>
                  <dd className="m-0 text-ink">{opt.erosion.exposure === "needs-slope-data" ? "Needs slope data" : opt.erosion.exposure.replace("-", " ")}</dd>
                </dl>
              </li>
            ))}
          </ol>
        </section>

        <Disclosure title={copy.report.evidenceSummary} className="border-0 bg-transparent print:break-inside-auto [&>summary]:px-0 [&>summary]:text-headline [&>div]:px-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-left text-source">
              <thead>
                <tr className="text-ink-muted">
                  <th scope="col" className="py-1.5 pr-2 font-normal">Option</th>
                  <th scope="col" className="py-1.5 pr-2 font-normal">What</th>
                  <th scope="col" className="py-1.5 pr-2 font-normal">Value</th>
                  <th scope="col" className="py-1.5 font-normal">Source, version, dates, valid counts</th>
                </tr>
              </thead>
              <tbody>
                {allEvidence.map(({ option, ev }) => (
                  <tr key={`${option}-${ev.id}`} className="break-inside-avoid border-t border-line align-top">
                    <td className="py-1.5 pr-2">{option}</td>
                    <td className="py-1.5 pr-2">{ev.claim}</td>
                    <td className="tabular py-1.5 pr-2 font-mono">{ev.indicator.value === null ? `Unknown: ${missingText(ev.indicator.missingReason)}` : `${ev.indicator.value} ${ev.indicator.units}`}</td>
                    <td className="py-1.5">
                      {provenanceLine(ev.indicator)}
                      {ev.indicator.assumptions.length ? ` · ${ev.indicator.assumptions[0]}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>

        <section aria-labelledby="r-gaps" className="flex break-inside-avoid flex-col gap-2">
          <h3 id="r-gaps" className="text-headline text-ink">
            What this report did not have
          </h3>
          {comparison.dataGaps.length === 0 ? (
            <p className="m-0 text-body-sm text-ink-muted">Every connected source answered.</p>
          ) : (
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
              {comparison.dataGaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
        </section>

        {/* 3.3 & 3.4: Bring this to your adviser */}
        <section aria-labelledby="r-adviser" className="flex break-inside-avoid flex-col gap-5 border-t border-line pt-6">
          <div className="flex flex-col gap-1">
            <h3 id="r-adviser" className="text-title text-ink">
              Bring this to your adviser
            </h3>
            <p className="m-0 text-body-sm text-ink-muted">
              The adviser meeting is where your experience and local knowledge pair with this satellite analysis. Review these notes, constraints, and questions together.
            </p>
          </div>

          {/* 1. What the farmer knows (Local notes & observations) */}
          <div className="flex flex-col gap-2 rounded-md bg-surface p-4">
            <h4 className="m-0 text-label text-ink">What you told us (Farmer knowledge)</h4>
            {localNotesList.length > 0 || (field.soilObservations && field.soilObservations.length > 0) ? (
              <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-body-sm text-ink">
                {localNotesList.map((note, idx) => (
                  <li key={idx}>
                    <span className="font-medium text-ink">{note.topic}: </span>
                    <span className="text-ink-muted">{note.text}</span>
                  </li>
                ))}
                {field.soilObservations?.map((obs) => (
                  <li key={obs.id}>
                    <span className="font-medium text-ink">Soil test ({obs.property}): </span>
                    <span className="text-ink-muted">{obs.value} {obs.units} (depth {obs.depthCm[0]}&ndash;{obs.depthCm[1]} cm, {obs.method}, from {obs.source})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-body-sm text-ink-muted italic">
                No local field notes recorded yet. You can flag items with &ldquo;Not right for my field?&rdquo; in Compare to add what you see on your land.
              </p>
            )}
          </div>

          {/* 2. Your farm constraints */}
          <div className="flex flex-col gap-2 rounded-md bg-surface p-4">
            <h4 className="m-0 text-label text-ink">Your farm constraints</h4>
            <dl className="m-0 grid gap-x-6 gap-y-1.5 text-body-sm sm:grid-cols-[14rem_minmax(0,1fr)]">
              <dt className="text-ink-muted">Water access</dt>
              <dd className="m-0 text-ink">
                {copy.irrigation[field.irrigation]}
                {field.constraints?.irrigation?.amountMm ? ` (${field.constraints.irrigation.amountMm} mm/season)` : ""}
              </dd>
              <dt className="text-ink-muted">Available equipment</dt>
              <dd className="m-0 text-ink">
                {field.constraints?.equipment?.length
                  ? field.constraints.equipment.map((e) => copy.profile.equipment[e] ?? e).join(", ")
                  : "Open to anything"}
              </dd>
              <dt className="text-ink-muted">Labour availability</dt>
              <dd className="m-0 text-ink">
                {field.constraints?.labour ? (copy.profile.levels[field.constraints.labour] ?? field.constraints.labour) : "Not specified"}
              </dd>
              <dt className="text-ink-muted">Market access</dt>
              <dd className="m-0 text-ink">
                {field.constraints?.marketAccess ? (copy.profile.levels[field.constraints.marketAccess] ?? field.constraints.marketAccess) : "Not specified"}
              </dd>
              {field.constraints?.preferredCropIds?.length ? (
                <>
                  <dt className="text-ink-muted">Preferred crops</dt>
                  <dd className="m-0 text-ink">{field.constraints.preferredCropIds.join(", ")}</dd>
                </>
              ) : null}
              {field.constraints?.excludedCropIds?.length ? (
                <>
                  <dt className="text-ink-muted">Excluded crops</dt>
                  <dd className="m-0 text-ink">{field.constraints.excludedCropIds.join(", ")}</dd>
                </>
              ) : null}
              {field.constraints?.plantingWindow ? (
                <>
                  <dt className="text-ink-muted">Planting window</dt>
                  <dd className="m-0 text-ink">{field.constraints.plantingWindow.from} to {field.constraints.plantingWindow.to}</dd>
                </>
              ) : null}
            </dl>
          </div>

          {/* 3. Where human judgment matters ("Your call" items) */}
          <div className="flex flex-col gap-2 rounded-md bg-surface p-4">
            <h4 className="m-0 text-label text-ink">Where your local judgment matters most</h4>
            <p className="m-0 text-source text-ink-muted">
              Satellite and climate data reach limits at field scale. Review these boundaries with your adviser:
            </p>
            <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-body-sm text-ink">
              <li>
                <span className="font-medium">Water on your field:</span> SMAP soil moisture is a 9 km grid cell and cannot see your well, irrigation canal, or low-lying corner.
              </li>
              <li>
                <span className="font-medium">Soil fertility:</span> The soil map is 250 m global resolution. Your local soil test or field history beats it.
              </li>
              <li>
                <span className="font-medium">Pests and disease:</span> NASA data cannot identify pest pressure or verify that a sequence breaks pest lifecycles.
              </li>
              <li>
                <span className="font-medium">Markets, prices, and labour:</span> No satellite can see your buyer, market prices, or harvest workforce availability.
              </li>
              <li>
                <span className="font-medium">Variety and sowing dates:</span> Sowing calendars are generic species baselines; tune dates to local varieties and monsoon arrival.
              </li>
              {field.region === "ayeyarwady" ? (
                <li>
                  <span className="font-medium">Flooded rice and bare soil:</span> Standing water pixels in monsoon do not mean bare ground; local bunding controls drainage.
                </li>
              ) : null}
              {field.region === "shan" ? (
                <li>
                  <span className="font-medium">Slope and erosion:</span> Regional weather grids cannot resolve steep slope runoff or microclimates in mountain valleys.
                </li>
              ) : null}
            </ol>
          </div>

          {/* 4. Adviser questions */}
          <div className="flex flex-col gap-2 rounded-md bg-surface p-4">
            <h4 className="m-0 text-label text-ink">{copy.report.adviserQuestionsTitle}</h4>
            <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-body-sm text-ink">
              {questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </div>

          {/* 5. Plain-words confidence (3.4) */}
          <div className="flex flex-col gap-1 rounded-md border border-line bg-surface p-4 text-source text-ink-muted">
            <h4 className="m-0 text-label text-ink">Data coverage and confidence</h4>
            <p className="m-0">
              Confidence is expressed in coverage and observation depth, never an invented percentage:
            </p>
            <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5">
              <li>Weather: Based on {comparison.baseline.completeYears} complete years of daily NASA POWER weather observations ({comparison.baseline.startYear}&ndash;{comparison.baseline.endYear}) around your field coordinate.</li>
              <li>Rainfall: Replayed from {comparison.rain.primary === "R" ? "GPM IMERG 0.1° satellite precipitation calibrated with ground stations" : "NASA POWER daily weather model"}.</li>
              <li>Soil profile: ISRIC SoilGrids v2 250 m global digital soil mapping.</li>
            </ul>
          </div>
        </section>

        <footer className="flex flex-col gap-1 border-t border-line pt-4 text-source text-ink-muted">
          <p className="m-0">{copy.judgment.short} {copy.judgment.long}</p>
          <p className="tabular m-0 font-mono">
            Data: NASA POWER daily (UTC days, {comparison.baseline.startYear} to {comparison.baseline.endYear}); rainfall from {comparison.rain.primary === "R" ? "GPM IMERG" : comparison.rain.primary === "P" ? "NASA POWER" : "no source"}; ISRIC SoilGrids v2 250 m (not NASA). Processed {comparison.processedAt.slice(0, 10)}.
          </p>
        </footer>
      </article>

      <ActionBar>
        <Button
          variant="secondary"
          size="lg"
          icon="share"
          onClick={() => {
            const text = `${field.name}: past ${comparison.baseline.completeYears} seasons. Talk it through with your extension officer or an experienced farmer.`;
            if (navigator.share) void navigator.share({ title: copy.app.name, text }).catch(() => undefined);
            else window.print();
          }}
        >
          Share
        </Button>
        <Button variant="primary" size="lg" icon="print" onClick={() => window.print()}>
          {copy.report.printButton}
        </Button>
      </ActionBar>
    </>
  );
}
