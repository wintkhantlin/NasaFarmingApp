import { IMERG } from "../nasa/imerg";
import { HLS_QA_POLICY } from "../nasa/qa/hls-fmask";
import { MODIS_QA_POLICY } from "../nasa/qa/modis-vi";
import { ECOSTRESS_QA_POLICY } from "../nasa/qa/ecostress";
import { LANDSAT_QA_POLICY, MPC_CONFIG } from "../nasa/planetary-computer";
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
  if (i.provider === "planetary-computer") return landsatIndicator(c);
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

/**
 * Field vegetation that came from Microsoft Planetary Computer. That route serves USGS Landsat
 * Collection 2 Level-2 surface reflectance, not HLS: no Sentinel-2 harmonisation, QA_PIXEL instead of
 * Fmask. The search spans Landsat missions, so no single mission DOI is claimed.
 */
export function landsatIndicator(c: Common): DerivedIndicator {
  const i = c.data.hlsInfo;
  return makeIndicator({
    ...base(c),
    sourceId: "V",
    kind: "observation",
    product: "USGS Landsat Collection 2 Level-2 Surface Reflectance (via Microsoft Planetary Computer)",
    productVersion: "Collection 2, Level-2",
    variableOrLayer: "red, nir08, swir16, qa_pixel",
    sourceUrl: `https://planetarycomputer.microsoft.com/dataset/${MPC_CONFIG.landsatCollection}`,
    doi: null,
    retrievedAt: i.retrievedAt,
    sourceResolution: "30 m, available acquisitions only",
    nativeFootprint: "30 m pixels; polygons use pixels whose centre lies inside the outline",
    aggregationMethod: c.statistic,
    qaPolicy: LANDSAT_QA_POLICY,
    sourceCrs: "WGS84 / UTM (per scene)",
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
  const i = c.data.modisInfo;
  const viaMpc = i.provider === "planetary-computer";
  return makeIndicator({
    ...base(c),
    sourceId: "G",
    kind: "observation",
    product: `MOD13Q1 vegetation indices${viaMpc ? " (via Microsoft Planetary Computer)" : ""}`,
    productVersion: "061",
    variableOrLayer: "_250m_16_days_NDVI",
    sourceUrl: viaMpc ? `https://planetarycomputer.microsoft.com/dataset/${MPC_CONFIG.modisViCollection}` : "https://appeears.earthdatacloud.nasa.gov/api/product/MOD13Q1.061",
    doi: PRODUCT_DOI["MOD13Q1.061"],
    sourceResolution: "250 m, 16-day composites",
    nativeFootprint: "250 m cell: mixed land cover, regional vegetation context",
    aggregationMethod: c.statistic,
    qaPolicy: MODIS_QA_POLICY,
    retrievedAt: i.retrievedAt,
    timeStandard: "UTC acquisition/composite date",
    sourceCrs: viaMpc ? "Sinusoidal source grid, windowed at the field" : "Native MODIS sinusoidal grid",
    missingReason: c.value === null ? missingFor(i.status) : null,
  });
}

export function ecostressIndicator(c: Common & { variable: "LST" | "ETdaily" }): DerivedIndicator {
  const isLst = c.variable === "LST";
  const i = isLst ? c.data.ecostressLstInfo : c.data.ecostressEtInfo;
  const product = isLst ? "ECO_L2T_LSTE.002" : "ECO_L3T_JET.002";
  return makeIndicator({
    ...base(c),
    sourceId: "E",
    kind: "model-estimate",
    product: isLst ? "ECOSTRESS tiled land-surface temperature" : "ECOSTRESS tiled modeled evapotranspiration",
    productVersion: "002",
    variableOrLayer: c.variable,
    sourceUrl: `https://appeears.earthdatacloud.nasa.gov/api/product/${product}`,
    doi: PRODUCT_DOI[product],
    retrievedAt: i.retrievedAt,
    sourceResolution: "About 70 m, irregular ISS overpasses",
    nativeFootprint: "About 70 m pixels; clear land pixels within the field outline",
    aggregationMethod: c.statistic,
    timeStandard: "UTC acquisition date",
    qaPolicy: ECOSTRESS_QA_POLICY,
    sourceCrs: "UTM tile",
    missingReason: c.value === null ? missingFor(i.status) : null,
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

/**
 * Strict data provenance contract for every crop rotation engine input.
 * Adheres to NASA Space Act Agreement & open-science attribution guidelines.
 * Reuses existing evidence classifications and prevents false attribution.
 */
export interface EngineInputProvenance {
  provider: "NASA" | "USGS" | "ISRIC" | "FAO" | "Farmer" | "Department_of_Agriculture" | "Calculated";
  product: string;
  variable: string;
  observationDateOrRange: string | null;
  temporalResolution: string;
  spatialResolution: string;
  footprintDescription: string;
  unit: string;
  isObserved: boolean;
  isModeled: boolean;
  isFarmerEntered: boolean;
  quality: "verified" | "coarse_regional" | "uncalibrated" | "missing" | "unconfirmed" | "calculated";
  fetchedAt: string | null;
  assumption?: string;
}

const ENGINE_PROVENANCE_REGISTRY: Record<string, Omit<EngineInputProvenance, "observationDateOrRange" | "fetchedAt">> = {
  temperature_t2m: {
    provider: "NASA",
    product: "NASA POWER Daily Point API (MERRA-2 assimilation)",
    variable: "T2M",
    temporalResolution: "daily",
    spatialResolution: "0.5° × 0.625° (~50 km × ~60 km)",
    footprintDescription: "Coarse regional atmospheric reanalysis grid; shared by thousands of parcels across the township.",
    unit: "°C",
    isObserved: false,
    isModeled: true,
    isFarmerEntered: false,
    quality: "coarse_regional",
    assumption: "Uniform air temperature across regional grid cell.",
  },
  temperature_t2m_max: {
    provider: "NASA",
    product: "NASA POWER Daily Point API (MERRA-2 assimilation)",
    variable: "T2M_MAX",
    temporalResolution: "daily",
    spatialResolution: "0.5° × 0.625° (~50 km × ~60 km)",
    footprintDescription: "Coarse regional atmospheric reanalysis grid; screening tool for reproductive heat stress.",
    unit: "°C",
    isObserved: false,
    isModeled: true,
    isFarmerEntered: false,
    quality: "coarse_regional",
    assumption: "Regional daytime maximum temperature.",
  },
  solar_radiation_allsky: {
    provider: "NASA",
    product: "NASA POWER Daily Point API (CERES SYN1deg assimilation)",
    variable: "ALLSKY_SFC_SW_DWN",
    temporalResolution: "daily",
    spatialResolution: "1.0° × 1.0° (~110 km)",
    footprintDescription: "Satellite-derived surface solar irradiance grid cell.",
    unit: "MJ/m²/day",
    isObserved: false,
    isModeled: true,
    isFarmerEntered: false,
    quality: "coarse_regional",
  },
  precipitation: {
    provider: "NASA",
    product: "GPM IMERG Final Daily (GPM_3IMERGDF) / NASA POWER MERRA-2",
    variable: "precipitation",
    temporalResolution: "daily (UTC)",
    spatialResolution: "0.1° × 0.1° (~10 km) or 0.5° × 0.625°",
    footprintDescription: "Satellite microwave/radar combined estimate with gauge calibration, or reanalysis backup.",
    unit: "mm/day",
    isObserved: false,
    isModeled: true,
    isFarmerEntered: false,
    quality: "coarse_regional",
    assumption: "Regional precipitation total without micro-topographic cloudburst captures.",
  },
  reference_et0: {
    provider: "FAO",
    product: "FAO-56 Penman-Monteith equation (or Hargreaves fallback when solar/humidity missing)",
    variable: "ET0",
    temporalResolution: "daily",
    spatialResolution: "derived per grid/location",
    footprintDescription: "Standard hypothetical well-watered grass reference evapotranspiration.",
    unit: "mm/day",
    isObserved: false,
    isModeled: true,
    isFarmerEntered: false,
    quality: "calculated",
    assumption: "Aerodynamic resistance 208 s/m, surface resistance 70 s/m, grass height 0.12 m.",
  },
  regional_soil_moisture: {
    provider: "NASA",
    product: "SMAP L4 Global 3-hourly 9 km Surface and Root Zone Soil Moisture (SPL4SMGP)",
    variable: "Geophysical_Data_sm_rootzone",
    temporalResolution: "3-hourly / daily",
    spatialResolution: "9 km grid posting",
    footprintDescription: "REGIONAL CONTEXT ONLY. 9 km model assimilation; NOT a direct field-level measurement of soil water on the farmer's parcel.",
    unit: "m³/m³",
    isObserved: false,
    isModeled: true,
    isFarmerEntered: false,
    quality: "coarse_regional",
    assumption: "Catchment-scale hydrological state informing regional drought or flooding trends.",
  },
  soil_texture_soilgrids: {
    provider: "ISRIC",
    product: "SoilGrids 2.0 (ISRIC - World Soil Information)",
    variable: "sand, clay, soc",
    temporalResolution: "static (2020 map)",
    spatialResolution: "250 m",
    footprintDescription: "Machine-learning spatial interpolation from legacy soil profiles; NOT a field soil test. Uncalibrated against local delta alluvium.",
    unit: "g/kg or %",
    isObserved: false,
    isModeled: true,
    isFarmerEntered: false,
    quality: "uncalibrated",
    assumption: "Interpolated regional soil characteristics; farmer manual override takes precedence.",
  },
  farmer_soil_observation: {
    provider: "Farmer",
    product: "Farmer on-site field observation",
    variable: "farmer_soil_override",
    temporalResolution: "current season",
    spatialResolution: "parcel-level",
    footprintDescription: "Direct physical observation by farmer on this specific parcel; overrides coarse global satellite models.",
    unit: "categorical (sand/silt/clay)",
    isObserved: true,
    isModeled: false,
    isFarmerEntered: true,
    quality: "verified",
  },
  farmer_drainage_observation: {
    provider: "Farmer",
    product: "Farmer post-harvest drainage record",
    variable: "farmer_observed_drainage",
    temporalResolution: "event-based",
    spatialResolution: "parcel-level",
    footprintDescription: "Recorded date of surface water release and pond evacuation; critical for seedbed workable window.",
    unit: "date / categorical (poor/moderate/good)",
    isObserved: true,
    isModeled: false,
    isFarmerEntered: true,
    quality: "verified",
  },
  crop_market_economics: {
    provider: "Department_of_Agriculture",
    product: "Myanmar Department of Agriculture / Central Statistical Organization & Township Wholesale Markets",
    variable: "crop_price, crop_enterprise_costs",
    temporalResolution: "seasonal / annual (2025-2026)",
    spatialResolution: "township wholesale market",
    footprintDescription: "Township trading center prices and input budget benchmarks; subject to transportation cost and market volatility.",
    unit: "MMK/kg, MMK/acre, MMK/ha",
    isObserved: true,
    isModeled: false,
    isFarmerEntered: false,
    quality: "verified",
    assumption: "Wholesale baseline price without individual forward contract or quality premium.",
  },
};

/**
 * Returns complete provenance metadata for an engine input variable.
 */
export function getEngineInputProvenance(
  variable: string,
  options?: {
    observationDateOrRange?: string | null;
    fetchedAt?: string | null;
    isOverride?: boolean;
  }
): EngineInputProvenance {
  const reg = ENGINE_PROVENANCE_REGISTRY[variable] ?? {
    provider: "Calculated",
    product: "NASA Farming App internal calculation",
    variable,
    temporalResolution: "step-based",
    spatialResolution: "parcel-level",
    footprintDescription: "Computed rotation parameter.",
    unit: "dimensionless",
    isObserved: false,
    isModeled: true,
    isFarmerEntered: false,
    quality: "calculated",
  };

  return {
    ...reg,
    observationDateOrRange: options?.observationDateOrRange ?? null,
    fetchedAt: options?.fetchedAt ?? null,
  };
}

/**
 * Validates that coarse SMAP or regional soil moisture is NEVER falsely labeled as
 * measured in the farmer's field.
 */
export function assertTruthfulSoilMoistureLabel(label: string): void {
  const forbiddenPatterns = [
    /measured in (your|this)?\s*field/i,
    /field soil moisture measurement/i,
    /ground truth on your parcel/i,
    /in-situ sensor on your field/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(label)) {
      throw new Error(
        `Data truthfulness violation: Coarse satellite/model soil moisture (SMAP 9km) must NEVER be labeled as '${label}'. It provides regional context only.`
      );
    }
  }
}

