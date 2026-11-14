import { IMERG } from "../nasa/imerg";
import { HLS_QA_POLICY } from "../nasa/qa/hls-fmask";
import { MODIS_QA_POLICY } from "../nasa/qa/modis-vi";
import { PRODUCT_DOI } from "../nasa/appeears/products";
import { makeIndicator, type DerivedIndicator, type EvidenceKind, type MissingReason } from "../evidence/indicator";
import type { EngineData, SourceStatus } from "./data";
import type { RainSeries } from "./data";

/**
 * Builders that turn engine numbers into `DerivedIndicator`s with the right product, scale and
 * QA text for each source. A source that is not connected produces an indicator with a null value
 * and a reason, never a made-up number.
 */

const missingFor = (status: SourceStatus): MissingReason =>
  status === "unconfigured" ? "source-unconfigured" : status === "pending" ? "source-pending" : status === "ok" ? "no-valid-observations" : "source-unavailable";

interface Common {
  data: EngineData;
  name: string;
  value: number | string | null;
  units: string;
  statistic: string;
  start: string | null;
  end: string | null;
  valid?: number | null;
  expected?: number | null;
  assumptions?: string[];
  ruleSources?: string[];
  kind?: EvidenceKind;
}

const base = (c: Common) => ({
  fieldId: c.data.field.id,
  indicatorName: c.name,
  region: c.data.region,
  geometryOrPoint: (c.data.field.geometry.type === "Polygon" ? "polygon" : "point") as "polygon" | "point",
  farmLocationConfirmed: Boolean(c.data.field.locationConfirmed),
  value: c.value,
  units: c.units,
  statistic: c.statistic,
  periodStart: c.start,
  periodEnd: c.end,
  validCount: c.valid ?? null,
  expectedCount: c.expected ?? null,
  assumptions: c.assumptions ?? [],
  ruleSources: c.ruleSources ?? [],
});

/** NASA POWER daily indicator (T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, ETo inputs). */
export function powerIndicator(c: Common & { variable: string }): DerivedIndicator {
  const p = c.data.power;
  const unavailable = p.status !== "ok" || c.value === null;
  return makeIndicator({
    ...base(c),
    sourceId: "P",
    kind: c.kind ?? "model-estimate",
    product: "NASA POWER daily point API (community AG)",
    productVersion: p.version,
    variableOrLayer: c.variable,
    sourceUrl: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
    retrievedAt: p.retrievedAt,
    sourceResolution: "MERRA-2 / CERES gridded, about 0.5° x 0.625°",
    nativeFootprint: "One model grid cell; many farms share it",
    aggregationMethod: c.statistic,
    timeStandard: p.timeStandard ?? "UTC",
    qaPolicy: `Fill value ${p.fillValue} becomes missing, never zero. Seasons need at least 90% valid days.`,
    sourceCrs: "WGS84",
    spatialCoverage: null,
    missingReason: unavailable ? (p.status === "ok" ? "not-evaluable" : missingFor(p.status)) : null,
    value: unavailable && p.status !== "ok" ? null : c.value,
  });
}

/** Rainfall indicator: IMERG when it was primary, POWER otherwise, with the fallback recorded. */
export function rainIndicator(c: Common & { rain: RainSeries }): DerivedIndicator {
  const useR = c.rain.primary === "R";
  const info = c.data.imergInfo;
  const fallbackNote =
    c.rain.fromP > 0 && c.rain.primary === "R"
      ? [`${c.rain.fromP} days used NASA POWER PRECTOTCORR as a recorded fallback because IMERG was missing or partly sampled.`]
      : [];
  const notR = !useR
    ? [
        info.status === "unconfigured"
          ? "IMERG is not connected (no Earthdata token on the server), so rainfall is NASA POWER PRECTOTCORR."
          : info.status === "ok"
            ? "IMERG did not cover this period, so rainfall is NASA POWER PRECTOTCORR."
            : "IMERG is unavailable, so rainfall is NASA POWER PRECTOTCORR.",
      ]
    : [];
  if (useR) {
    return makeIndicator({
      ...base(c),
      assumptions: [...(c.assumptions ?? []), ...fallbackNote],
      sourceId: "R",
      kind: "model-estimate",
      product: "GPM IMERG Final Daily (GPM_3IMERGDF)",
      productVersion: IMERG.version,
      variableOrLayer: "precipitation",
      sourceUrl: `https://doi.org/${IMERG.doi}`,
      doi: IMERG.doi,
      retrievedAt: info.retrievedAt,
      sourceResolution: "0.1° grid",
      nativeFootprint: "About 11 km x 11 km cell",
      aggregationMethod: c.statistic,
      timeStandard: "UTC",
      qaPolicy: "Days with fewer than 48 valid half-hour inputs are flagged partial and not used as a full day. Fill removed.",
      sourceCrs: "WGS84",
    });
  }
  return powerIndicator({ ...c, variable: "PRECTOTCORR", assumptions: [...(c.assumptions ?? []), ...notR], kind: "model-estimate" });
}

