"use client";

import { scaleLinear } from "d3-scale";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The width of an element in px, kept current. Charts draw at their real size so text stays readable. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.round(el.getBoundingClientRect().width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const MARGIN = { top: 10, right: 8, bottom: 26, left: 40 };

function Legend({ items }: { items: Array<{ swatch: React.ReactNode; label: string }> }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-body-sm text-ink-muted">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          {it.swatch}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

const swatchBox = "inline-block h-3 w-4 shrink-0 rounded-sm";

/** Months as a hidden table, so a screen reader gets the numbers the picture shows. */
function DataTable({ caption, rows, unit }: { caption: string; rows: Array<[string, string]>; unit: string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">{unit}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([m, v]) => (
          <tr key={m}>
            <th scope="row">{m}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Monthly rain as bars against what crops use as a line. Months where rain
 * falls short are shaded and named in the legend, so the chart says "dry
 * months" without relying on colour.
 */
export function RainWaterChart({ rain, cropUse, height = 220 }: { rain: number[]; cropUse?: number[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const innerW = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const max = Math.max(...rain, ...(cropUse ?? [0]), 10);
  const y = scaleLinear().domain([0, max]).nice(4).range([innerH, 0]);
  const ticks = y.ticks(4);
  const band = innerW / 12;
  const narrow = width < 480;
  const short = cropUse ? rain.map((r, i) => cropUse[i] > r) : rain.map(() => false);
  const shortCount = short.filter(Boolean).length;
  const label = `Monthly rain in mm${cropUse ? ", with what crops use" : ""}. ${
    cropUse ? `Rain falls short in ${shortCount} months.` : ""
  }`;

  return (
    <figure className="m-0 flex flex-col gap-3">
      <Legend
        items={[
          { swatch: <span className={cn(swatchBox, "bg-water")} />, label: "Rain" },
          ...(cropUse
            ? [
                { swatch: <span className="inline-block h-0 w-4 shrink-0 border-t-2 border-dashed border-ink" />, label: "Crop water use (estimate)" },
                { swatch: <span className={cn(swatchBox, "bg-drought-soft border border-dashed border-drought")} />, label: "Shortfall (water gap)" },
              ]
            : []),
        ]}
      />
      <div ref={ref} className="w-full">
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={label} className="block">
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {ticks.map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={innerW} className="stroke-line" />
                  <text x={-8} dy="0.32em" textAnchor="end" className="tabular fill-ink-muted text-source">
                    {t}
                  </text>
                </g>
              ))}
              {rain.map((r, i) => (
                <g key={MONTHS[i]} transform={`translate(${i * band},0)`}>
                  {short[i] && cropUse ? (
                    <rect
                      x={band * 0.2}
                      width={band * 0.6}
                      y={y(cropUse[i])}
                      height={Math.max(y(r) - y(cropUse[i]), 0)}
                      rx={2}
                      className="fill-drought-soft stroke-drought/60 stroke-1 stroke-dashed"
                    />
                  ) : null}
                  <rect
                    x={band * 0.2}
                    width={band * 0.6}
                    y={y(r)}
                    height={Math.max(innerH - y(r), 0)}
                    rx={2}
                    className="fill-water"
                  />
                  <text x={band / 2} y={innerH + 17} textAnchor="middle" className="fill-ink-muted text-source">
                    {narrow ? MONTHS[i][0] : MONTHS[i]}
                  </text>
                </g>
              ))}
              {cropUse ? (
                <path
                  d={cropUse.map((v, i) => `${i === 0 ? "M" : "L"}${i * band + band / 2},${y(v)}`).join("")}
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-ink"
                />
              ) : null}
            </g>
          </svg>
        ) : (
          <div style={{ height }} className="rounded-md bg-surface-sunken" />
        )}
      </div>
      <p className="m-0 text-source text-ink-muted">
        Millimetres per month.{cropUse ? " Crop water use is estimated from temperature, so treat it as a guide." : ""}
      </p>
      <DataTable
        caption="Rain and crop water use by month"
        unit="Rain, mm"
        rows={rain.map((r, i) => [MONTHS[i], `${r} mm rain${cropUse ? `, crops use ${cropUse[i]} mm` : ""}`])}
      />
    </figure>
  );
}

/**
 * Each month as a floating bar from its average night low to its average day
 * high. A shaded band shows the range the crop likes; a dashed line marks
 * freezing when the chart reaches it.
 */
export function TemperatureChart({
  tmax,
  tmin,
  band,
  bandLabel,
  height = 220,
}: {
  tmax: number[];
  tmin: number[];
  band?: [number, number];
  bandLabel?: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const innerW = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const lo = Math.min(...tmin, band?.[0] ?? Infinity, 0 - 0.001);
  const hi = Math.max(...tmax, band?.[1] ?? -Infinity);
  const y = scaleLinear().domain([Math.min(lo, 0) - 2, hi + 2]).nice(4).range([innerH, 0]);
  const ticks = y.ticks(5);
  const colW = innerW / 12;
  const narrow = width < 480;
  const reachesFreezing = y.domain()[0] <= 0;

  return (
    <figure className="m-0 flex flex-col gap-3">
      <Legend
        items={[
          { swatch: <span className={cn(swatchBox, "border border-line-strong bg-surface-raised")} />, label: "Usual night low to day high" },
          ...(band ? [{ swatch: <span className={cn(swatchBox, "bg-field-soft")} />, label: bandLabel ?? "Comfortable range" }] : []),
          ...(reachesFreezing
            ? [{ swatch: <span className="inline-block h-0 w-4 shrink-0 border-t-2 border-dashed border-frost" />, label: "Freezing, 0 °C" }]
            : []),
        ]}
      />
      <div ref={ref} className="w-full">
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Average daily low and high temperature for each month, in degrees Celsius"
            className="block"
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {band ? (
                <rect x={0} width={innerW} y={y(band[1])} height={Math.max(y(band[0]) - y(band[1]), 0)} className="fill-field-soft" />
              ) : null}
              {ticks.map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={innerW} className="stroke-line" />
                  <text x={-8} dy="0.32em" textAnchor="end" className="tabular fill-ink-muted text-source">
                    {t}°
                  </text>
                </g>
              ))}
              {reachesFreezing ? (
                <line x2={innerW} y1={y(0)} y2={y(0)} strokeWidth={1.5} strokeDasharray="5 4" className="stroke-frost" />
              ) : null}
              {tmax.map((hiT, i) => (
                <g key={MONTHS[i]} transform={`translate(${i * colW},0)`}>
                  <rect
                    x={colW * 0.28}
                    width={colW * 0.44}
                    y={y(hiT)}
                    height={Math.max(y(tmin[i]) - y(hiT), 2)}
                    rx={colW * 0.22}
                    className="fill-surface-raised stroke-line-strong"
                    strokeWidth={1.5}
                  />
                  <text x={colW / 2} y={innerH + 17} textAnchor="middle" className="fill-ink-muted text-source">
                    {narrow ? MONTHS[i][0] : MONTHS[i]}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        ) : (
          <div style={{ height }} className="rounded-md bg-surface-sunken" />
        )}
      </div>
      <DataTable
        caption="Average daily low and high temperature by month"
        unit="Low to high, °C"
        rows={tmax.map((h, i) => [MONTHS[i], `${tmin[i]} to ${h} °C`])}
      />
    </figure>
  );
}
