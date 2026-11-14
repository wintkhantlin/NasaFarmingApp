import type { DailyWeather } from "./nasa/power";
import type { Backup, Field, Rotation } from "./types";

/**
 * Client-side file download utilities.
 * Triggers clean browser file downloads with URL cleanup and encoding support.
 */

export function downloadBlob(filename: string, blob: Blob): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadJson(filename: string, data: unknown): void {
  const jsonText = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonText], { type: "application/json;charset=utf-8;" });
  downloadBlob(filename, blob);
}

export function downloadCsv(filename: string, csvContent: string): void {
  // Prepend UTF-8 BOM so Excel and other spreadsheet viewers render Unicode properly
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(filename, blob);
}

/**
 * Converts a field's daily weather records into a standard CSV format
 * suitable for agronomic analysis, extension officers, and spreadsheets.
 */
export function generateWeatherCsv(fieldName: string, weather: DailyWeather): string {
  const headers = [
    "Date",
    "Rainfall_mm",
    "Tmax_C",
    "Tmin_C",
    "Tmean_C",
    "RelativeHumidity_Pct",
    "WindSpeed_ms",
    "SolarRadiation_MJ_m2_day",
    "Pressure_kPa",
  ];

  const rows: string[] = [headers.join(",")];

  const rain = weather.series.PRECTOTCORR ?? [];
  const tmax = weather.series.T2M_MAX ?? [];
  const tmin = weather.series.T2M_MIN ?? [];
  const tmean = weather.series.T2M ?? [];
  const rh = weather.series.RH2M ?? [];
  const ws = weather.series.WS2M ?? [];
  const rad = weather.series.ALLSKY_SFC_SW_DWN ?? [];
  const ps = weather.series.PS ?? [];

  const fmt = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? "" : v.toFixed(2));

  for (let i = 0; i < weather.dates.length; i++) {
    const row = [
      weather.dates[i],
      fmt(rain[i]),
      fmt(tmax[i]),
      fmt(tmin[i]),
      fmt(tmean[i]),
      fmt(rh[i]),
      fmt(ws[i]),
      fmt(rad[i]),
      fmt(ps[i]),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\r\n");
}

/**
 * Creates a standard JSON backup of all farm fields and recorded rotations.
 */
export function createBackupPayload(fields: Field[], rotations: Rotation[]): Backup {
  return {
    app: "nasa-farming-app",
    version: 2,
    exportedAt: new Date().toISOString(),
    fields,
    rotations,
  };
}
