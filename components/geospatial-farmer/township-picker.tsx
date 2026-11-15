"use client";

import type { Townships } from "@/lib/geospatial-farmer/geospatial/townships";

export interface AreaSelection {
  region: string;
  district: string;
  township: string;
}

export function TownshipPicker({
  data,
  selection,
  onChange,
  error,
  retryLabel,
  onRetry,
}: {
  data: Townships | null;
  selection: AreaSelection;
  onChange: (selection: AreaSelection) => void;
  error: string | null;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  const rows = data?.features.map((f) => f.properties) ?? [];
  const options = (items: typeof rows, code: "ST_PCODE" | "DT_PCODE" | "TS_PCODE", name: "ST" | "DT" | "TS") =>
    [...new Map(items.map((p) => [p[code], { code: p[code], label: name === "TS" && p.TS_MMR ? `${p.TS} / ${p.TS_MMR}` : p[name] }])).values()].sort((a, b) => a.label.localeCompare(b.label));

  const controls = [
    { label: "Region or state", value: selection.region, items: options(rows, "ST_PCODE", "ST"), change: (region: string) => onChange({ region, district: "", township: "" }) },
    { label: "District", value: selection.district, items: options(rows.filter((p) => p.ST_PCODE === selection.region), "DT_PCODE", "DT"), change: (district: string) => onChange({ ...selection, district, township: "" }) },
    { label: "Township", value: selection.township, items: options(rows.filter((p) => p.ST_PCODE === selection.region && p.DT_PCODE === selection.district), "TS_PCODE", "TS"), change: (township: string) => onChange({ ...selection, township }) },
  ];

  const selectedTownship = rows.find((row) => row.TS_PCODE === selection.township);

  return (
    <details
      className="pointer-events-auto rounded-lg border border-line bg-surface-raised px-3 shadow-float"
      open={selection.region || error ? true : undefined}
    >
      <summary className="flex min-h-tap cursor-pointer items-center text-label font-medium text-ink">
        {selectedTownship ? `${selectedTownship.TS}, ${selectedTownship.ST}` : "Browse by township"}
      </summary>
      {error ? (
        <>
          <p role="status" className="border-t border-line py-3 text-body-sm text-ink-muted">
            {error}
          </p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="mb-3 min-h-tap rounded-sm border border-line-strong px-3 text-label text-ink">
              {retryLabel ?? "Retry"}
            </button>
          ) : null}
        </>
      ) : !data ? (
        <p role="status" className="border-t border-line py-3 text-body-sm text-ink-muted">
          Loading township boundaries…
        </p>
      ) : (
        <div className="grid gap-3 border-t border-line py-3">
          {controls.map((control) => (
            <label key={control.label} className="grid gap-1 text-label text-ink">
              {control.label}
              <select
                value={control.value}
                disabled={!control.items.length}
                onChange={(event) => control.change(event.target.value)}
                className="min-h-tap w-full rounded-sm border border-line-strong bg-surface-sunken px-3 text-body text-ink disabled:opacity-50"
              >
                <option value="">Choose {control.label.toLowerCase()}</option>
                {control.items.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </label>
          ))}
          <p className="text-body-sm text-ink-muted">
            This moves the map only. Mark and confirm your own field inside the area.
          </p>
          <p className="text-source text-ink-muted">
            Boundaries:{" "}
            <a
              className="underline underline-offset-2"
              href={data.metadata?.license
                ? "https://www.geoboundaries.org/api/current/gbOpen/MMR/ADM3/"
                : "https://data.themimu.info/en/dataset/myanmar-administrative-boundary"}
              target="_blank"
              rel="noopener noreferrer"
            >
              {data.metadata?.license ? "geoBoundaries gbOpen · CC BY 4.0" : "MIMU / GAD · PCode v9.4"}
            </a>
            {data.metadata?.license ? " · 330 townships · 2019 boundaries" : " · context only"}
          </p>
        </div>
      )}
    </details>
  );
}
