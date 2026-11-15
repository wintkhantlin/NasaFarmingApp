import { Icon } from "@/components/ui/icon";
import { PanelHeader } from "@/components/ui/panel";
import { IndicatorCard } from "@/components/ui/indicator-card";
import { RiskChip } from "@/components/ui/risk-chip";
import { copy } from "@/lib/copy/en";
import { ofSeasons } from "@/lib/evidence/indicator";
import type { ComparisonResult, SlotEvaluation } from "@/lib/engine/compare";
import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import type { SourceStatus } from "@/lib/engine/data";
import { EVIDENCE_CLASS_LABEL, type EvidenceClass } from "@/lib/evidence/explain";
import { dryZoneRainCaution } from "@/lib/validation/source-checks";

const fmt = (n: number | null, d = 0) => (n === null ? "unknown" : n.toFixed(d));

/** Dry Zone caution for NASA rain: amber (unknown) styling, never green. Rendered only for Dry Zone fields. */
export function DryZoneRainNote({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={`m-0 flex max-w-measure items-start gap-2 rounded-md border border-unknown-border/40 bg-unknown-bg px-3 py-2 text-body-sm text-unknown-text ${className ?? ""}`}
    >
      <Icon name="alert" size={16} strokeWidth={2.4} className="mt-0.5 shrink-0" />
      <span>{dryZoneRainCaution()}</span>
    </p>
  );
}

function sourceKindLine(status: SourceStatus | undefined, evidence: Exclude<EvidenceClass, "missing">, where: string): string {
  const kind = EVIDENCE_CLASS_LABEL[evidence].label;
  return status === "ok" ? `${kind} · ${where} · past record, not a forecast` : `Missing information, not zero · would be a ${kind.toLowerCase()} · ${where}`;
}

type SourceRow = { title: string; status: SourceStatus | undefined; note: string; progress?: string; fallback?: string; evidence: Exclude<EvidenceClass, "missing">; where: string };

/** Plain status line a farmer can read. The acronym lists below it carry the technical names. */
function plainStatus(status: SourceStatus | undefined, progress?: string, fallback?: string): string {
  if (status === "ok") return "Ready";
  if (status === "pending") return progress ? `${copy.conditions.pending} ${progress}` : copy.conditions.pending;
  if (status === "unconfigured" || status === "unavailable") return fallback ?? copy.conditions.unconfigured;
  return "Not checked yet.";
}

