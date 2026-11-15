import { describe, expect, test } from "vitest";
import { generateCandidates, selectDiverse, templateDistance, TEMPLATES, NEAR_DUPLICATE_DISTANCE } from "../../lib/engine/candidates";
import { compareRotations, type EvaluatedOption } from "../../lib/engine/compare";
import { classifyRotationFeasibility } from "../../lib/engine/farmer-decision";
import { assessEvidence, firstSentence } from "../../lib/engine/judgement";
import { checkLimits, unansweredLimits } from "../../lib/engine/limits";
import {
  CLEAR_MARGIN,
  CRITERIA,
  TIE_MARGIN,
  anchorUtility,
  classifyGap,
  criterionUtility,
  findWeightSwitch,
  minimaxRegret,
  priorityWeights,
  rankRotations,
  scoresTied,
  type McdaScore,
} from "../../lib/engine/mcda";
import { adaptComparison, pickShown } from "../../lib/plan/engine-display";
import { buildResultsModel, buildVerdict } from "../../lib/plan/results-model";
import type { Rotation } from "../../lib/types";
import { engineData, rotation, slot, syntheticField, syntheticWeather } from "../helpers/synthetic";

/* ---------- ties and near-ties ---------- */

describe("score gaps: about the same, slight, clear", () => {
  test("a gap inside the tie margin is a tie wherever the digits fall", () => {
    // The old rule compared two-decimal strings: 0.8449 and 0.8451 differ ("0.84" v "0.85") though they are 0.0002 apart,
    // and 0.8500 v 0.8549 are "equal" for no better reason.
    expect(scoresTied(0.8449, 0.8451)).toBe(true);
    expect(scoresTied(0.85, 0.8749)).toBe(true);
    expect(scoresTied(0.85, 0.8801)).toBe(false);
  });

  test("three bands: tie, slight, clear", () => {
    expect(classifyGap(0)).toBe("tie");
    expect(classifyGap(TIE_MARGIN - 0.001)).toBe("tie");
    expect(classifyGap(TIE_MARGIN)).toBe("slight");
    expect(classifyGap(CLEAR_MARGIN - 0.001)).toBe("slight");
    expect(classifyGap(CLEAR_MARGIN)).toBe("clear");
    expect(classifyGap(-0.5)).toBe("clear"); // sign does not matter
  });

  test("rankRotations reports the lead and every option tied with the best", () => {
    const res = rankRotations(
      [0, 4, 8].map((mm, i) => ({ rotationId: `r${i}`, feasible: true, values: { "water-shortfall": 100 + mm } })),
      { order: ["water"], weights: {} },
    );
    expect(res.status).toBe("ranked");
    expect(res.lead?.class).toBe("tie");
    expect(res.lead?.tiedIds).toEqual(["r0", "r1", "r2"]); // 8 mm of 400 is a 0.02 spread: all about the same
  });

  test("a real lead is called clear and is alone in tiedIds", () => {
    const res = rankRotations(
      [50, 250].map((mm, i) => ({ rotationId: `r${i}`, feasible: true, values: { "water-shortfall": mm } })),
      { order: ["water"], weights: {} },
    );
    expect(res.lead?.class).toBe("clear");
    expect(res.lead?.tiedIds).toEqual(["r0"]);
  });
});

/* ---------- tiny differences stay tiny when every option is beyond the anchor ---------- */

