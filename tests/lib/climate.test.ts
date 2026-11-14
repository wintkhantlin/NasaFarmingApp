import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  annualRainfall,
  doyToLabel,
  dryspells,
  frostStats,
  hotDaysPerYear,
  monthlyNormals,
  toDailyRecords,
  unshiftDoy,
  wetSeasons,
  type DailyRecord,
} from "../../lib/engine/climate";
import { dayOfYear, extraterrestrialRadiation, hargreavesEt0 } from "../../lib/engine/et0";
import { parsePowerDaily } from "../../lib/nasa/power";

describe("ET0", () => {
  test("day of year", () => {
    expect(dayOfYear("2023-01-01")).toBe(1);
    expect(dayOfYear("2023-09-03")).toBe(246);
    expect(dayOfYear("2024-12-31")).toBe(366);
  });

  test("extraterrestrial radiation matches FAO-56 example 8 (20 S, 3 September: 32.2)", () => {
    expect(extraterrestrialRadiation(-20, 246)).toBeCloseTo(32.2, 0);
  });

  test("Hargreaves ET0 for Tmax 30, Tmin 16 at Ra 32.2 is about 4.6 mm per day", () => {
    const et0 = hargreavesEt0(-20, 246, 30, 16);
    expect(et0).toBeGreaterThan(4.4);
    expect(et0).toBeLessThan(4.8);
  });

  test("polar night does not produce NaN", () => {
    const v = extraterrestrialRadiation(80, 355);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
  });

  test("ET0 is never negative", () => {
    expect(hargreavesEt0(42, 15, -20, -25)).toBeGreaterThanOrEqual(0);
  });
});

describe("Ames, Iowa 1981 to 2024 (NASA POWER)", () => {
  const raw = JSON.parse(
    readFileSync(join(import.meta.dirname, "../fixtures/ames/power-daily-1981-2024.json"), "utf8"),
  );
  const weather = parsePowerDaily(raw);
  const records = toDailyRecords(weather);

  test("record covers 44 years of daily data", () => {
    expect(weather.dates[0]).toBe("1981-01-01");
    expect(weather.dates.at(-1)).toBe("2024-12-31");
    expect(records).toHaveLength(weather.dates.length);
  });

  test("annual rainfall is plausible for central Iowa", () => {
    const years = annualRainfall(records);
    expect(years.length).toBeGreaterThanOrEqual(43);
    const avg = years.reduce((s, y) => s + y.mm, 0) / years.length;
    expect(avg).toBeGreaterThan(750);
    expect(avg).toBeLessThan(1100);
  });

  test("monthly normals: cold January, warm July, wet summer", () => {
    const n = monthlyNormals(records);
    expect(n).toHaveLength(12);
    expect(n[0].tmeanC).toBeLessThan(-2);
    expect(n[6].tmeanC).toBeGreaterThan(20);
    expect(n[5].rainMm).toBeGreaterThan(n[0].rainMm * 2);
    expect(n[6].et0Mm).toBeGreaterThan(120);
    expect(n[6].et0Mm).toBeLessThan(220);
  });

  test("one wet growing season, spring to autumn", () => {
    const seasons = wetSeasons(monthlyNormals(records));
    expect(seasons).toHaveLength(1);
    expect(seasons[0].months).toContain(6);
    expect(seasons[0].months).not.toContain(1);
  });

  test("last spring frost in April or early May, first autumn frost in October", () => {
    const f = frostStats(records, weather.latitude);
    expect(f.years).toBeGreaterThanOrEqual(43);
    expect(f.frostYears).toBe(f.years);
    expect(f.lastSpringFrost!.median).toBeGreaterThan(95); // after 5 April
    expect(f.lastSpringFrost!.median).toBeLessThan(135); // before 15 May
    expect(f.lastSpringFrost!.p90).toBeGreaterThanOrEqual(f.lastSpringFrost!.median);
    expect(f.firstAutumnFrost!.median).toBeGreaterThan(265);
    expect(f.firstAutumnFrost!.median).toBeLessThan(310);
    expect(f.firstAutumnFrost!.p10).toBeLessThanOrEqual(f.firstAutumnFrost!.median);
    expect(f.frostFreeDays!).toBeGreaterThan(140);
    expect(f.frostFreeDays!).toBeLessThan(215);
  });

  test("dry spells and hot days are in a sane range", () => {
    const d = dryspells(records);
    expect(d.longestDays.median).toBeGreaterThan(5);
    expect(d.longestDays.median).toBeLessThan(25);
    expect(d.longestDays.p90).toBeGreaterThanOrEqual(d.longestDays.median);
    const hot = hotDaysPerYear(records, 35);
    expect(hot).toBeGreaterThanOrEqual(0);
    expect(hot).toBeLessThan(30);
  });
});

describe("calendar helpers", () => {
  test("day number to label", () => {
    expect(doyToLabel(1)).toBe("1 Jan");
    expect(doyToLabel(32)).toBe("1 Feb");
    expect(doyToLabel(120)).toBe("30 Apr");
    expect(doyToLabel(365)).toBe("31 Dec");
  });

  test("shifted southern day numbers map back", () => {
    // Shifted day 1 is 2 July (day 183), and shifted day 365 is 1 July (day 182).
    expect(unshiftDoy(1)).toBe(183);
    expect(unshiftDoy(365)).toBe(182);
    expect(unshiftDoy(323)).toBe(140);
  });
});

describe("southern hemisphere frost", () => {
  // Two seasons of synthetic daily data at 35 S: warm everywhere except frosts
  // on 1 June and 20 September (spring) and 20 May (autumn start) each year.
  const make = (): DailyRecord[] => {
    const out: DailyRecord[] = [];
    for (const year of [2020, 2021, 2022]) {
      for (let doy = 1; doy <= 365; doy++) {
        const date = new Date(Date.UTC(year, 0, doy)).toISOString().slice(0, 10);
        const frost = [140, 244, 263].includes(doy); // 20 May, 1 Sep, 20 Sep
        out.push({
          date,
          year,
          month: Number(date.slice(5, 7)),
          doy,
          tmaxC: 20,
          tminC: frost ? -1 : 8,
          tmeanC: 12,
          rainMm: 1,
          et0Mm: 2,
          rootWetness: 0.5,
        });
      }
    }
    return out;
  };

  test("last spring frost is the late-September one, first autumn frost is May", () => {
    const f = frostStats(make(), -35);
    expect(f.years).toBeGreaterThanOrEqual(2);
    // Convert shifted day numbers back to calendar days.
    expect(unshiftDoy(f.lastSpringFrost!.median)).toBe(263); // 20 September
    expect(unshiftDoy(f.firstAutumnFrost!.median)).toBe(140); // 20 May
  });
});
