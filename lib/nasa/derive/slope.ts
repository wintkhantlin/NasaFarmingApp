/**
 * Terrain slope from a regular grid of elevations in a geographic CRS (SRTM, about 1 arc-second).
 * Cell spacing is converted to metres first (a degree of longitude shrinks with latitude), then the
 * Horn (1981) 3x3 method is used so one noisy cell does not decide the slope.
 */

export interface ElevationGrid {
  /** Row-major, north row first. null for fill (-32768) or no data. */
  values: Array<number | null>;
  width: number;
  height: number;
  /** Cell size in degrees. */
  dLonDeg: number;
  dLatDeg: number;
  /** Latitude of the grid centre, degrees. */
  centreLatDeg: number;
}

const M_PER_DEG_LAT = 111_320;

export function cellSizeMetres(grid: Pick<ElevationGrid, "dLonDeg" | "dLatDeg" | "centreLatDeg">) {
  const dy = grid.dLatDeg * M_PER_DEG_LAT;
  const dx = grid.dLonDeg * M_PER_DEG_LAT * Math.cos((grid.centreLatDeg * Math.PI) / 180);
  return { dx, dy };
}

export interface SlopeSummary {
  /** Slope in degrees for each interior cell with a complete 3x3 neighbourhood; null elsewhere. */
  grid: Array<number | null>;
  validCells: number;
  totalCells: number;
  medianDeg: number | null;
  p90Deg: number | null;
  meanDeg: number | null;
}

/** The numbers worth keeping and sending to the browser. The per-cell grid is dropped. */
export type SlopeStats = Omit<SlopeSummary, "grid">;

export function slopeStats(s: SlopeSummary): SlopeStats {
  const { medianDeg, p90Deg, meanDeg, validCells, totalCells } = s;
  return { medianDeg, p90Deg, meanDeg, validCells, totalCells };
}

export function slopeGrid(g: ElevationGrid): SlopeSummary {
  const { dx, dy } = cellSizeMetres(g);
  const out: Array<number | null> = new Array(g.values.length).fill(null);
  const at = (r: number, c: number) => g.values[r * g.width + c];
  const vals: number[] = [];
  for (let r = 1; r < g.height - 1; r++) {
    for (let c = 1; c < g.width - 1; c++) {
      const z = [
        at(r - 1, c - 1), at(r - 1, c), at(r - 1, c + 1),
        at(r, c - 1), at(r, c), at(r, c + 1),
        at(r + 1, c - 1), at(r + 1, c), at(r + 1, c + 1),
      ];
      if (z.some((v) => v === null)) continue; // a single sampled cell never gives a slope
      const [a, b, cc, d, , f, gg, h, i] = z as number[];
      const dzdx = (cc + 2 * f + i - (a + 2 * d + gg)) / (8 * dx);
      // north row is first, so y increases upward
      const dzdy = (gg + 2 * h + i - (a + 2 * b + cc)) / (8 * dy);
      const deg = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
      out[r * g.width + c] = deg;
      vals.push(deg);
    }
  }
  const sorted = [...vals].sort((x, y) => x - y);
  const pct = (p: number) => {
    if (sorted.length === 0) return null;
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return {
    grid: out,
    validCells: vals.length,
    totalCells: g.values.length,
    medianDeg: pct(0.5),
    p90Deg: pct(0.9),
    meanDeg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
  };
}

/** Plain-language steepness class. These bands are an analyst choice, not a standard. */
export function steepnessClass(medianDeg: number | null): "unknown" | "gentle" | "moderate" | "steep" {
  if (medianDeg === null) return "unknown";
  if (medianDeg < 5) return "gentle";
  if (medianDeg < 15) return "moderate";
  return "steep";
}
