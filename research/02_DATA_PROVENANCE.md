# Scientific Data Provenance & Transformation Architecture
**Project:** Green Ally Project — Adapting Farms with NASA Data (NASA Space Apps Challenge 2026)  
**Agent:** AGENT 2 — NASA Data Research & Download Specialist  
**Verification Date:** 2026-11-15  
**Geographic Domain:** Myanmar Heartland (Ayeyarwady Delta, Central Dry Zone, Shan Highlands, Bago)

---

## 1. Executive Summary & Purpose

In agronomic decision support, data provenance is the foundation of scientific truthfulness. Farmers make capital-intensive decisions—investing in dry-season fuel for irrigation pumps, purchasing legume seed for residual moisture double-cropping, or timing fertilizer applications around monsoon breaks. Providing satellite data without clear lineage, scale boundaries, or quality flagging can lead to catastrophic crop failure.

This document traces the complete scientific data lineage, mathematical transformation pipelines, scale-reconciliation contracts, quality assurance gates, and calibration biases of the Green Ally Project platform.

---

## 2. End-to-End Provenance Pipeline Architecture

```
[1. Spaceborne Sensors & Reanalysis Models]
   ├── Landsat 8/9 OLI-TIRS (30 m multispectral reflectance & thermal)
   ├── GPM Core Observatory & Constellation (0.1° Ku/Ka radar & GMI radiometer)
   ├── SMAP Observatory (9 km L-band passive microwave radiometer)
   ├── ISS ECOSTRESS (70 m multispectral thermal infrared radiometer)
   ├── Space Shuttle Endeavour STS-99 SRTM (30 m C-band interferometric radar)
   ├── NASA GMAO MERRA-2 / GEOS-IT / CERES (0.5° × 0.625° assimilations)
   ├── ISRIC SoilGrids Machine Learning Ensembles (250 m global pedometrics)
   └── NOAA Global Historical Climatology Network (GHCN-Daily ground stations)
                          │
                          ▼
[2. Acquisition & Protocol Ingestion]
   ├── Planetary Computer STAC / Azure Blob Storage (HTTP Range GET on Cloud-Optimized GeoTIFFs)
   ├── GES DISC OPeNDAP DAP4 Constraint Engine (Single-cell slice extraction without global transfers)
   ├── NASA AppEEARS Point/Area Processing Engine (GeoTIFF, NetCDF, CSV extraction)
   ├── NASA POWER REST API (UTC agroclimatology JSON payloads)
   ├── ISRIC REST API (Multi-depth soil property point queries)
   └── NOAA NCEI Access API (Station ground-truth CSV downloads)
                          │
                          ▼
[3. Cryptographic Hashing & Local Tier Caching]
   ├── SHA-256 Digest Computation (Recorded in manifest.json & download_history.json)
   ├── Server-Side Tier-1 Cache: Upstash Redis (Keyed by processing version, coordinate hash, date range)
   └── Offline Tier-2 Pre-Download Fallback: Local JSON cold store (`data/predownload/`, `research/data/`)
                          │
                          ▼
[4. Quality Assurance, Screening & Fill Handling]
   ├── Landsat QA_PIXEL 16-bit Bitmask: Drop fill, cloud, dilated cloud, cirrus, shadow, snow, water
   ├── HLS Fmask V2 8-bit Bitmask: Drop cloud, shadow, adjacent, high aerosol
   ├── Minimum Valid Parcel Coverage Gate: Scene admitted iff f_valid >= 0.25 (MIN_VALID_COVERAGE)
   ├── ECOSTRESS QA: Require QC bits 0-1 == 00, cloud == 0, water == 0
   ├── GPM IMERG QA: Count valid half-hours; flag partial sampling if count < 48
   └── Strict Fill Policy: -999, -9999, -32768, 255, and null NEVER converted to 0.0
                          │
                          ▼
[5. Mathematical & Physical Transformations]
   ├── Landsat Reflectance Scaling: rho = DN * 0.0000275 - 0.2
   ├── Topographic Gradient: Horn's (1981) 3x3 finite-difference on metric-adjusted grid
   ├── SoilGrids Integration: 0-30 cm thickness-weighted pedotransfer integration
   ├── Soil Texture Classification: USDA 12-class textural triangle algorithm
   ├── Atmospheric Evapotranspiration: FAO-56 Penman-Monteith ET0 with Hargreaves-Samani fallback
   ├── Crop Evapotranspiration: ETc = Kc * ET0 (Single crop coefficient method)
   └── Climatological Trends: Non-parametric Mann-Kendall tau and Sen's slope estimator
                          │
                          ▼
[6. Scale Reconciliation & Spatial Footprint Stratification]
   ├── Field Footprint (~30 m): Landsat NDVI, SRTM Slope, Parcel Polygon
   ├── Village Footprint (~10 km): GPM IMERG Rain, SMAP Soil Moisture
   └── Wider Region Footprint (~50 km): NASA POWER Reanalysis Meteorology
                          │
                          ▼
[7. Farmer-Facing UI Delivery & Scientific Truthfulness Contract]
   ├── Decision -> Action -> Reason -> Evidence -> Method
   ├── Visual scale badges ("Field", "Village", "Wider Region")
   ├── Explicit Ground-Truth Caveats (e.g., Mandalay -50.9% Dry Zone rain bias)
   └── Complete Lineage Disclosure Drawer (Sensor, DAAC, resolution, citation, DOI)
```

