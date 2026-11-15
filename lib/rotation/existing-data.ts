import type { DailyWeather } from "@/lib/nasa/power";
import type { ConditionsData, RemoteData } from "@/lib/store/data-cache";
import type { EnvironmentSnapshot, FarmerRequest } from "./farmer-request";
import { powerEnvironment } from "./power-environment";

const dateOK = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Adapt the team's cached products; no extra source or invented observation is introduced. */
export function existingDataEnvironment(
  conditions: ConditionsData | null,
  remote: RemoteData | null,
  planning: FarmerRequest["planning"],
): EnvironmentSnapshot {
  const weather = conditions?.weather;
  const base = weather ? powerEnvironment(weather, planning.startDate, planning.endDate, conditions?.fetchedAt ?? null)
    : { source: "NASA POWER unavailable for this field", monthly: [] } as EnvironmentSnapshot;
  const missing: string[] = [...(conditions?.sourceWarnings ?? [])];
  const variableSources = {
    temperature: weather ? `${weather.source.dataset} · ${weather.source.resolution}` : "unavailable",
    rainfall: weather ? `${weather.source.dataset} · ${weather.source.resolution}` : "unavailable",
    missing,
  };
  base.variable_sources = variableSources;

  const soil = conditions?.soil;
  if (soil?.ph != null && Number.isFinite(soil.ph) && soil.ph >= 0 && soil.ph <= 14 && /SoilGrids/i.test(soil.source.dataset)) {
    base.context = { ...base.context, soil_ph_estimate: {
      value: soil.ph, source: soil.source.dataset, resolution: soil.source.resolution,
      depth: soil.source.depth, retrieved_at: null,
    } };
  } else if (soil) missing.push("SoilGrids pH is missing or has unverified provenance.");
  else if (conditions && !missing.some((warning) => /SoilGrids/.test(warning))) missing.push("SoilGrids estimated pH is unavailable; field soil acidity is unknown.");

  const smap = remote?.smap;
  if (smap?.status === "unconfigured") missing.push("SMAP regional moisture context needs AppEEARS credentials; field water availability remains unknown.");
  else if (smap?.status === "unavailable") missing.push("SMAP regional moisture context could not be retrieved; field water availability remains unknown.");
  else if (smap?.status === "pending") missing.push("SMAP regional moisture observations are still being retrieved; field water availability remains unknown.");
  if (smap?.status === "ok" && smap.provider === "appeears" && dateOK(smap.start) && dateOK(smap.end) && smap.start <= smap.end) {
    const valid = (smap.data?.days ?? []).filter((day) => dateOK(day.date) && day.date >= smap.start && day.date <= smap.end &&
      day.rootzone !== null && Number.isFinite(day.rootzone) && day.rootzone >= 0 && day.rootzone <= 1 &&
      Number.isInteger(day.validRootzone) && day.validRootzone > 0 && day.validRootzone <= 8)
      .sort((a, b) => a.date.localeCompare(b.date));
    const uniqueValid = valid.filter((day, index) => index === 0 || day.date !== valid[index - 1].date);
    const expectedDays = 1 + (Date.parse(smap.end) - Date.parse(smap.start)) / 86_400_000;
    base.context = { ...base.context, smap: {
      source: "NASA SMAP SPL4SMGP.008 via AppEEARS", resolution: "not recorded in cached payload; regional model grid", units: "m^3/m^3",
      period: { start_date: smap.start, end_date: smap.end }, retrieved_at: smap.retrievedAt ?? null,
      observations: uniqueValid.map((day) => ({ date: day.date, rootzone: day.rootzone, valid_samples: day.validRootzone })),
      missing_count: expectedDays - uniqueValid.length,
    } };
  }

  const imerg = conditions?.imerg;
  if (!weather || base.basis === "synthetic" || !imerg || imerg.status !== "ok") {
    if (imerg && !missing.some((warning) => /IMERG/.test(warning))) missing.push("IMERG rainfall was not used: source is incomplete or POWER temperature is unavailable.");
    return base;
  }
  const source = conditions.sources.find((entry) => /GPM IMERG Final daily V07/i.test(entry.dataset) && entry.resolution === "0.1°");
  if (!source || weather.meta.timeStandard !== "UTC" || !["C", "°C"].includes(weather.meta.units.T2M ?? "") || !/NASA POWER/i.test(weather.source.dataset)) {
    missing.push("IMERG rainfall was not used: source, temperature units, resolution, or UTC alignment could not be verified.");
    return base;
  }
  const imergByDate = new Map<string, number>();
  const invalidDates = new Set<string>();
  for (const day of imerg.days) {
    if (!dateOK(day.date) || imergByDate.has(day.date) || invalidDates.has(day.date) ||
      !day.granule || day.partialSampling || day.samples !== 48 || day.precipMm === null ||
      !Number.isFinite(day.precipMm) || day.precipMm < 0) {
      invalidDates.add(day.date);
      imergByDate.delete(day.date);
    } else imergByDate.set(day.date, day.precipMm);
  }
  const powerDates = new Map(weather.dates.map((date, index) => [date, index]));
  const years = [...new Set(imerg.days.map((day) => Number(day.date.slice(0, 4))))].filter(Number.isInteger).sort();
  const completeYears = years.filter((year) => {
    if (year < 2016 || year > 2025) return false;
    for (let month = 1; month <= 12; month++) for (let day = 1; day <= daysInMonth(year, month); day++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const index = powerDates.get(date);
      if (!imergByDate.has(date) || index === undefined || !Number.isFinite(weather.series.T2M?.[index])) return false;
    }
    return true;
  });
  if (!completeYears.length) {
    missing.push("IMERG rainfall was not used: no complete, fully sampled year aligns with complete POWER temperature days.");
    return base;
  }
  // A single full year also prevents a period label from spanning unobserved years.
  const selectedYears = completeYears.slice(-1);
  const aligned = new Set(selectedYears);
  const selectedIndices = weather.dates.map((date, index) => aligned.has(Number(date.slice(0, 4))) ? index : -1).filter((index) => index >= 0);
  const filtered: DailyWeather = {
    ...weather,
    dates: selectedIndices.map((index) => weather.dates[index]),
    series: {
      ...weather.series,
      T2M: selectedIndices.map((index) => weather.series.T2M?.[index] ?? null),
      PRECTOTCORR: selectedIndices.map((index) => imergByDate.get(weather.dates[index]) ?? null),
    },
  };
  // POWER temperature and IMERG rain now refer to exactly the same complete UTC days.
  const merged = powerEnvironment(filtered, planning.startDate, planning.endDate, conditions.fetchedAt);
  merged.basis = "historical_analogue";
  merged.source = `${weather.source.dataset} temperature + ${source.dataset} rainfall · aligned complete UTC year ${selectedYears[0]}`;
  merged.variable_sources = {
    temperature: `${weather.source.dataset} · ${weather.source.resolution}`,
    rainfall: `${source.dataset} · ${source.resolution} · 48 valid half-hours per day`,
    rainfall_period: { start_date: `${selectedYears[0]}-01-01`, end_date: `${selectedYears[0]}-12-31` },
    rainfall_resolution: source.resolution,
    missing,
  };
  merged.context = base.context;
  return merged;
}