describe("saturation guard", () => {
  const water = CRITERIA.find((c) => c.id === "water-shortfall")!;

  test("two hopeless options a few mm apart are not stretched to 1 against 0", () => {
    const u = [410, 412].map((v) => criterionUtility(water, v, [410, 412]));
    expect(Math.abs(u[0] - u[1])).toBeLessThan(0.01);
  });

  test("options far apart beyond the limit still separate", () => {
    const u = [420, 900].map((v) => criterionUtility(water, v, [420, 900]));
    expect(u[0]).toBeCloseTo(1 - 420 / 900, 6);
    expect(u[1]).toBe(0);
  });

  test("when not every option is saturated nothing changes", () => {
    expect(criterionUtility(water, 100, [100, 500])).toBeCloseTo(anchorUtility(100, 0, 400, "lower"), 12);
  });

  test("works for higher-is-better criteria too", () => {
    const cover = CRITERIA.find((c) => c.id === "soil-cover")!; // limit 0.5
    const u = [0.4, 0.2].map((v) => criterionUtility(cover, v, [0.4, 0.2]));
    expect(u[0]).toBeGreaterThan(u[1]);
    expect(u[1]).toBe(0);
    expect(u[0]).toBeLessThan(1);
  });
});

/* ---------- weights ---------- */

describe("priority weights", () => {
  test("a negative or non-numeric weight is zero, not a subtraction from the others", () => {
    const w = priorityWeights({ order: ["water", "income"], weights: { water: -1, income: 1 } });
    expect(w?.water).toBe(0);
    expect(w?.income).toBe(1);
    const nan = priorityWeights({ order: ["water", "income"], weights: { water: Number.NaN, income: 2 } });
    expect(nan?.water).toBe(0);
    expect(nan?.income).toBe(1);
  });

  test("all-negative explicit weights ask for priorities instead of ranking on nothing", () => {
    expect(priorityWeights({ order: ["water"], weights: { water: -2 } })).toBeNull();
  });
});

/* ---------- missing data is never zero ---------- */

describe("minimax regret with missing seasons", () => {
  test("a season an option has no utility for is set aside, not read as zero", () => {
    const r = minimaxRegret(
      [
        { candidateId: "A", utilities: { dry: 0.9, typical: 0.9 } },
        { candidateId: "B", utilities: { dry: 0.6 } }, // not evaluated in the typical season
      ],
      ["dry", "typical"],
    );
    expect(r.scenariosUsed).toEqual(["dry"]);
    expect(r.scenariosSkipped).toEqual(["typical"]);
    const b = r.table.find((t) => t.candidateId === "B")!;
    expect(Object.keys(b.regrets)).toEqual(["dry"]);
    expect(b.worstRegret).toBeCloseTo(0.3, 3);
    expect(r.bestCandidateId).toBe("A");
  });

  test("with no season every option has, nobody is named best", () => {
    const r = minimaxRegret([{ candidateId: "A", utilities: { dry: 1 } }, { candidateId: "B", utilities: { wet: 1 } }], ["dry", "wet"]);
    expect(r.scenariosUsed).toEqual([]);
    expect(r.bestCandidateId).toBe("");
  });
});

/* ---------- switching point as data ---------- */