---

## 3. Scale Differences & The Three Spatial Footprints

A foundational design rule in Green Ally Project is the **Spatial Footprint Contract**. Different Earth observation sensors capture physical phenomena at vastly different spatial scales:

```
Spatial Resolution Comparison Across Sensors

1. Field Scale (~30 m)
   ┌───┐ 30 m Landsat Pixel (Resolves individual paddy bunds, intra-field vigor, ponding water)
   └───┘

2. Village / Basin Scale (~10 km)
   ┌────────────────────────────────────────────────────────┐
   │                                                        │ 10 km GPM IMERG / SMAP Pixel
   │   (Averaged over 100,000+ smallholder farms)          │ (Captures meso-scale monsoon fronts,
   │                                                        │  regional groundwater storage)
   └────────────────────────────────────────────────────────┘

3. Regional Scale (~50 km)
   ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
   │                                                                                              │ 50 km NASA POWER Cell
   │   (Spans entire administrative districts from mountains to delta rivers)                     │ (Captures synoptic solar
   │                                                                                              │  radiation and atmospheric pressure)
   └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### The Simplicity & Truthfulness Contract
1. **Never Blur Scales:** The system **never** re-samples 50 km MERRA-2 weather to a 30 m raster and presents it as "field weather." Doing so would deceive the farmer into believing localized thunderstorms were detected on their individual parcel.
2. **Visual Badging:** Every indicator displayed to the farmer carries an explicit badge:
   - **`Field` (30 m):** Landsat surface reflectance, NDVI, NDMI, SRTM slope. Measured directly over the marked boundary.
   - **`Village` (10 km):** GPM IMERG daily precipitation, SMAP L4 root-zone wetness. Measured across the local farming commune.
   - **`Wider Region` (50 km):** NASA POWER temperature, solar irradiance, relative humidity, wind speed. Measured across the regional synoptic grid.

---

## 4. Quality Assurance, Screening & Masking Protocols

### 4.1 Landsat Collection 2 Level-2 Quality Masking
USGS Landsat Collection 2 provides a 16-bit bitpacked `QA_PIXEL` band. Green Ally Project decodes this band according to the following bitfield logic:

```typescript
function decodeQaPixel(dn: number) {
  return {
    fill: (dn & (1 << 0)) !== 0,
    dilatedCloud: (dn & (1 << 1)) !== 0,
    cirrus: (dn & (1 << 2)) !== 0,
    cloud: (dn & (1 << 3)) !== 0,
    shadow: (dn & (1 << 4)) !== 0,
    snow: (dn & (1 << 5)) !== 0,
    clear: (dn & (1 << 6)) !== 0,
    water: (dn & (1 << 7)) !== 0,
    cloudConfidence: (dn >> 8) & 3,      // 00=None, 01=Low, 10=Medium, 11=High
    shadowConfidence: (dn >> 10) & 3,
    snowConfidence: (dn >> 12) & 3,
    cirrusConfidence: (dn >> 14) & 3,
  };
}
```

**Parcel Admission Threshold ($f_{\text{valid}} \ge 0.25$):**
In tropical monsoon regions such as the Ayeyarwady Delta, cloud cover is pervasive. If a satellite scene contains only a tiny sliver of unmasked area over a farm (e.g. 5%), that sliver is frequently an unflagged cloud edge or diffuse shadow, which severely skews the NDVI. Green Ally Project enforces:
$$f_{\text{valid}} = \frac{A_{\text{clear}}}{A_{\text{parcel}}} \ge 0.25$$
Scenes with $f_{\text{valid}} < 0.25$ are rejected from vegetation index calculations. The date is still displayed in the observation ledger with an explicit label: `"Cloud-obscured"`.

### 4.2 GPM IMERG Half-Hour Integration Screening
Each daily IMERG granule aggregates 48 half-hour microwave and infrared scans. A day with missing satellite passes is flagged:
$$\text{Full Day} \iff \text{precipitation\_cnt} = 48$$
If $\text{precipitation\_cnt} < 48$, the day is preserved, but marked as `partialSampling = true`. The user interface displays a caution: *"Satellite observed only $N/48$ half-hours today; total rain may be higher."*

---

## 5. Physical Transformations & Pedotransfer Pipelines

### 5.1 ISRIC SoilGrids v2 Multi-Depth Thickness Weighting
SoilGrids v2 queries return values at discrete standard depth slices: `0–5 cm`, `5–15 cm`, and `15–30 cm`. To calculate the agronomic topsoil root zone ($0–30\text{ cm}$), Green Ally Project applies thickness-weighted trapezoidal averaging:

$$\bar{X}_{0-30\text{cm}} = \frac{5 \cdot X_{0-5\text{cm}} + 10 \cdot X_{5-15\text{cm}} + 15 \cdot X_{15-30\text{cm}}}{30}$$

**Pedotransfer Water Capacity (AWC):**
Available Water Capacity is derived from water retention layers:
$$\text{AWC}_{0-30\text{cm}} = \bar{\theta}_{wv0033} - \bar{\theta}_{wv1500} \quad [\text{m}^3/\text{m}^3]$$
Where $\theta_{wv0033}$ is field capacity (-33 kPa) and $\theta_{wv1500}$ is permanent wilting point (-1500 kPa). Total plant-available water storage capacity ($S_{\max}$) in the top 30 cm is:
$$S_{\max} = \text{AWC} \times 300\text{ mm}$$

### 5.2 USDA Soil Texture Classification Algorithm
The sand, silt, and clay percentages from SoilGrids are fed into the USDA soil texture triangle algorithm (`usdaTexture()`), which deterministically assigns one of 12 textural classes (e.g., *clay*, *clay loam*, *silty clay*, *sandy loam*).

```
        100% Clay
           /\
          /  \
         /    \
        / Clay \
       /________\
      /  \  CL  /\
     /SCL \____/SC\
    /______\  /____\
   / SL \ L \/ SiL  \
  /______\__/\_______\
