import type { ComparisonResult, EvaluatedOption, FitStatus } from "./compare";
import { knownCount, seasonStrip, stressedCount, type StripYear } from "./strip";

/** How one option looks on one side of the test, in the same terms the farmer already sees on the page. */
export interface WhatIfSide {
  strip: StripYear[];
  /** Past seasons with a shortfall of rain or heat at a sensitive stage. */
  stressed: number;
  /** Past seasons we could judge at all. */
  known: number;
  fit: FitStatus;
  /** 1-based place in the ranking, or null when nothing was ranked. */
  place: number | null;
}

export type Movement = "worse" | "better" | "same" | "unknown";

export interface WhatIfOption {
  id: string;
  label: string;
  isYours: boolean;
  /** null when the test brought this option in (a different water supply can unlock new options). */
  before: WhatIfSide | null;
  after: WhatIfSide;
  /** Seasons added (+) or removed (-) from the stressed count. null when it cannot be compared. */
  delta: number | null;
  movement: Movement;
  fitChanged: boolean;
}

export interface WhatIfBest {
  beforeId: string | null;
  afterId: string | null;
  beforeLabel: string | null;
  afterLabel: string | null;
  changed: boolean;
  /** The test left nothing ranked, though the untested view ranked something. */
  lost: boolean;
}

export interface WhatIfResult {
  options: WhatIfOption[];
  best: WhatIfBest;
  /** Option with the lowest share of stressed seasons under the test. Null when no option can be judged. */
  holdsUp: WhatIfOption | null;
  /** Option that lost the most seasons under the test. Null when none got worse. */
  hardestHit: WhatIfOption | null;
  counts: { worse: number; better: number; same: number };
  /** Options that were on the page before the test and are gone under it. */
  dropped: string[];
}

const yearsOf = (o: EvaluatedOption) => [...new Set(o.slots.flatMap((e) => e.water?.seasons.map((x) => x.year) ?? []))].sort();

function sideOf(o: EvaluatedOption, years: number[], cmp: ComparisonResult): WhatIfSide {
  const strip = seasonStrip(o, years);
  const i = cmp.mcda.status === "ranked" ? cmp.mcda.ranking.findIndex((r) => r.rotationId === o.id) : -1;
  return { strip, stressed: stressedCount(strip), known: knownCount(strip), fit: o.fit, place: i >= 0 ? i + 1 : null };
}

const share = (s: WhatIfSide) => (s.known === 0 ? Infinity : s.stressed / s.known);

/**
 * Sets the untested view beside the tested one. Both come from the same engine on the same record,
 * so a difference here is caused by the test alone.
 */
export function whatIfResult(base: ComparisonResult, test: ComparisonResult, opts: { includeCurrent: boolean }): WhatIfResult {
  const all = (c: ComparisonResult) => (opts.includeCurrent ? [...c.alternatives, c.current] : [...c.alternatives]);
  const baseById = new Map(all(base).map((o) => [o.id, o]));
  const testOptions = all(test);

  const options: WhatIfOption[] = testOptions.map((o) => {
    const years = yearsOf(o);
    const after = sideOf(o, years, test);
    const b = baseById.get(o.id);
    const before = b ? sideOf(b, years, base) : null;
    const comparable = before !== null && before.known > 0 && after.known > 0;
    const delta = comparable ? after.stressed - before.stressed : null;
    return {
      id: o.id,
      label: o.label,
      isYours: opts.includeCurrent && o.id === test.current.id,
      before,
      after,
      delta,
      movement: delta === null ? "unknown" : delta > 0 ? "worse" : delta < 0 ? "better" : "same",
      fitChanged: before !== null && before.fit !== after.fit,
    };
  });

  const testIds = new Set(testOptions.map((o) => o.id));
  const dropped = all(base).filter((o) => !testIds.has(o.id)).map((o) => o.label);

  const top = (c: ComparisonResult) => (c.mcda.status === "ranked" ? (c.mcda.ranking[0]?.rotationId ?? null) : null);
  const labelOf = (id: string | null) => (id === null ? null : ([...all(base), ...testOptions].find((o) => o.id === id)?.label ?? null));
  const beforeId = top(base);
  const afterId = top(test);
  const best: WhatIfBest = {
    beforeId,
    afterId,
    beforeLabel: labelOf(beforeId),
    afterLabel: labelOf(afterId),
    changed: beforeId !== afterId,
    lost: beforeId !== null && afterId === null,
  };

  const judged = options.filter((o) => o.after.known > 0 && o.after.fit !== "does-not-fit");
  const holdsUp = judged.length === 0 ? null : [...judged].sort((a, b) => share(a.after) - share(b.after) || (a.delta ?? 0) - (b.delta ?? 0))[0];
  const hit = options.filter((o) => (o.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0] ?? null;

  return {
    options,
    best,
    holdsUp,
    hardestHit: hit,
    counts: {
      worse: options.filter((o) => o.movement === "worse").length,
      better: options.filter((o) => o.movement === "better").length,
      same: options.filter((o) => o.movement === "same").length,
    },
    dropped,
  };
}