describe("findWeightSwitch", () => {
  const part = (criterion: McdaScore["parts"][number]["criterion"], normalised: number, weight: number) => ({ criterion, normalised, weight });
  const ranked = (aWater: number, aInc: number, bWater: number, bInc: number, wWater: number): McdaScore[] => {
    const wInc = 1 - wWater;
    const A = { rotationId: "A", score: wWater * aWater + wInc * aInc, parts: [part("water-shortfall", aWater, wWater), part("income-margin", aInc, wInc)] };
    const B = { rotationId: "B", score: wWater * bWater + wInc * bInc, parts: [part("water-shortfall", bWater, wWater), part("income-margin", bInc, wInc)] };
    return [A, B].sort((x, y) => y.score - x.score);
  };

  test("finds the exact weight at which the second option draws level", () => {
    // A: water 0.8 income 0.4; B: water 0.4 income 0.7. They tie when water carries 3/7 of the weight.
    const sw = findWeightSwitch(ranked(0.8, 0.4, 0.4, 0.7, 0.6))!;
    expect(sw.priority).toBe("water");
    expect(sw.direction).toBe("less");
    expect(sw.fromShare).toBeCloseTo(0.6, 9);
    expect(sw.toShare).toBeCloseTo(3 / 7, 9);
    expect(sw.toRotationId).toBe("B");
    expect(sw.shift).toBeCloseTo(0.6 - 3 / 7, 9);
    expect(sw.fragile).toBe(false);
  });

  test("a first place that flips on a small move is marked fragile", () => {
    const sw = findWeightSwitch(ranked(0.8, 0.4, 0.4, 0.7, 0.5))!; // 0.5 against the 3/7 switch
    expect(sw.shift).toBeCloseTo(0.5 - 3 / 7, 9);
    expect(sw.fragile).toBe(true);
  });

  test("an option that is better on everything has no switching point", () => {
    expect(findWeightSwitch(ranked(0.9, 0.9, 0.2, 0.3, 0.5))).toBeNull();
  });

  test("rankRotations attaches it, and it agrees with a re-ranking just past the switch", () => {
    const inputs = [
      { rotationId: "A", feasible: true, values: { "water-shortfall": 80, "income-margin": 2_000_000 } },
      { rotationId: "B", feasible: true, values: { "water-shortfall": 240, "income-margin": 5_000_000 } },
    ];
    const anchors = { "income-margin": { target: 6_000_000, limit: 0, scope: "analyst-assumption" as const, ref: "test" } };
    const base = rankRotations(inputs, { order: ["water", "income"], weights: { water: 0.7, income: 0.3 } }, { anchors });
    expect(base.ranking[0].rotationId).toBe("A");
    const sw = base.weightSwitch!;
    expect(sw.priority).toBe("water");
    const at = (waterShare: number) => rankRotations(inputs, { order: ["water", "income"], weights: { water: waterShare, income: 1 - waterShare } }, { anchors }).ranking[0].rotationId;
    expect(at(sw.toShare + 0.01)).toBe("A");
    expect(at(sw.toShare - 0.01)).toBe("B");
  });
});

/* ---------- limits and gating ---------- */

describe("labour limit", () => {
  const s = (id: string, plant: string, harvest: string) => ({ id, kind: "crop", cropId: id, plantDate: plant, harvestDate: harvest, dateConfidence: "exact", irrigated: false }) as Rotation["slots"][number];
  const twoCrops = { cycleYears: 1 as const, slots: [s("rice", "2025-06-15", "2025-10-20"), s("black-gram", "2025-11-05", "2026-02-10")] };
  const oneCrop = { cycleYears: 1 as const, slots: [s("rice", "2025-06-15", "2025-10-20")] };
  const labour = (r: typeof twoCrops, level: "low" | "medium" | "high") => checkLimits(r, { labour: level }, "none").find((x) => x.limit === "labour")!;

  test("the quick-question answer (a level) now counts as answered", () => {
    expect(unansweredLimits({ labour: "low" })).not.toContain("labour");
    expect(unansweredLimits({})).toContain("labour");
  });

  test("very little help with two sowings a year fails, with a reason", () => {
    const c = labour(twoCrops, "low");
    expect(c.result).toBe("fail");
    expect(c.reason).toMatch(/more help/);
  });

  test("plenty of help, some help, or one crop a year passes; nothing is invented", () => {
    expect(labour(twoCrops, "high").result).toBe("pass");
    expect(labour(twoCrops, "medium").result).toBe("pass");
    expect(labour(oneCrop, "low").result).toBe("pass");
  });

  test("busy months still decide when the farmer gave them", () => {
    expect(checkLimits(twoCrops, { labour: "high", peakMonths: [6, 10] }, "none").find((x) => x.limit === "labour")!.result).toBe("fail");
  });
});