/** Three plain rows (rain detail, soil wetness, field photo). Acronyms and the other sources sit in one technical disclosure. Missing sources are stated, never hidden. */
export function SourceStatusPanel({ conditions, remote }: { conditions: ConditionsData | null; remote: RemoteData | null }) {
  const imerg = conditions?.imerg;
  const imergProgress = imerg && imerg.status !== "unconfigured" ? copy.conditions.imergProgress(imerg.covered, imerg.expected) : undefined;
  const imergFallback = "Using regional NASA weather (about 50 km) while detailed satellite rainfall is unavailable.";
  const plainRows: Array<{ title: string; status: SourceStatus | undefined; progress?: string; fallback?: string; note: string }> = [
    { title: copy.conditions.rainDetailTitle, status: imerg?.status, progress: imergProgress, fallback: imergFallback, note: "Rain seen from satellites, used when enough days are ready." },
    { title: copy.conditions.soilWetnessTitle, status: remote?.smap.status, note: "A wide-area view. It does not show how wet your own field is." },
    { title: copy.conditions.fieldPhotoTitle, status: remote?.hls.status, note: "Satellite photos of your field on clear days." },
  ];
  const technical: SourceRow[] = [
    { title: copy.conditions.imergTitle, status: imerg?.status, note: copy.conditions.rainfallNote, evidence: "model", where: "Regional, about 11 km", progress: imergProgress, fallback: imergFallback },
    { title: copy.conditions.smapTitle, status: remote?.smap.status, note: copy.conditions.smapNote, evidence: "model", where: "Regional, about 9 km" },
    { title: copy.conditions.hlsTitle, status: remote?.hls.status, note: "Clear observations only. Cloud, shadow, snow and water are screened out, and gaps are not zero.", evidence: "satellite", where: "Inside your field, 30 m" },
    { title: copy.conditions.srtmTitle, status: remote?.srtm.status, note: "Slope comes from neighbouring elevation cells. Slope is not soil loss.", evidence: "satellite", where: "Inside your field, 30 m" },
    { title: "MODIS regional vegetation", status: remote?.modis.status, note: "A 250 m, 16-day regional greenness history. Mixed land cover means it does not identify the crop in this field.", evidence: "satellite", where: "Regional, 250 m" },
    { title: "ECOSTRESS surface temperature", status: remote?.ecostressLst.status, note: "Clear, best-quality 70 m land-surface temperature. This is not air temperature.", evidence: "satellite", where: "Inside your field, 70 m" },
    { title: "ECOSTRESS evapotranspiration", status: remote?.ecostressEt.status, note: "Clear 70 m modeled ET in W/m². It is context, not measured crop water use or mm/day.", evidence: "model", where: "Inside your field, 70 m" },
  ];
  return (
    <section aria-labelledby="sources" className="flex flex-col gap-3">
      <PanelHeader id="sources" title="Extra satellite detail for this field" description="Each line says if it is ready, on its way, or not available for your area yet." />
      <ul className="m-0 list-none divide-y divide-line p-0">
        {plainRows.map((r) => (
          <li key={r.title} className="grid gap-x-4 gap-y-1 py-3 first:pt-0 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(0,2fr)]">
            <p className="m-0 text-label text-ink">{r.title}</p>
            <div className="flex flex-col gap-1">
              <p className="m-0 text-body-sm text-ink">{plainStatus(r.status, r.progress, r.fallback)}</p>
              <p className="m-0 text-body-sm text-ink-muted">{r.note}</p>
            </div>
          </li>
        ))}
      </ul>
      <details className="text-body-sm">
        <summary className="inline-flex min-h-tap cursor-pointer items-center text-field underline-offset-2 hover:underline">{copy.conditions.technicalNames}</summary>
        <ul className="m-0 mt-2 list-none divide-y divide-line p-0">
          {technical.map((r) => (
            <li key={r.title} className="grid gap-x-4 gap-y-1 py-3 first:pt-2 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(0,2fr)]">
              <p className="m-0 text-label text-ink">{r.title}</p>
              <div className="flex flex-col gap-1">
                <p className="m-0 text-source text-ink-muted">{sourceKindLine(r.status, r.evidence, r.where)}</p>
                <p className="m-0 text-body-sm text-ink">{plainStatus(r.status, r.progress, r.fallback)}</p>
                <p className="m-0 text-body-sm text-ink-muted">{r.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function SlotVulnerability({ e }: { e: SlotEvaluation }) {
  if (!e.exposure) return <p className="m-0 text-body-sm text-ink-muted">{e.unknowns[0] ?? "Not assessed."}</p>;
  const n = e.exposure.eligibleSeasons;
  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {e.exposure.byStage.map((st) => (
          <li key={st.stage} className="flex flex-wrap items-center gap-2 text-body-sm">
            <span className="w-44 shrink-0 text-ink">{st.label}</span>
            {st.heatThresholdC === null && st.coldThresholdC === null ? (
              <span className="text-ink-muted">No sourced threshold, so exposure is unknown.</span>
            ) : (
              <>
                {st.heatThresholdC !== null ? (
                  <RiskChip hazard={(st.seasonsWithHeat ?? 0) > 0 ? "heat" : "healthy"}>
                    Above {st.heatThresholdC} °C: {ofSeasons(st.seasonsWithHeat ?? 0, n)}
                  </RiskChip>
                ) : null}
                {st.coldThresholdC !== null ? (
                  <RiskChip hazard={(st.seasonsWithCold ?? 0) > 0 ? "frost" : "healthy"}>
                    Below {st.coldThresholdC} °C: {ofSeasons(st.seasonsWithCold ?? 0, n)}
                  </RiskChip>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="tabular m-0 text-source text-ink-muted">
        Dry run in the season: median {fmt(e.rain.longestDry.p50)} days, driest tenth {fmt(e.rain.longestDry.p90)} days. Heavy-rain days: median {fmt(e.rain.heavyDays.p50)}. {" "}
        {ofSeasons(e.rain.eligible, e.rain.windows)} usable
      </p>
    </div>
  );
}

/** Feature 17: when in the crop's life heat, dry runs and heavy rain matter, season by season. */
export function VulnerabilityPanel({ comparison }: { comparison: ComparisonResult }) {
  const slots = comparison.current.slots.filter((s) => s.hasRules);
  const heatEvidence = comparison.current.evidence.find((x) => x.id.endsWith(":heat"));
  if (slots.length === 0) return null;
  return (
    <section aria-labelledby="vuln" className="flex flex-col gap-4">
      <PanelHeader id="vuln" title={copy.conditions.vulnerabilityTitle} description={copy.conditions.vulnerabilityDescription} />
      {slots.map((e) => (
        <div key={e.slot.id} className="flex flex-col gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
          <h3 className="m-0 text-label text-ink">{e.name}</h3>
          <SlotVulnerability e={e} />
        </div>
      ))}
      <p className="m-0 max-w-measure text-body-sm text-ink-muted">
        Air temperature comes from NASA POWER. Thresholds are starting values labelled by how well they are sourced, and a day above one in the data is not the same as heat damage in your field.
      </p>
      {heatEvidence ? <IndicatorCard indicator={heatEvidence.indicator} claim={heatEvidence.claim} /> : null}
    </section>
  );
}

/** Feature 18: estimated crop water demand next to rain, with the assumptions stated. */
export function WaterUsePanel({ comparison }: { comparison: ComparisonResult }) {
  const slots = comparison.current.slots.filter((s) => s.hasRules);
  if (slots.length === 0) return null;
  const evidence = comparison.current.evidence.find((x) => x.id.endsWith(":shortfall"));
  return (
    <section aria-labelledby="wateruse" className="flex flex-col gap-4">
      <PanelHeader id="wateruse" title={copy.conditions.waterUseTitle} description={copy.conditions.waterUseDescription} />
      {/* Mobile: a compact row per crop, separated by rules. */}
      <ul className="m-0 flex list-none flex-col divide-y divide-line p-0 sm:hidden">
        {slots.map((e) => (
          <li key={e.slot.id} className="flex flex-col gap-2 py-3 first:pt-0 text-body-sm">
            <span className="text-body font-semibold text-ink">
              {e.name}{e.irrigated ? <span className="ml-1 text-source font-normal text-ink-muted">(irrigated)</span> : ""}
            </span>
            <dl className="m-0 grid grid-cols-1 gap-1">
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-muted">Water crops use:</dt>
                <dd className="tabular m-0 font-mono font-medium text-ink">{fmt(e.water?.etc.p50 ?? null)} mm</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-muted">Rain:</dt>
                <dd className="tabular m-0 font-mono font-medium text-ink">{fmt(e.rain.total.p50)} mm</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-muted">Rain short of demand:</dt>
                <dd className="tabular m-0 font-mono font-medium text-stress">{fmt(e.water?.shortfall.p50 ?? null)} mm</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {/* Tablet & Desktop: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[30rem] border-collapse text-left text-body-sm">
          <thead>
            <tr className="text-ink-muted">
              <th scope="col" className="py-2 pr-3 font-normal">Crop</th>
              <th scope="col" className="py-2 pr-3 font-normal">Water crops use (mm)</th>
              <th scope="col" className="py-2 pr-3 font-normal">Rain (mm)</th>
              <th scope="col" className="py-2 font-normal">Rain short of demand (mm)</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((e) => (
              <tr key={e.slot.id} className="border-t border-line align-top">
                <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">{e.name}{e.irrigated ? " (irrigated)" : ""}</th>
                <td className="tabular py-2 pr-3 font-mono">{fmt(e.water?.etc.p50 ?? null)}</td>
                <td className="tabular py-2 pr-3 font-mono">{fmt(e.rain.total.p50)}</td>
                <td className="tabular py-2 font-mono">{fmt(e.water?.shortfall.p50 ?? null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-body-sm text-ink-muted">Medians over the usable seasons from {comparison.baseline.startYear} to {comparison.baseline.endYear}.</p>
      {slots.some((s) => s.rootZone?.status === "unknown") ? <p className="m-0 text-body-sm text-ink">{copy.conditions.rootZoneUnknown}</p> : null}
      {evidence ? <IndicatorCard indicator={evidence.indicator} claim={evidence.claim} /> : null}
    </section>
  );
}
