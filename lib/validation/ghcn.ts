/**
 * GHCN-Daily station records (NOAA NCEI), the ground truth for the weather validation harness.
 * https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily
 *
 * The per-station CSV ("access" files) stores PRCP in tenths of mm and TMAX/TMIN in tenths of °C.
 * Each value has an attribute string "M,Q,S" (measurement, quality, source flags). A non-blank Q flag
 * means the value failed an NCEI quality check, so it is dropped here rather than trusted.
 */

export const GHCN_ACCESS_BASE = "https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access";

export interface GhcnStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevationM: number;
  /** The app region this station best stands in for, if any. */
  region: string | null;
}

/**
 * Every Myanmar station in GHCN-Daily (ghcnd-stations.txt, country code BM, checked 15 Nov 2026).
 * There are only five, all airports, so the harness checks regional grids against a sparse network.
 */
export const MYANMAR_GHCN_STATIONS: GhcnStation[] = [
  { id: "BMM00048097", name: "Yangon International", lat: 16.907, lon: 96.133, elevationM: 33.2, region: "yangon-delta-edge" },
  { id: "BMM00048042", name: "Mandalay", lat: 21.983, lon: 96.1, elevationM: 76, region: "mandalay-dry-zone" },
  { id: "BMM00048062", name: "Sittwe", lat: 20.133, lon: 92.873, elevationM: 8.2, region: "rakhine-coast" },
  { id: "BMM00048008", name: "Myitkyina", lat: 25.367, lon: 97.4, elevationM: 147, region: "kachin-north" },
  { id: "BMM00048112", name: "Kawthaung (Victoria Point)", lat: 9.967, lon: 98.583, elevationM: 47, region: "tanintharyi-south" },
];

export interface GhcnDaily {
  stationId: string;
  /** ISO date -> value in mm (PRCP) or °C (TMAX/TMIN). Only QC-passed values are present. */
  prcp: Map<string, number>;
  tmax: Map<string, number>;
  tmin: Map<string, number>;
  /** Values present in the file but dropped for a quality flag. */
  qcRejected: { prcp: number; tmax: number; tmin: number };
}

/** Split one CSV line, honouring double quotes (attribute strings contain commas). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** True when the attribute string's quality flag (second field) is blank. */
export function passesQc(attributes: string | undefined): boolean {
  if (!attributes) return true;
  const q = attributes.split(",")[1] ?? "";
  return q.trim() === "";
}

export function parseGhcnCsv(csv: string, stationId: string): GhcnDaily {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new Error(`GHCN file for ${stationId} is empty`);
  const header = splitCsvLine(lines[0]);
  const col = (name: string) => header.indexOf(name);
  const iDate = col("DATE");
  if (iDate < 0) throw new Error(`GHCN file for ${stationId} has no DATE column`);

  const out: GhcnDaily = { stationId, prcp: new Map(), tmax: new Map(), tmin: new Map(), qcRejected: { prcp: 0, tmax: 0, tmin: 0 } };
  const elements = [
    { key: "prcp", name: "PRCP" },
    { key: "tmax", name: "TMAX" },
    { key: "tmin", name: "TMIN" },
  ] as const;
  const idx = elements.map((e) => ({ ...e, v: col(e.name), a: col(`${e.name}_ATTRIBUTES`) }));

  for (let li = 1; li < lines.length; li++) {
    const f = splitCsvLine(lines[li]);
    const date = f[iDate];
    for (const e of idx) {
      if (e.v < 0) continue;
      const raw = f[e.v]?.trim();
      if (!raw) continue;
      const tenths = Number(raw);
      if (!Number.isFinite(tenths) || tenths === -9999) continue;
      if (!passesQc(e.a >= 0 ? f[e.a] : undefined)) {
        out.qcRejected[e.key]++;
        continue;
      }
      out[e.key].set(date, tenths / 10);
    }
  }
  return out;
}