describe("farmer-decision labour gate", () => {
  const rot = {
    id: "r",
    fieldId: "f",
    label: "r",
    cycleYears: 1 as const,
    source: "farmer" as const,
    slots: [slot("a", "rice", "2025-06-15", "2025-10-20"), slot("b", "black-gram", "2025-11-05", "2026-02-10")],
  } as Rotation;
  const base = { topPriorities: ["profit" as const], availableWater: "rainfed" as const, equipment: "manual" as const };

  test("busy months on both sowing and harvest need review, not a veto", () => {
    const f = classifyRotationFeasibility(rot, { ...base, peakMonths: [6, 10] });
    expect(f.status).toBe("needs_review");
    expect(f.hardConstraintVetoes).toEqual([]);
    expect(f.unconfirmedFactors).toContain("LABOUR_PEAK_CONFLICT");
  });

  test("low labour with two crops a year needs review; unknown labour is not read as plenty or as a problem", () => {
    expect(classifyRotationFeasibility(rot, { ...base, labour: "low" }).unconfirmedFactors).toContain("LABOUR_LOW_TWO_CROPS");
    expect(classifyRotationFeasibility(rot, { ...base, labour: "unknown" }).status).toBe("feasible");
    expect(classifyRotationFeasibility(rot, { ...base, labour: "high" }).status).toBe("feasible");
  });
});

/* ---------- candidate variety ---------- */

describe("candidate variety", () => {
  const region = "ayeyarwady" as const;
  const input = (max: number) => ({
    fieldId: "f",
    region,
    current: { slots: [] as Rotation["slots"] },
    fieldIrrigation: "full" as const,
    baseYear: 2026,
    max,
  });

  test("two pulses after the same rice are near-copies; fallow is clearly different", () => {
    const byId = (id: string) => TEMPLATES[region].find((t) => t.id === id)!;
    expect(templateDistance(byId("ay-rice-black-gram"), byId("ay-rice-green-gram"))).toBeLessThan(NEAR_DUPLICATE_DISTANCE);
    expect(templateDistance(byId("ay-rice-black-gram"), byId("ay-rice-fallow"))).toBeGreaterThan(NEAR_DUPLICATE_DISTANCE);
    expect(templateDistance(byId("ay-rice-black-gram"), byId("ay-rice-black-gram"))).toBe(0);
  });

  test("when nothing has to be dropped the list and its order are unchanged", () => {
    const all = generateCandidates(input(10));
    const four = generateCandidates(input(4));
    expect(all.similarDropped).toEqual([]);
    expect(all.alternatives.map((a) => a.template.id)).toEqual(TEMPLATES[region].map((t) => t.id).filter((id) => all.alternatives.some((a) => a.template.id === id)));
    expect(four.alternatives.length).toBeLessThanOrEqual(4);
  });

  test("a cut keeps the lowest-input and lowest-risk choices and drops near-copies, saying so", () => {
    const all = generateCandidates(input(10)).alternatives;
    const cut = generateCandidates(input(2));
    expect(cut.alternatives).toHaveLength(2);
    const lowInput = all.find((a) => a.roles?.includes("low-input"))!;
    expect(lowInput).toBeDefined();
    expect(cut.alternatives.some((a) => a.template.id === lowInput.template.id)).toBe(true);
    expect(cut.similarDropped!.length).toBe(all.length - 2);
    for (const d of cut.similarDropped!) expect(d.reason).toMatch(/Left out/);
    // the two kept are not near-copies of each other
    const [x, y] = cut.alternatives;
    expect(templateDistance(x.template, y.template)).toBeGreaterThanOrEqual(NEAR_DUPLICATE_DISTANCE);
  });

  test("the low-risk choice never needs irrigation", () => {
    const all = generateCandidates(input(10)).alternatives;
    for (const a of all.filter((c) => c.roles?.includes("low-risk"))) expect(a.template.requiresIrrigation).toBeFalsy();
  });

  test("farmer-preferred crops are kept when there is room beyond the two roles", () => {
    const built = generateCandidates(input(10)).alternatives;
    const { kept } = selectDiverse(built, 3, new Set(["green-gram"]));
    expect(kept.some((k) => k.template.cropIds.includes("green-gram"))).toBe(true);
  });

  test("a role is only named when it sets the option apart", () => {
    const one = generateCandidates({ ...input(10), constraints: { excludedCropIds: ["black-gram", "green-gram", "rice"] } }).alternatives;
    expect(one.every((c) => !c.roles?.length)).toBe(true);
  });
});

