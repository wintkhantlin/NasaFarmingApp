import { describe, expect, test } from "vitest";
import type { DailyRecord } from "../../lib/engine/climate";
import { pestOutlook } from "../../lib/engine/pest-outlook";
import { rotation, slot } from "../helpers/synthetic";

const YEARS = { start: 2016, end: 2025 };

/** One record per day for 2016–2026 from a function of the date. */
function records(day: (iso: string, year: number) => Partial<DailyRecord>): DailyRecord[] {
  const out: DailyRecord[] = [];
  for (let t = Date.UTC(2016, 0, 1); t <= Date.UTC(2026, 11, 31); t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const year = Number(date.slice(0, 4));
    const base: DailyRecord = { date, year, month: Number(date.slice(5, 7)), doy: 0, tmaxC: 31, tminC: 18, tmeanC: 24, rainMm: 5, et0Mm: 4, rootWetness: 0.5, rhPct: 70 };
    out.push({ ...base, ...day(date, year) });
  }
  return out;
}

const riceThenGram = rotation("f", [slot("rice", "rice", "2026-06-15", "2026-10-20"), slot("gram", "green-gram", "2026-11-01", "2027-01-30")]);

describe("weather replay", () => {
  test("blast weather every August is 'most years' and peaks in Aug", () => {
    const recs = records((d) => (d.slice(5, 7) === "08" ? { tminC: 23, rhPct: 93 } : {}));
    const out = pestOutlook({ rotation: riceThenGram, records: recs, years: YEARS });
    const blast = out.crops[0].weather.find((w) => w.ruleId === "rice-blast")!;
    expect(blast.level).toBe("often");
    expect(blast.seasonsFavoured).toBe(10);
    expect(blast.seasonsChecked).toBe(10);
    expect(blast.peakMonths).toEqual(["Aug"]);
    expect(out.watch.some((w) => w.id.includes("rice-blast"))).toBe(true);
  });

  test("blast weather in 2 of 10 years is 'rarely' and not on the watch list", () => {
    const recs = records((d, y) => (y <= 2017 && d.slice(5, 7) === "08" ? { tminC: 23, rhPct: 93 } : {}));
    const blast = pestOutlook({ rotation: riceThenGram, records: recs, years: YEARS }).crops[0].weather.find((w) => w.ruleId === "rice-blast")!;
    expect(blast.level).toBe("rarely");
    expect(blast.seasonsFavoured).toBe(2);
  });

  test("a run shorter than the rule's minimum is not a spell", () => {
    // Humid every other day: never 3 in a row.
    const recs = records((d) => (Number(d.slice(8, 10)) % 2 ? { tminC: 23, rhPct: 93 } : {}));
    const blast = pestOutlook({ rotation: riceThenGram, records: recs, years: YEARS }).crops[0].weather.find((w) => w.ruleId === "rice-blast")!;
    expect(blast.seasonsFavoured).toBe(0);
  });

  test("seasons with missing humidity are skipped, and too few seasons is 'unknown'", () => {
    const recs = records((_, y) => (y >= 2019 ? { rhPct: null } : {}));
    const blast = pestOutlook({ rotation: riceThenGram, records: recs, years: YEARS }).crops[0].weather.find((w) => w.ruleId === "rice-blast")!;
    expect(blast.seasonsChecked).toBe(3);
    expect(blast.level).toBe("unknown");
  });

  test("a season that crosses the new year reads the next year's days", () => {
    // Powdery mildew weather only in January; the green gram season runs Nov–Jan.
    const recs = records((d) => (d.slice(5, 7) === "01" ? { tmeanC: 23, rhPct: 65, rainMm: 0 } : {}));
    const pm = pestOutlook({ rotation: riceThenGram, records: recs, years: YEARS }).crops[1].weather.find((w) => w.ruleId === "powdery-mildew")!;
    expect(pm.seasonsFavoured).toBe(10);
    expect(pm.peakMonths).toEqual(["Jan"]);
  });

  test("humidity rules say humidity is unchecked; rain rules add the Dry Zone caution in Magway", () => {
    const recs = records(() => ({}));
    const out = pestOutlook({ rotation: riceThenGram, records: recs, years: YEARS, region: "magway" });
    expect(out.crops[0].weather.find((w) => w.ruleId === "rice-blast")!.caveats[0]).toContain("humidity");
    expect(out.crops[1].weather.find((w) => w.ruleId === "powdery-mildew")!.caveats.some((c) => c.includes("Dry Zone"))).toBe(true);
    const delta = pestOutlook({ rotation: riceThenGram, records: recs, years: YEARS, region: "ayeyarwady" });
    expect(delta.crops[1].weather.find((w) => w.ruleId === "powdery-mildew")!.caveats.some((c) => c.includes("Dry Zone"))).toBe(false);
  });

  test("without weather the crop-order checks still work", () => {
    const out = pestOutlook({ rotation: riceThenGram, records: [], years: YEARS });
    expect(out.weatherYears).toBeNull();
    expect(out.crops[0].weather).toEqual([]);
    expect(out.crops[1].carriedIn?.shared.map((s) => s.organismId)).toContain("rhizoctonia");
  });
});

describe("carry-over and return intervals", () => {
  test("sesame then green gram carries charcoal rot into the green gram", () => {
    const r = rotation("f", [slot("s", "sesame", "2026-05-15", "2026-08-23"), slot("g", "green-gram", "2026-08-30", "2026-11-13")]);
    const out = pestOutlook({ rotation: r, records: [], years: YEARS });
    const gram = out.crops.find((c) => c.cropId === "green-gram")!;
    expect(gram.carriedIn?.fromName).toBe("Sesame");
    expect(gram.carriedIn?.shared.find((s) => s.organismId === "macrophomina")?.severity).toBe("caution");
    expect(out.watch.some((w) => w.kind === "carryover" && w.title.startsWith("Charcoal rot"))).toBe(true);
  });

  test("chickpea every year leads the watch list", () => {
    const r = rotation("f", [slot("a", "rice", "2026-06-01", "2026-10-13"), slot("b", "chickpea", "2026-11-01", "2027-02-20")]);
    const out = pestOutlook({ rotation: r, records: [], years: YEARS });
    expect(out.returnIntervals).toHaveLength(1);
    expect(out.watch[0].kind).toBe("return");
  });

  test("every crop lists the organisms it hosts", () => {
    const out = pestOutlook({ rotation: riceThenGram, records: [], years: YEARS });
    expect(out.crops[1].hosts.map((h) => h.id)).toEqual(expect.arrayContaining(["macrophomina", "yellow-mosaic", "maruca"]));
  });
});