export function smapIndicator(c: Common): DerivedIndicator {
  const i = c.data.smapInfo;
  return makeIndicator({
    ...base(c),
    sourceId: "M",
    kind: "model-estimate",
    product: "SMAP L4 Global 3-hourly 9 km Surface and Root Zone Soil Moisture",
    productVersion: "008",
    variableOrLayer: "Geophysical_Data_sm_rootzone",
    sourceUrl: "https://nsidc.org/data/spl4smgp/versions/8",
    doi: PRODUCT_DOI["SPL4SMGP.008"],
    retrievedAt: i.retrievedAt,
    sourceResolution: "9 km, three-hourly, model with SMAP assimilation",
    nativeFootprint: "About 9 km x 9 km cell: regional context, not field water",
    aggregationMethod: c.statistic,
    timeStandard: "UTC",
    qaPolicy: "Fill -9999 removed. The L4 product has no L2/L3 retrieval flag. Data through 2025 only; NSIDC flags May to July 2026.",
    sourceCrs: "EASE-Grid 2.0 (9 km)",
    missingReason: c.value === null ? missingFor(i.status) : null,
  });
}

export function hlsIndicator(c: Common): DerivedIndicator {
  const i = c.data.hlsInfo;
  return makeIndicator({
    ...base(c),
    sourceId: "V",
    kind: "observation",
    product: "HLSL30 (Harmonized Landsat Sentinel-2, Landsat 30 m)",
    productVersion: "2.0 (AppEEARS HLSL30.020; product DOI version 002)",
    variableOrLayer: "B04, B05, B06, Fmask",
    sourceUrl: "https://appeears.earthdatacloud.nasa.gov/api/product/HLSL30.020",
    doi: PRODUCT_DOI["HLSL30.020"],
    retrievedAt: i.retrievedAt,
    sourceResolution: "30 m, available acquisitions only",
    nativeFootprint: "30 m pixels; polygons use valid-pixel statistics",
    aggregationMethod: c.statistic,
    qaPolicy: HLS_QA_POLICY,
    sourceCrs: "UTM tile",
    missingReason: c.value === null ? missingFor(i.status) : null,
  });
}

export function srtmIndicator(c: Common): DerivedIndicator {
  const i = c.data.srtmInfo;
  return makeIndicator({
    ...base(c),
    sourceId: "T",
    kind: "observation",
    product: "SRTMGL1 elevation (AppEEARS SRTMGL1_NC)",
    productVersion: "003",
    variableOrLayer: "SRTMGL1_DEM",
    sourceUrl: "https://appeears.earthdatacloud.nasa.gov/api/product/SRTMGL1_NC.003",
    doi: PRODUCT_DOI["SRTMGL1_NC.003"],
    retrievedAt: i.retrievedAt,
    sourceResolution: "About 30 m, acquired February 2000",
    nativeFootprint: "30 m cells; slope needs a 3 x 3 neighbourhood",
    aggregationMethod: c.statistic,
    timeStandard: "n/a",
    qaPolicy: "Fill -32768 removed; slope from neighbouring valid cells with spacing converted to metres.",
    sourceCrs: "WGS84",
    missingReason: c.value === null ? missingFor(i.status) : null,
  });
}

export function modisIndicator(c: Common): DerivedIndicator {
  return makeIndicator({
    ...base(c),
    sourceId: "G",
    kind: "observation",
    product: "MOD13Q1 vegetation indices",
    productVersion: "061",
    variableOrLayer: "_250m_16_days_NDVI",
    sourceUrl: "https://appeears.earthdatacloud.nasa.gov/api/product/MOD13Q1.061",
    doi: PRODUCT_DOI["MOD13Q1.061"],
    sourceResolution: "250 m, 16-day composites",
    nativeFootprint: "250 m cell: mixed land cover, regional vegetation context",
    aggregationMethod: c.statistic,
    qaPolicy: MODIS_QA_POLICY,
    missingReason: c.value === null ? "source-unconfigured" : null,
  });
}

/** Things the farmer entered, shown as theirs. */
export function farmerIndicator(c: Common & { variable: string }): DerivedIndicator {
  return makeIndicator({
    ...base(c),
    sourceId: "farmer",
    kind: c.kind ?? "farmer-report",
    product: "Farmer-entered record",
    variableOrLayer: c.variable,
    sourceResolution: "This field",
    nativeFootprint: "As recorded by the farmer",
    aggregationMethod: c.statistic,
    qaPolicy: "Not checked by the app.",
    missingReason: c.value === null ? "missing-input" : null,
  });
}

/** Values the app computes from the crop library and the plan itself. */
export function appIndicator(c: Common & { variable: string }): DerivedIndicator {
  return makeIndicator({
    ...base(c),
    sourceId: "app",
    kind: c.kind ?? "scenario",
    product: "NASA Farming App calculation",
    variableOrLayer: c.variable,
    sourceResolution: "Rotation plan",
    nativeFootprint: "The planned rotation",
    aggregationMethod: c.statistic,
    qaPolicy: "Computed from the plan and the crop library; each rule carries its own scope.",
    missingReason: c.value === null ? "not-evaluable" : null,
  });
}

export function libraryIndicator(c: Common & { variable: string }): DerivedIndicator {
  return makeIndicator({
    ...base(c),
    sourceId: "crop-library",
    kind: "scenario",
    product: "Crop library (Myanmar)",
    variableOrLayer: c.variable,
    sourceResolution: "Species level",
    nativeFootprint: "Not variety-validated",
    aggregationMethod: c.statistic,
    qaPolicy: "Every rule shows its source and scope.",
    missingReason: c.value === null ? "not-evaluable" : null,
  });
}