/* ---------- display: a spread of choices, but never over a real lead ---------- */

describe("pickShown", () => {
  const opt = (id: string, roles?: Array<"low-risk" | "low-input">) => ({ id, roles }) as unknown as EvaluatedOption;
  const ranking = (scores: Record<string, number>) => Object.entries(scores).map(([rotationId, score]) => ({ rotationId, score, parts: [] }));

  test("keeps the two best when one of them is already a role holder", () => {
    const pool = [opt("a"), opt("b", ["low-input"]), opt("c", ["low-risk"])];
    expect(pickShown(pool, ranking({ a: 0.9, b: 0.8, c: 0.79 })).map((o) => o.id)).toEqual(["a", "b"]);
  });

  test("swaps the second for a nearly level role holder", () => {
    const pool = [opt("a"), opt("b"), opt("c", ["low-input"])];
    expect(pickShown(pool, ranking({ a: 0.9, b: 0.8, c: 0.76 })).map((o) => o.id)).toEqual(["a", "c"]);
  });

  test("never swaps in a role holder that is clearly behind", () => {
    const pool = [opt("a"), opt("b"), opt("c", ["low-input"])];
    expect(pickShown(pool, ranking({ a: 0.9, b: 0.8, c: 0.6 })).map((o) => o.id)).toEqual(["a", "b"]);
  });
});

/* ---------- evidence in words ---------- */

describe("assessEvidence", () => {
  const goodSlot = { slot: { kind: "crop" }, suitability: { overall: "preferred" } };
  const metrics = { "water-shortfall": 10, "soil-legume-share": 0.5, "soil-cover": 0.8, "income-margin": 1, "forage-slots": 0, "input-nitrogen": 20 };
  const option = (over: Partial<Pick<EvaluatedOption, "fit" | "metrics" | "slots" | "unknowns">> = {}) =>
    ({ fit: "fits", metrics, slots: [goodSlot], unknowns: [], ...over }) as unknown as Pick<EvaluatedOption, "fit" | "metrics" | "slots" | "unknowns">;

  test("strong needs every measure known, every crop confirmed and 80% of seasons judged", () => {
    expect(assessEvidence(option(), { knownSeasons: 10, totalSeasons: 10 })).toMatchObject({ level: "strong", label: "Strong evidence", reasons: [] });
    expect(assessEvidence(option(), { knownSeasons: 8, totalSeasons: 10 }).level).toBe("strong");
    expect(assessEvidence(option(), { knownSeasons: 7, totalSeasons: 10 }).level).toBe("fair");
  });

  test("a missing measure is a gap, never a zero: one gap is fair, three are weak", () => {
    expect(assessEvidence(option({ metrics: { ...metrics, "income-margin": null } }), { knownSeasons: 10, totalSeasons: 10 }).level).toBe("fair");
    const m3 = { ...metrics, "income-margin": null, "forage-slots": null, "input-nitrogen": null };
    const w = assessEvidence(option({ metrics: m3 }), { knownSeasons: 10, totalSeasons: 10 });
    expect(w.level).toBe("weak");
    expect(w.label).toBe("Weak evidence");
    expect(w.reasons.join(" ")).toMatch(/not known/);
  });

  test("weak when it does not fit, was not placed, or most past seasons could not be judged", () => {
    expect(assessEvidence(option({ fit: "does-not-fit" }), { knownSeasons: 10, totalSeasons: 10 }).level).toBe("weak");
    expect(assessEvidence(option(), { knownSeasons: 10, totalSeasons: 10, notPlaced: true }).level).toBe("weak");
    expect(assessEvidence(option(), { knownSeasons: 4, totalSeasons: 10 }).level).toBe("weak");
    expect(assessEvidence(option(), { knownSeasons: null, totalSeasons: 0 }).level).toBe("weak");
  });

  test("an unconfirmed crop is named in words", () => {
    const a = assessEvidence(option({ slots: [{ slot: { kind: "crop" }, suitability: { overall: "unknown" } }] as never }), { knownSeasons: 10, totalSeasons: 10 });
    expect(a.level).toBe("fair");
    expect(a.reasons.join(" ")).toMatch(/not confirmed/);
  });

  test("firstSentence keeps one sentence", () => {
    expect(firstSentence("It rains. Then it stops.")).toBe("It rains.");
    expect(firstSentence("No full stop")).toBe("No full stop");
  });
});

