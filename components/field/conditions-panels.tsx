import { Panel, PanelHeader } from "@/components/ui/panel";
import { Provenance } from "@/components/ui/provenance";
import { RiskChip } from "@/components/ui/risk-chip";
import { copy } from "@/lib/copy/en";
import { ofSeasons } from "@/lib/evidence/indicator";
import type { ComparisonResult, SlotEvaluation } from "@/lib/engine/compare";
import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import type { SourceStatus } from "@/lib/engine/data";

const fmt = (n: number | null, d = 0) => (n === null ? "unknown" : n.toFixed(d));

function statusText(status: SourceStatus | undefined, progress?: string): string {
  if (status === "ok") return "Retrieved";
  if (status === "pending") return progress ? `${copy.conditions.pending} ${progress}` : copy.conditions.pending;
  if (status === "unconfigured") return copy.conditions.unconfigured;
  if (status === "unavailable") return "The source did not answer.";
  return "Not requested yet.";
}

/** One line per NASA source: connected, pending or not connected. Missing sources are stated, never hidden. */
export function SourceStatusPanel({ conditions, remote }: { conditions: ConditionsData | null; remote: RemoteData | null }) {
  const imerg = conditions?.imerg;
  const rows: Array<{ title: string; status: SourceStatus | undefined; note: string; progress?: string }> = [
    {
      title: copy.conditions.imergTitle,
      status: imerg?.status,
      note: copy.conditions.rainfallNote,
      progress: imerg && imerg.status !== "unconfigured" ? copy.conditions.imergProgress(imerg.covered, imerg.expected) : undefined,
    },
    { title: copy.conditions.smapTitle, status: remote?.smap.status, note: copy.conditions.smapNote },
    { title: copy.conditions.hlsTitle, status: remote?.hls.status, note: "Clear observations only. Cloud, shadow, snow and water are screened out, and gaps are not zero." },
    { title: copy.conditions.srtmTitle, status: remote?.srtm.status, note: "Slope comes from neighbouring elevation cells. Slope is not soil loss." },
  ];
  return (
    <Panel as="section" aria-labelledby="sources" className="flex flex-col gap-3 p-4 sm:p-6">
      <PanelHeader id="sources" title="NASA data connected to this field" description="Each source says whether it was read, is on its way, or is not connected." />
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.title} className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3">
            <p className="m-0 text-label text-ink">{r.title}</p>
            <p className="m-0 text-body-sm text-ink">{statusText(r.status, r.progress)}</p>
            <p className="m-0 text-body-sm text-ink-muted">{r.note}</p>
          </li>
        ))}
      </ul>
    </Panel>
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
      <p className="tabular m-0 font-mono text-source text-ink-muted">
        Dry run in the season: median {fmt(e.rain.longestDry.p50)} days, driest tenth {fmt(e.rain.longestDry.p90)} days · heavy-rain days: median {fmt(e.rain.heavyDays.p50)} ·{" "}
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
    <Panel as="section" aria-labelledby="vuln" className="flex flex-col gap-4 p-4 sm:p-6">
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
      {heatEvidence ? <Provenance indicator={heatEvidence.indicator} /> : null}
    </Panel>
  );
}

/** Feature 18: estimated crop water demand next to rain, with the assumptions stated. */
export function WaterUsePanel({ comparison }: { comparison: ComparisonResult }) {
  const slots = comparison.current.slots.filter((s) => s.hasRules);
  if (slots.length === 0) return null;
  const evidence = comparison.current.evidence.find((x) => x.id.endsWith(":shortfall"));
  return (
    <Panel as="section" aria-labelledby="wateruse" className="flex flex-col gap-4 p-4 sm:p-6">
      <PanelHeader id="wateruse" title={copy.conditions.waterUseTitle} description={copy.conditions.waterUseDescription} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-left text-body-sm">
          <thead>
            <tr className="text-ink-muted">
              <th scope="col" className="py-2 pr-3 font-normal">Crop</th>
              <th scope="col" className="py-2 pr-3 font-normal">Demand, ETc (mm)</th>
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
      {evidence ? <Provenance indicator={evidence.indicator} /> : null}
    </Panel>
  );
}
