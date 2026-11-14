import { Panel, PanelHeader } from "@/components/ui/panel";
import { copy } from "@/lib/copy/en";
import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import type { SourceStatus } from "@/lib/engine/data";

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