100% Sand            100% Silt
```

### 5.3 Topographic Gradient (Horn's 3×3 Finite Difference)
Terrain slope is calculated over the 30 m SRTM DEM using Horn's (1981) weighted gradient on a 3×3 moving window:
$$\text{Slope} = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \times \frac{180}{\pi}$$
Where:
$$\Delta y = \Delta \text{Lat} \times 111,320\text{ m}$$
$$\Delta x = \Delta \text{Lon} \times 111,320\text{ m} \times \cos(\text{Lat})$$
This prevents single-pixel noise from corrupting slope estimates, ensuring robust erosion risk classification.

---

## 6. Ground-Truth Calibration & Known Biases

### 6.1 NOAA GHCN-Daily Myanmar Calibration Analysis
The repository incorporates real ground-truth validation against NOAA GHCN-Daily meteorological stations across Myanmar (`data/validation/power-vs-ghcn.json`).

| Station ID | Station Name | Region | Latitude | Longitude | Elevation Diff | Tmax RMSE | Rain RelBias | Calibration Finding |
|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|
| **BMM00048097** | Yangon International | Delta Edge | 16.907°N | 96.133°E | -22 m | 2.47 °C | 0.0% | Excellent monsoon rain agreement; solid maritime temperature tracking. |
| **BMM00048042** | Mandalay | Central Dry Zone | 21.983°N | 96.100°E | -11 m | 2.25 °C | **-50.9%** | **Critical Bias:** NASA POWER underestimates convective rainfall by half! |
| **BMM00048062** | Sittwe | Rakhine Coast | 20.150°N | 92.883°E | -1 m | 2.99 °C | 0.0% | Heavy coastal monsoonal precipitation tracks well. |
| **BMM00048008** | Myitkyina | Northern Highlands | 25.383°N | 97.400°E | -18 m | 3.09 °C | -44.8% | Orographic rain shading causes significant satellite underestimation. |
| **BMM00048112** | Kawthaung | Southern Peninsula | 10.050°N | 98.550°E | -25 m | 3.51 °C | 0.0% | Equatorial rain regime matches gauge totals. |

### 6.2 Agronomic Impact of the Central Dry Zone Rain Bias
In the Central Dry Zone (Magway and Mandalay regions), farmers face acute drought vulnerability. Because NASA POWER reanalysis rain is ~51% lower than ground gauges:
1. Pure satellite models would drastically overestimate drought stress and falsely declare drought-tolerant pulses infeasible.
2. Green Ally Project mitigates this by injecting an explicit runtime warning via `lib/validation/source-checks.ts`:
   > *"In the Dry Zone, NASA POWER rain was about 51% lower than the Mandalay weather station over 2015–2024, so rain shortfall and drought stress here are probably overstated."*
3. The MCDA engine adjusts its risk weights so that false water shortfall does not unfairly penalize viable crop rotations.

---

## 7. The Urban Centroid vs Agricultural Field Discrepancy

A major discovery during the scientific audit was that 15 out of 25 predownloaded soil files contained `null` values:

```
Town Centroid Sampling vs Rural Agricultural Parcel Sampling