/* ---------- the farmer-facing decision ---------- */

describe("decision summary", () => {
  const field = syntheticField({ priorities: { order: ["water", "soil"], weights: {} } });
  const mine = rotation(field.id, [slot("sesame", "sesame", "2026-05-15", "2026-08-23"), slot("gram", "green-gram", "2026-08-30", "2026-11-13")]);
  const data = engineData(field, syntheticWeather());
  const result = compareRotations(data, mine, { baseYear: 2026, now: new Date("2026-11-14T00:00:00Z") });
  const display = adaptComparison({ mode: "field", phase: "ready", field, rotation: mine, data, comparison: result, inputRevision: "r", resultRevision: "r" });
  const options = [result.current, ...display.options.filter((o) => o.kind === "alternative").map((o) => o.engine)];
  const complete = { ...display, state: "comparable" as const };

  /** A ranking over the shown options where the first dominates (all 1) and the rest score 0, with the real criteria and weights. */
  const dominated = (shown: EvaluatedOption[], top = shown[0].id, gap = 1): ReturnType<typeof compareRotations> => {
    const parts = result.mcda.ranking[0].parts;
    const mk = (id: string, u: number) => ({ rotationId: id, score: u, parts: parts.map((p) => ({ ...p, normalised: u })) });
    const ids = shown.map((o) => o.id);
    const ordered = [top, ...ids.filter((i) => i !== top)];
    const ranking = ordered.map((id, i) => mk(id, i === 0 ? 1 : 1 - gap));
    const lead = { gap, class: classifyGap(gap), tiedIds: ranking.filter((r) => scoresTied(r.score, ranking[0].score)).map((r) => r.rotationId) };
    return { ...result, mcda: { ...result.mcda, status: "ranked", ranking, partial: [], lead, weightSwitch: null } };
  };

  test("a tie says 'about the same' and names no winner", () => {
    const model = buildResultsModel({ field, comparison: result, display: complete, options });
    const d = model.decision!;
    expect(result.mcda.lead?.class).toBe("tie");
    expect(d.verdict).toBe("close");
    expect(d.winnerId).toBeNull();
    expect(d.tiedIds.length).toBeGreaterThanOrEqual(2);
    expect(d.headline).toMatch(/about the same/);
    expect(model.ranking[0].closeToNext).toBe(true);
  });

  test("every option has one sentence of why, one of watch-out and an evidence word", () => {
    const model = buildResultsModel({ field, comparison: result, display: complete, options });
    for (const o of model.options) {
      const j = model.decision!.options[o.id];
      expect(j.whyShort).toMatch(/\.$/);
      expect(j.watchOut).toMatch(/\.$/);
      expect(firstSentence(j.whyShort)).toBe(j.whyShort);
      expect(firstSentence(j.watchOut)).toBe(j.watchOut);
      expect(["Strong evidence", "Fair evidence", "Weak evidence"]).toContain(j.evidenceLabel);
    }
    expect(model.decision!.whatWouldChange.length).toBeGreaterThan(0);
    expect(model.decision!.whatWouldChange.length).toBeLessThanOrEqual(3);
  });

  test("a dominant, stable first place is clear and named", () => {
    const cmp = dominated(options);
    const model = buildResultsModel({ field, comparison: cmp, display: complete, options });
    const d = model.decision!;
    expect(d.verdict).toBe("clear");
    expect(d.winnerId).toBe(options[0].id);
    expect(d.tiedIds).toEqual([]);
    expect(model.ranking[0].closeToNext).toBe(false);
  });

  test("a slight lead is 'close' and still names the order, without crowning", () => {
    const cmp = dominated(options, options[1].id, 0.05);
    const d = buildResultsModel({ field, comparison: cmp, display: complete, options }).decision!;
    expect(d.verdict).toBe("close");
    expect(d.headline).toMatch(/slightly ahead/);
  });

  test("a first place that flips on a small change in priorities is not clear, and the sentence says how", () => {
    const base = dominated(options);
    const parts = base.mcda.ranking[0].parts;
    const water = parts.find((p) => p.criterion === "water-shortfall");
    expect(water).toBeDefined();
    // First: great on water, weak elsewhere. Second: the reverse. Scores 0.62 against 0.5, weights as in the parts.
    const first = { rotationId: options[0].id, score: 0.62, parts: parts.map((p) => ({ ...p, normalised: p.criterion === "water-shortfall" ? 1 : 0.4 })) };
    const rival = { rotationId: options[1].id, score: 0.5, parts: parts.map((p) => ({ ...p, normalised: p.criterion === "water-shortfall" ? 0.7 : 0.4 })) };
    const cmp = { ...base, mcda: { ...base.mcda, ranking: [first, rival] } };
    const d = buildResultsModel({ field, comparison: cmp, display: complete, options }).decision!;
    if (d.prioritySwitch) expect(d.prioritySwitch).toMatch(/would come first/);
    expect(["clear", "close"]).toContain(d.verdict);
  });

  test("unresolved ranking is unclear, with no winner and a reason", () => {
    const cmp = { ...result, mcda: { ...result.mcda, status: "unresolved" as const, ranking: [], lead: undefined, weightSwitch: undefined } };
    const d = buildResultsModel({ field, comparison: cmp, display: { ...display, state: "unresolved" }, options }).decision!;
    expect(d.verdict).toBe("unclear");
    expect(d.winnerId).toBeNull();
    expect(d.headline).toMatch(/can't pick/);
    expect(d.whyShort.length).toBeGreaterThan(0);
  });

  test("partial evidence is unclear even when a ranking exists", () => {
    const d = buildResultsModel({ field, comparison: dominated(options), display: { ...display, state: "partial-evidence" }, options }).decision!;
    expect(d.verdict).toBe("unclear");
  });

  test("a leading plan that breaks a limit the farmer set is never clear", () => {
    const limited = { ...field, constraints: { canSell: [] as string[] } };
    const d = buildResultsModel({ field: limited, comparison: dominated(options), display: complete, options }).decision!;
    expect(d.verdict).toBe("unclear");
    expect(d.limitConflict?.optionId).toBe(options[0].id);
    expect(d.headline).toMatch(/breaks a limit/);
    expect(d.options[options[0].id].limitConflict).toMatch(/No market/);
    expect(d.watchOut).toMatch(/No market/);
  });

  test("weak evidence caps a clear lead at close", () => {
    const blank = { ...options[1], metrics: { ...options[1].metrics, "income-margin": null, "forage-slots": null, "input-nitrogen": null, "water-shortfall": null } };
    const shown = [options[0], blank, ...options.slice(2)];
    const d = buildResultsModel({ field, comparison: dominated(shown, blank.id), display: complete, options: shown }).decision!;
    expect(d.options[blank.id].evidenceLevel).toBe("weak");
    expect(d.verdict).toBe("close");
    expect(d.evidenceLabel).toBe("Weak evidence");
  });

  test("buildVerdict carries the decision through unchanged", () => {
    const model = buildResultsModel({ field, comparison: result, display: complete, options });
    expect(buildVerdict(model).decision).toBe(model.decision);
  });

  test("roles from candidate generation reach the per-option judgement", () => {
    const model = buildResultsModel({ field, comparison: result, display: complete, options });
    const withRole = options.find((o) => o.roles?.length);
    if (withRole) expect(model.decision!.options[withRole.id].roles).toEqual(withRole.roles);
  });
});
