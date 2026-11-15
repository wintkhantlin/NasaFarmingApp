"use client";
import type { Townships } from "@/lib/geospatial-farmer/geospatial/townships";

export interface AreaSelection { region: string; district: string; township: string }
export function TownshipPicker({ data, selection, onChange, error }: {
  data: Townships | null; selection: AreaSelection; onChange: (selection: AreaSelection) => void; error: string | null;
}) {
  const rows = data?.features.map((f) => f.properties) ?? [];
  const options = (items: typeof rows, code: "ST_PCODE" | "DT_PCODE" | "TS_PCODE", name: "ST" | "DT" | "TS") =>
    [...new Map(items.map((p) => [p[code], { code: p[code], label: name === "TS" && p.TS_MMR ? `${p.TS} / ${p.TS_MMR}` : p[name] }])).values()].sort((a, b) => a.label.localeCompare(b.label));
  const controls = [
    { label: "Region or state", value: selection.region, items: options(rows, "ST_PCODE", "ST"), change: (region: string) => onChange({ region, district: "", township: "" }) },
    { label: "District", value: selection.district, items: options(rows.filter((p) => p.ST_PCODE === selection.region), "DT_PCODE", "DT"), change: (district: string) => onChange({ ...selection, district, township: "" }) },
    { label: "Township", value: selection.township, items: options(rows.filter((p) => p.ST_PCODE === selection.region && p.DT_PCODE === selection.district), "TS_PCODE", "TS"), change: (township: string) => onChange({ ...selection, township }) },
  ];
  return <details className="pointer-events-auto rounded-lg border border-line bg-surface-raised p-3" open>
    <summary className="cursor-pointer text-label font-medium text-ink">Find your township</summary>
    {error ? <p role="status" className="mt-2 text-body-sm text-ink-muted">{error}</p> : !data ? <p role="status">Loading study areas…</p> : <div className="mt-3 grid gap-3">
      {controls.map((c) => <label key={c.label} className="grid gap-1 text-label text-ink">{c.label}<select value={c.value} disabled={!c.items.length} onChange={(e) => c.change(e.target.value)} className="min-h-tap w-full rounded-sm border border-line-strong bg-surface-sunken px-2 text-body">
        <option value="">Choose {c.label.toLowerCase()}</option>{c.items.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
      </select></label>)}
      <p className="text-body-sm text-ink-muted">Township outlines give context. Draw your own field inside the area; choosing a township does not confirm a field.</p>
      <p className="text-source text-ink-muted">Boundaries: <a className="underline" href="https://data.themimu.info/en/dataset/myanmar-administrative-boundary">MIMU / GAD, PCode v9.4</a>. About 1:250,000 scale. Coverage review pending.</p>
    </div>}
  </details>;
}