Case A: Township Centroid (e.g., Pathein 16.78°N, 94.73°E)
┌──────────────────────────────────────────────┐
│  Built-up structures, concrete, river port  │
│  ISRIC Land Cover: Urban / Inland Water     │
│  SoilGrids Query Result: null               │
└──────────────────────────────────────────────┘

Case B: Rural Agricultural Parcel (e.g., Pathein Rural 16.72°N, 94.75°E)
┌──────────────────────────────────────────────┐
│  Active alluvial floodplain paddy parcel     │
│  ISRIC Land Cover: Cropland                 │
│  SoilGrids Query Result:                    │
│    Clay: 33.0%, Silt: 42.6%, Sand: 24.4%     │
│    pH (H2O): 6.4 (Slightly acid, ideal rice) │
│    Texture: Clay Loam                        │
└──────────────────────────────────────────────┘
```

### Action Taken
1. Identified that administrative coordinate points placed on town centers or riverbanks trigger SoilGrids water/urban masking.
2. Formulated and downloaded true agricultural field parcels for all 5 Ayeyarwady hubs (Pathein Rural, Mawlamyinegyun Rural, Hinthada Rural, Myaungmya, Pyapon).
3. Demonstrated that when coordinates are placed on actual agricultural land, SoilGrids v2 returns complete, high-quality pedological profiles across all depths.
4. Preserved both datasets in the repository to document the phenomenon and validate the fallback behavior of the agronomic engine.

---

## 8. Reproducibility & Integrity Verification

All downloads, provenance trails, and integrity verifications can be independently audited and reproduced:
- **Execute Data Acquisition:** `npx tsx scripts/research/download_data.ts`
- **Execute Data Validation:** `npx tsx scripts/research/validate_downloads.ts`
- **Inspect Manifest:** `research/data/manifest.json`
- **Inspect Operation Log:** `research/02_DOWNLOAD_LOG.md`
