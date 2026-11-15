# Codebase Map (MAP.md)

> **Purpose for Coding Agents:**  
> Use this index to locate files instantly without full-text grep or directory walks, saving search time and context tokens.

---

## 1. Architecture Overview

- **Framework:** Next.js (App Router, Server & Client Components) with TypeScript & Tailwind CSS.
- **Design System & UX:** Strictly light-mode only (see [`DESIGN_SYSTEM.md`](file:///Users/happer/Projects/nasafarmingapp/DESIGN_SYSTEM.md) and [`UX.md`](file:///Users/happer/Projects/nasafarmingapp/UX.md)).
- **Domain:** Agro-climatic crop rotation and field planning using NASA earth observation data (POWER, IMERG, SMAP, AppEEARS, HLS, ECOSTRESS, Planetary Computer STAC) and SoilGrids for Myanmar and global agricultural regions.
- **Client State:** IndexedDB / memory storage managed via Zustand stores ([`lib/store/fields-store.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/store/fields-store.ts)).
- **Computation Engine:** Deterministic scientific agronomy engine in [`lib/engine/`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/) and [`lib/rotation/`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation/).

---

## 2. Directory Quick-Finder

| Directory | Primary Responsibility |
|---|---|
| [`app/(app)/`](file:///Users/happer/Projects/nasafarmingapp/app/(app)) | Standard app layout, dashboard, field profile, conditions, comparison, report, rotation explorer |
| [`app/(map)/`](file:///Users/happer/Projects/nasafarmingapp/app/(map)) | Full-screen interactive map views for field creation and boundary editing |
| [`app/api/`](file:///Users/happer/Projects/nasafarmingapp/app/api) | Route handlers for conditions, soil, remote sensing, weather trends, commodity prices, rotation |
| [`components/ui/`](file:///Users/happer/Projects/nasafarmingapp/components/ui) | Base visual components (chips, panels, badges, readings, buttons, provenance tags) |
| [`components/field/`](file:///Users/happer/Projects/nasafarmingapp/components/field) | Domain-specific field views (rotation editor, moisture clock, crop calendar, what-if, conditions) |
| [`components/map/`](file:///Users/happer/Projects/nasafarmingapp/components/map) | Mapbox GL field boundary drawing, tile layers, pin dropping |
| [`components/shell/`](file:///Users/happer/Projects/nasafarmingapp/components/shell) | Navigation bars, welcome gate modal, header brand marks |
| [`components/preview/`](file:///Users/happer/Projects/nasafarmingapp/components/preview) | Showcase and UI stage demo components (`stageshow` kit) |
| [`lib/engine/`](file:///Users/happer/Projects/nasafarmingapp/lib/engine) | Scientific evaluation engine: MCDA ranking, water balance, climate, ET0, pest, soil health, suitability |
| [`lib/rotation/`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation) | Orchestrator wiring engine algorithms to field requests and recommendation payloads |
| [`lib/nasa/`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa) | NASA POWER, IMERG, Earthdata AppEEARS API, Planetary Computer, QA flags, and index derivations |
| [`lib/soil/`](file:///Users/happer/Projects/nasafarmingapp/lib/soil) | SoilGrids REST client and pedotransfer water retention functions |
| [`lib/geo/`](file:///Users/happer/Projects/nasafarmingapp/lib/geo) | Geocoding, UTM conversions, GeoJSON shapes, static map image generation |
| [`lib/store/`](file:///Users/happer/Projects/nasafarmingapp/lib/store) | Zustand state stores (fields, settings, locale, repository, cache) |
| [`lib/server/`](file:///Users/happer/Projects/nasafarmingapp/lib/server) | Server-side data fetching, aggregation, queueing, in-memory caching |
| [`lib/data/`](file:///Users/happer/Projects/nasafarmingapp/lib/data) | Crop definitions (Myanmar & reference crops), region bounds, agronomic rules |
| [`lib/schemas/`](file:///Users/happer/Projects/nasafarmingapp/lib/schemas) | Zod schema validation for field metadata, coordinates, rotation slots |
| [`lib/copy/`](file:///Users/happer/Projects/nasafarmingapp/lib/copy) | English (`en.ts`) and Burmese (`my.ts`) localization dictionaries |
| [`docs/`](file:///Users/happer/Projects/nasafarmingapp/docs) | Scientific papers, algorithms specification, dataset dossiers, and architecture notes |
| [`tests/`](file:///Users/happer/Projects/nasafarmingapp/tests) | Vitest unit and integration test suites |

---

## 3. Detailed File Catalog

### 3.1 App Routes (`app/`)

#### Pages & Layouts (`app/(app)/`)
- [`app/(app)/layout.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/layout.tsx): Standard application shell layout with AppNav and WelcomeGate.
- [`app/(app)/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/page.tsx): Home dashboard displaying field list or first-run onboarding.
- [`app/(app)/plan/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/plan/page.tsx): Standalone rotation planning / explorer playground page.
- [`app/(app)/plan/rotation-explorer.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/plan/rotation-explorer.tsx): Interactive rotation scenario sandbox.
- [`app/(app)/plan/messages.ts`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/plan/messages.ts): Guidance copy and helper notices for the planner.
- [`app/(app)/learn/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/learn/page.tsx): Educational guides on satellite datasets and agronomic concepts.
- [`app/(app)/about/crops/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/about/crops/page.tsx): Catalog of supported crops, characteristics, and sowing windows.
- [`app/(app)/about/data/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/about/data/page.tsx): Explanation of NASA datasets, provenance, and update frequencies.
- [`app/welcome/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/welcome/page.tsx): First-time welcome walkthrough and region selection.

#### Field Specific Sub-pages (`app/(app)/fields/[fieldId]/`)
- [`app/(app)/fields/[fieldId]/layout.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/fields/[fieldId]/layout.tsx): Field tab navigation wrapper (Overview, Conditions, Rotation, Compare, Report).
- [`app/(app)/fields/[fieldId]/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/fields/[fieldId]/page.tsx): Field overview summary (current crop, next action, critical limits).
- [`app/(app)/fields/[fieldId]/conditions/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/fields/[fieldId]/conditions/page.tsx): Comprehensive agro-climatic conditions (moisture, temperature, rainfall, soil).
- [`app/(app)/fields/[fieldId]/rotation/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/fields/[fieldId]/rotation/page.tsx): Rotation editor, candidate comparison, and what-if simulator.
- [`app/(app)/fields/[fieldId]/compare/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/fields/[fieldId]/compare/page.tsx): Side-by-side MCDA comparison of alternative rotations.
- [`app/(app)/fields/[fieldId]/report/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/fields/[fieldId]/report/page.tsx): Printable / exportable seasonal advisory report.
- [`app/(app)/fields/[fieldId]/profile/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/fields/[fieldId]/profile/page.tsx): Farm profile settings (soil texture override, irrigation capability, market access).
- [`app/(app)/fields/[fieldId]/questions/[questionId]/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/fields/[fieldId]/questions/[questionId]/page.tsx): Single-question prompt page to fill missing field constraints.

#### Map Routes (`app/(map)/`)
- [`app/(map)/layout.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(map)/layout.tsx): Full-bleed layout without standard header padding.
- [`app/(map)/fields/new/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(map)/fields/new/page.tsx): Interactive map to drop a pin or draw boundary for a new field.
- [`app/(map)/fields/[fieldId]/location/page.tsx`](file:///Users/happer/Projects/nasafarmingapp/app/(map)/fields/[fieldId]/location/page.tsx): Edit location coordinates and boundary polygon.

#### API Route Handlers (`app/api/`)
- [`app/api/field/[fieldId]/conditions/route.ts`](file:///Users/happer/Projects/nasafarmingapp/app/api/field/[fieldId]/conditions/route.ts): Fetches combined weather, soil, and moisture conditions.
- [`app/api/field/[fieldId]/soil/route.ts`](file:///Users/happer/Projects/nasafarmingapp/app/api/field/[fieldId]/soil/route.ts): SoilGrids data and pedotransfer estimates for the field point.
- [`app/api/field/[fieldId]/trends/route.ts`](file:///Users/happer/Projects/nasafarmingapp/app/api/field/[fieldId]/trends/route.ts): Multi-year climate normals and precipitation trends.
- [`app/api/field/[fieldId]/remote-sensing/route.ts`](file:///Users/happer/Projects/nasafarmingapp/app/api/field/[fieldId]/remote-sensing/route.ts): Vegetation indices (NDVI, NDMI) from HLS / MODIS / Planetary Computer.
- [`app/api/rotation/route.ts`](file:///Users/happer/Projects/nasafarmingapp/app/api/rotation/route.ts): Evaluates a proposed rotation against historical climate and soil.
- [`app/api/rotation/explore/route.ts`](file:///Users/happer/Projects/nasafarmingapp/app/api/rotation/explore/route.ts): Generates ranked rotation candidates using MCDA.
- [`app/api/locations/route.ts`](file:///Users/happer/Projects/nasafarmingapp/app/api/locations/route.ts): Geocoding query endpoint for town / region search.
- [`app/api/market/global/route.ts`](file:///Users/happer/Projects/nasafarmingapp/app/api/market/global/route.ts): Global commodity futures and reference pricing.

---

### 3.2 Scientific Agronomy & Rotation Engine (`lib/engine/`)

The core deterministic engine implementing NASA and FAO-56 scientific criteria:

- [`lib/engine/mcda.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/mcda.ts): Multi-criteria decision analysis ranker with fixed target/limit anchors and missing evidence handling.
- [`lib/engine/candidates.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/candidates.ts): Regional crop rotation templates and candidate generator.
- [`lib/engine/water.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/water.ts): Daily soil water balance, root-zone depletion, shortfall, and drought stress.
- [`lib/engine/et0.ts`](file:///Users/hargreaves/Projects/nasafarmingapp/lib/engine/et0.ts): FAO-56 Hargreaves reference evapotranspiration from extraterrestrial radiation and temperature range.
- [`lib/engine/rain.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/rain.ts): Precipitation metrics, dry-spell lengths, heavy rain thresholds, and percentiles.
- [`lib/engine/climate.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/climate.ts): Multi-year daily climatology, historical heat/cold normals, and rainfall totals.
- [`lib/engine/exposure.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/exposure.ts): Phenological stage-specific heat and frost risk checks.
- [`lib/engine/soil-health.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/soil-health.ts): Partial nitrogen budget, legume N-fixation, residue cover, and organic matter index.
- [`lib/engine/soil-input.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/soil-input.ts): Resolves hierarchy between farmer-tested soil properties and SoilGrids remote estimates.
- [`lib/engine/pest.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/pest.ts): Plant family sequencing checks (e.g. solanaceous breaks) to reduce soil-borne pests/diseases.
- [`lib/engine/suitability.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/suitability.ts): Sowing window calendar checks, soil pH range, and drainage match.
- [`lib/engine/season.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/season.ts): Date window arithmetic, growing degree days (GDD), and crop calendar alignment.
- [`lib/engine/strip.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/strip.ts): Multi-year historical season replay strips (identifying stressed vs. safe years).
- [`lib/engine/structure.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/structure.ts): Rotation descriptors (crop diversity count, fallow intervals, legume ratio).
- [`lib/engine/compare.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/compare.ts): Comparative fit analysis between multiple candidate rotations.
- [`lib/engine/what-if.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/what-if.ts): Sensitivity analysis simulator (e.g., adding irrigation, changing planting date).
- [`lib/engine/limits.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/limits.ts): Hard tri-state constraint checks (`pass` | `fail` | `not-asked`).
- [`lib/engine/farmer-decision.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/farmer-decision.ts): Farmer preference types (water access, labor constraints, market priorities).
- [`lib/engine/economics.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/economics.ts): Gross margin ranges and FAO Ky water-yield response loss modeling.
- [`lib/engine/forage-market.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/forage-market.ts): Feed/forage suitability and local marketability feasibility checks.
- [`lib/engine/global-prices.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/global-prices.ts): Normalized international benchmark price conversions.
- [`lib/engine/lowcover.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/lowcover.ts): Identifies bare soil intervals suitable for cover crops or short pulses.
- [`lib/engine/questions.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/questions.ts): Clarification question bank triggered when missing data blocks high-priority evaluation.
- [`lib/engine/provenance.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/provenance.ts): Attaches dataset provenance, spatial scale, and temporal resolution to derived indicators.
- [`lib/engine/scenario.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/scenario.ts): Default assumptions for unconfigured water access scenarios.
- [`lib/engine/trend.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/trend.ts): Multi-decadal trend slopes and variance analysis.
- [`lib/engine/data.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/data.ts): Baseline years, source health statuses, and study periods.

---

### 3.3 Rotation Orchestration (`lib/rotation/`)

High-level services connecting external data and UI state to the engine:

- [`lib/rotation/engine.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation/engine.ts): Main `recommend()` orchestration entry point.
- [`lib/rotation/environment.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation/environment.ts): Aggregates weather, soil, and remote sensing into the engine's required environment object.
- [`lib/rotation/farmer-request.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation/farmer-request.ts): Parses UI inputs into structured engine request options.
- [`lib/rotation/field-request.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation/field-request.ts): Converts a saved `Field` model into an engine execution request.
- [`lib/rotation/planning.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation/planning.ts): Sowing date suggestions and seasonal calendar calculations.
- [`lib/rotation/power-environment.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation/power-environment.ts): Builds environment input exclusively from NASA POWER daily records.
- [`lib/rotation/presentation.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation/presentation.ts): Formats engine outputs into farmer-facing text, chips, and risk summaries.

---

### 3.4 Data Access, Satellite & Soil Clients (`lib/nasa/`, `lib/soil/`, `lib/server/`)

#### NASA & Satellite APIs (`lib/nasa/`)
- [`lib/nasa/power.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/power.ts): NASA POWER client for daily meteorological data (precipitation, Tmax, Tmin, RH, radiation).
- [`lib/nasa/imerg.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/imerg.ts): GPM IMERG Final precipitation record processing.
- [`lib/nasa/earthdata.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/earthdata.ts): Earthdata Login credentials and token management.
- [`lib/nasa/planetary-computer.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/planetary-computer.ts): Microsoft Planetary Computer STAC & COG client for Harmonized Landsat Sentinel-2 (HLS).
- [`lib/nasa/appeears/client.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/appeears/client.ts): AppEEARS task submission and extraction client.
- [`lib/nasa/appeears/products.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/appeears/products.ts): AppEEARS product and layer catalog definitions.
- [`lib/nasa/appeears/tasks.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/appeears/tasks.ts): Task payload builders for point (SMAP) and area (HLS, SRTM, MODIS) extractions.
- [`lib/nasa/appeears/results.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/appeears/results.ts): Parsers for AppEEARS CSV and GeoTIFF result bundles.
- [`lib/nasa/appeears/scale.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/appeears/scale.ts): Applies scale factors and unit conversions to raw raster layers.
- [`lib/nasa/qa/hls-fmask.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/qa/hls-fmask.ts): Fmask quality assessment decoding for HLS (cloud, cirrus, snow, water).
- [`lib/nasa/qa/modis-vi.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/qa/modis-vi.ts): MOD13Q1 16-bit vegetation index quality word decoder.
- [`lib/nasa/qa/ecostress.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/qa/ecostress.ts): Cloud and water mask screening for ECOSTRESS evapotranspiration.
- [`lib/nasa/derive/ndvi.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/derive/ndvi.ts): Computes NDVI and NDMI from red/NIR/SWIR reflectance.
- [`lib/nasa/derive/slope.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/derive/slope.ts): Computes terrain slope from SRTM digital elevation grids.

#### Soil Modeling (`lib/soil/`)
- [`lib/soil/soilgrids.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/soil/soilgrids.ts): ISRIC SoilGrids REST API client (sand, silt, clay, organic carbon, pH, bulk density).
- [`lib/soil/pedotransfer.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/soil/pedotransfer.ts): Saxton-Rawls pedotransfer functions (wilting point, field capacity, saturation, available water).

#### Server Services (`lib/server/`)
- [`lib/server/weather.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/server/weather.ts): Server-side NASA POWER fetching with fallback to pre-downloaded offline datasets.
- [`lib/server/soil.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/server/soil.ts): SoilGrids fetching with pre-downloaded fallback.
- [`lib/server/trends.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/server/trends.ts): Aggregates historical climatology into decadal trend summaries.
- [`lib/server/remote-sensing.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/server/remote-sensing.ts): Unified remote sensing fetcher (Planetary Computer STAC + AppEEARS).
- [`lib/server/global-prices.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/server/global-prices.ts): Server-side commodity exchange price fetching and caching.
- [`lib/server/cache.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/server/cache.ts): In-memory TTL cache for server API handlers.
- [`lib/server/queue.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/server/queue.ts): In-flight request deduplication and concurrency throttling.
- [`lib/server/imerg-backfill.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/server/imerg-backfill.ts): Historical IMERG precipitation data backfill handler.

---

### 3.5 Core Data, Geo, Stores & Common (`lib/`)

- [`lib/types.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/types.ts): Global TypeScript domain interfaces (`Field`, `Crop`, `Rotation`, `Conditions`, `DerivedIndicator`).
- [`lib/units.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/units.ts): Metric / imperial / agricultural unit conversions (ha to acre, mm to inches, kg/ha to basket/acre).
- [`lib/theme.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/theme.ts): Token definitions and theme constants aligned with `DESIGN_SYSTEM.md`.
- [`lib/cn.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/cn.ts): Tailwind class merge utility (`clsx` + `tailwind-merge`).
- [`lib/download.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/download.ts): Client-side JSON and report download helpers.
- [`lib/rotation-plan.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation-plan.ts): Rotation plan builders and state transform utilities.
- [`lib/rotation-format.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/rotation-format.ts): Presentation text formatters for crop cycles and rotations.

#### Geodata (`lib/geo/`)
- [`lib/geo/shapes.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/geo/shapes.ts): Turf.js spatial operations (area in ha, centroid, bbox, polygon validation).
- [`lib/geo/geocode.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/geo/geocode.ts): Photon / OpenStreetMap geocoder with Myanmar admin boundaries priority.
- [`lib/geo/cells.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/geo/cells.ts): NASA POWER 0.5° × 0.625° grid cell math and spatial snapping.
- [`lib/geo/static-map.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/geo/static-map.ts): Mapbox Static Images API URL generator for static thumbnail previews.
- [`lib/geo/utm.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/geo/utm.ts): Coordinate transformation utilities.
- [`lib/geo/format.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/geo/format.ts): Latitude and longitude string formatters.

#### Static Data & Knowledge Bases (`lib/data/`)
- [`lib/data/crops/myanmar.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/data/crops/myanmar.ts): Myanmar crop database (paddy, black gram, green gram, sesame, groundnut, pigeon pea, maize, sunflower).
- [`lib/data/crops/reference.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/data/crops/reference.ts): Global benchmark crop agronomic parameters (corn, soybean, wheat, sorghum).
- [`lib/data/crops/real-world-economics.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/data/crops/real-world-economics.ts): Production costs, seed rates, and typical yield distributions.
- [`lib/data/crops/index.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/data/crops/index.ts): Aggregated crop repository lookup and filtering.
- [`lib/data/regions.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/data/regions.ts): Regional agro-ecological zones (Central Dry Zone, Ayeyarwady Delta, Shan Hills, Bago).
- [`lib/data/region-boundaries.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/data/region-boundaries.ts): GeoJSON bounding geometries for agricultural zones.

#### State Management (`lib/store/`)
- [`lib/store/fields-store.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/store/fields-store.ts): Main Zustand store for active fields, active field ID, and rotation plans.
- [`lib/store/repository.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/store/repository.ts): Persistence repository abstraction with validation logic.
- [`lib/store/storage.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/store/storage.ts): IndexedDB client storage engine with fallback to in-memory store.
- [`lib/store/settings-store.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/store/settings-store.ts): User preferences (data source toggles, units, expert mode).
- [`lib/store/locale-store.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/store/locale-store.ts): Language selection store (`en` vs `my`).
- [`lib/store/data-cache.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/store/data-cache.ts): Client-side cached conditions responses.

#### Evidence & Analysis (`lib/evidence/`, `lib/analysis/`)
- [`lib/evidence/indicator.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/evidence/indicator.ts): Derived indicator value formatting with error margins and bounds.
- [`lib/analysis/use-analysis.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/analysis/use-analysis.ts): React hook managing condition queries and engine runs.
- [`lib/analysis/engine-data.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/analysis/engine-data.ts): Adapts raw API responses into engine-ready input formats.
- [`lib/analysis/paired-improvement.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/analysis/paired-improvement.ts): Evaluates incremental benefit of switching from baseline to recommended plan.

#### Schemas (`lib/schemas/`)
- [`lib/schemas/field.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/schemas/field.ts): Zod schema for Field metadata and GeoJSON geometry.
- [`lib/schemas/rotation.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/schemas/rotation.ts): Zod schema for Rotation plan and slot dates.

#### Translations (`lib/copy/`)
- [`lib/copy/en.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/copy/en.ts): English UX strings and glossary.
- [`lib/copy/my.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/copy/my.ts): Burmese UX strings and localized agricultural terminology.

---

### 3.6 UI Components (`components/`)

#### Design System UI Elements (`components/ui/`)
- [`components/ui/button.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/button.tsx): Primary, secondary, outline, and ghost button primitives.
- [`components/ui/panel.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/panel.tsx): Structured content card container with token styling.
- [`components/ui/reading.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/reading.tsx): Data reading display (metric value, unit, label, reference status).
- [`components/ui/provenance.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/provenance.tsx): Data source provenance tag (NASA mission, resolution, retrieval date).
- [`components/ui/recommendation.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/recommendation.tsx): Recommendation action card with clear rationale and trade-offs.
- [`components/ui/risk-chip.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/risk-chip.tsx): Visual chip for heat, water, frost, or pest risk indicators.
- [`components/ui/status.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/status.tsx): Status dots and indicators (pass, warning, critical, pending).
- [`components/ui/segmented.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/segmented.tsx): Segmented button tab control.
- [`components/ui/disclosure.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/disclosure.tsx): Accordion disclosure component for scientific notes.
- [`components/ui/judgment-note.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/judgment-note.tsx): Callout explaining why a specific recommendation was made.
- [`components/ui/source-line.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/source-line.tsx): Compact data attribution caption.
- [`components/ui/empty-state.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/empty-state.tsx): Friendly empty states with clear action triggers.
- [`components/ui/charts.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/charts.tsx): SVG-based lightweight time series and bar charts.
- [`components/ui/page-bar.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/page-bar.tsx): Sticky top bar for screen headers and title hierarchy.
- [`components/ui/action-bar.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/action-bar.tsx): Sticky bottom bar for primary user actions.
- [`components/ui/skeleton.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/skeleton.tsx): Loading state placeholders.
- [`components/ui/icon.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/icon.tsx) & [`components/ui/icons.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/ui/icons.tsx): SVG icon library (crops, weather, risks, arrows).

#### Field Domain Components (`components/field/`)
- [`components/field/field-overview.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/field-overview.tsx): Field overview dashboard with current season indicators.
- [`components/field/conditions-view.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/conditions-view.tsx): Primary view of environmental and soil metrics.
- [`components/field/conditions-panels.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/conditions-panels.tsx): Breakdown panels for soil moisture, heat, rain, and soil profile.
- [`components/field/crop-calendar.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/crop-calendar.tsx): Multi-season timeline showing crop cycles against historical rainfall.
- [`components/field/moisture-clock-ribbon.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/moisture-clock-ribbon.tsx): Visual seasonal ribbon tracking moisture availability windows.
- [`components/field/season-strip.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/season-strip.tsx): Historical replay strip showing years where the rotation succeeded or failed.
- [`components/field/rotation-editor.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/rotation-editor.tsx): Interactive timeline editor to add, remove, and reorder crops.
- [`components/field/rotation-compare.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/rotation-compare.tsx): Comparative card matrix comparing candidate rotation scores.
- [`components/field/what-if.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/what-if.tsx): What-If simulation slider drawer (test irrigation, earlier planting).
- [`components/field/limit-checks.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/limit-checks.tsx): Displays hard constraint checklist with pass/fail badges.
- [`components/field/question-form.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/question-form.tsx): Interactive question card resolving missing constraints.
- [`components/field/farm-profile.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/farm-profile.tsx): Profile form for local field adjustments.
- [`components/field/farmer-guided-flow.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/farmer-guided-flow.tsx): Step-by-step guided interview wizard for rotation planning.
- [`components/field/report-view.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/report-view.tsx): Printable advisory report view.
- [`components/field/trends-view.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/trends-view.tsx): 30-year climate normals and shifting monsoon trends.
- [`components/field/location-picker.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/location-picker.tsx): Coordinates input and town search control.
- [`components/field/edit-location.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/edit-location.tsx): Modal wrapper for editing field boundaries.
- [`components/field/fields-list.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/fields-list.tsx): List of saved fields with health badges.
- [`components/field/field-page-header.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/field-page-header.tsx): Common header with field name, area, and tab links.
- [`components/field/field-shell.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/field-shell.tsx): Container wrapping field-level layout views.
- [`components/field/option-detail.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/option-detail.tsx): Deep-dive modal or drawer for a single candidate rotation.
- [`components/field/check-locally.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/field/check-locally.tsx): Callouts prompting on-the-ground checks (e.g. salinity test).

#### Map Components (`components/map/`)
- [`components/map/field-map.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/map/field-map.tsx): Mapbox GL wrapper supporting point marker placement and polygon drawing.
- [`components/map/mapbox-config.ts`](file:///Users/happer/Projects/nasafarmingapp/components/map/mapbox-config.ts): Mapbox tokens, satellite style definitions, and initial coordinate defaults.

#### Shell & Home Components (`components/shell/`, `components/home/`, `components/learn/`)
- [`components/shell/app-nav.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/shell/app-nav.tsx): Header navigation bar with links to Fields, Plan, Learn, and About.
- [`components/shell/welcome-gate.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/shell/welcome-gate.tsx): Detects empty state and routes new users to welcome onboarding.
- [`components/shell/brand-mark.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/shell/brand-mark.tsx): Application logo and title mark.
- [`components/home/first-run.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/home/first-run.tsx): Quick onboarding view when no fields exist yet.
- [`components/home/welcome.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/home/welcome.tsx): Region selector card (e.g., Ayeyarwady Delta, Dry Zone).
- [`components/learn/learn-list.tsx`](file:///Users/happer/Projects/nasafarmingapp/components/learn/learn-list.tsx): Educational article cards and glossary browser.

---

### 3.7 Pre-downloaded Offline Data (`data/predownload/`)

Fallback datasets for offline development or network failure scenarios:
- [`data/predownload/manifest.json`](file:///Users/happer/Projects/nasafarmingapp/data/predownload/manifest.json): Coordinate-to-file index mapping townships to cached weather/soil files.
- `data/predownload/soil/`: Cached SoilGrids samples for 25 major Myanmar townships (e.g., Magway, Meiktila, Pathein, Pyay, Taungoo, Lashio).
- `data/predownload/weather/`: 40-year daily NASA POWER weather files covering agricultural grid points in Myanmar.

---

### 3.8 Standalone Rotation Engine Specification (`rotation-engine/`)

- [`rotation-engine/README.md`](file:///Users/happer/Projects/nasafarmingapp/rotation-engine/README.md): Standalone engine specification and CLI instructions.
- [`rotation-engine/SCIENCE_NOTES.md`](file:///Users/happer/Projects/nasafarmingapp/rotation-engine/SCIENCE_NOTES.md): Mathematical derivation of equations, thresholds, and evidence tiers.
- [`rotation-engine/data/crops.json`](file:///Users/happer/Projects/nasafarmingapp/rotation-engine/data/crops.json): Pure JSON representation of crop agronomic rules and parameters.
- `rotation-engine/examples/`: Verified input/output JSON pairs (`ayeyarwady_demo.json`, `dryzone_demo.json`, `two_crop_demo.json`) for engine regression testing.

---

### 3.9 Documentation Guide (`docs/` & Root Docs)

- [`AGENTS.md`](file:///Users/happer/Projects/nasafarmingapp/AGENTS.md): Coding rules, Next.js agent notes, and light-mode invariant.
- [`DESIGN_SYSTEM.md`](file:///Users/happer/Projects/nasafarmingapp/DESIGN_SYSTEM.md): Visual design specifications (tokens, typography, layout, icons).
- [`UX.md`](file:///Users/happer/Projects/nasafarmingapp/UX.md): User experience design, voice, persona, and plain-language terminology.
- [`plan.md`](file:///Users/happer/Projects/nasafarmingapp/plan.md): 22-section product roadmap, architectural choices, and sprint tasks.
- [`docs/ALGORITHMS.md`](file:///Users/happer/Projects/nasafarmingapp/docs/ALGORITHMS.md): Detailed algorithm definitions for MCDA, soil water balance, and stress strips.
- [`docs/MATHS_AND_SCIENCE.md`](file:///Users/happer/Projects/nasafarmingapp/docs/MATHS_AND_SCIENCE.md): Agronomic science foundations and FAO-56 math proofs.
- [`docs/DATASETS.md`](file:///Users/happer/Projects/nasafarmingapp/docs/DATASETS.md) & [`docs/DATASET_RESEARCH_DOSSIER.md`](file:///Users/happer/Projects/nasafarmingapp/docs/DATASET_RESEARCH_DOSSIER.md): Complete survey of satellite and terrestrial products used.
- [`docs/PLANETARY_COMPUTER_INTEGRATION.md`](file:///Users/happer/Projects/nasafarmingapp/docs/PLANETARY_COMPUTER_INTEGRATION.md): Guide to querying HLS COGs via Planetary Computer STAC.
- [`docs/PREDOWNLOAD_MYANMAR_COST_ANALYSIS.md`](file:///Users/happer/Projects/nasafarmingapp/docs/PREDOWNLOAD_MYANMAR_COST_ANALYSIS.md): Cache sizing and API budget analysis.
- [`docs/SCREEN_FLOWS.md`](file:///Users/happer/Projects/nasafarmingapp/docs/SCREEN_FLOWS.md): Screen-by-screen state and user journeys.

---

### 3.10 Test Suites (`tests/`)

- [`tests/lib/engine-modules.test.ts`](file:///Users/happer/Projects/nasafarmingapp/tests/lib/engine-modules.test.ts): Unit tests for individual engine calculation modules.
- [`tests/lib/farmer-decision-mcda.test.ts`](file:///Users/happer/Projects/nasafarmingapp/tests/lib/farmer-decision-mcda.test.ts): Tests MCDA weighting and tie-breaking behavior.
- [`tests/lib/water-wiring.test.ts`](file:///Users/happer/Projects/nasafarmingapp/tests/lib/water-wiring.test.ts): Validates water balance and drought stress algorithms.
- [`tests/lib/soil.test.ts`](file:///Users/happer/Projects/nasafarmingapp/tests/lib/soil.test.ts): Pedotransfer and SoilGrids response testing.
- [`tests/lib/nasa-sources.test.ts`](file:///Users/happer/Projects/nasafarmingapp/tests/lib/nasa-sources.test.ts): NASA POWER and AppEEARS client parsing tests.
- [`tests/lib/planetary-computer.test.ts`](file:///Users/happer/Projects/nasafarmingapp/tests/lib/planetary-computer.test.ts): Planetary Computer STAC endpoint queries and QA decoding.
- [`tests/components/rotation-editor.test.tsx`](file:///Users/happer/Projects/nasafarmingapp/tests/components/rotation-editor.test.tsx): Component tests for the rotation editor UI.
- [`tests/components/field-overview.test.tsx`](file:///Users/happer/Projects/nasafarmingapp/tests/components/field-overview.test.tsx): Tests overview rendering and warning displays.

---

## 4. Common Agent Workflows ("Where do I make changes?")

### "I want to add or modify a crop or agronomic parameter"
1. Update crop attributes in [`lib/data/crops/myanmar.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/data/crops/myanmar.ts) or [`lib/data/crops/reference.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/data/crops/reference.ts).
2. Sync pure JSON copy in [`rotation-engine/data/crops.json`](file:///Users/happer/Projects/nasafarmingapp/rotation-engine/data/crops.json).
3. If economics or yield changes, review [`lib/data/crops/real-world-economics.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/data/crops/real-world-economics.ts).

### "I want to alter how rotations are scored or ranked"
1. Check MCDA formula in [`lib/engine/mcda.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/mcda.ts).
2. Check constraint pass/fail logic in [`lib/engine/limits.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/limits.ts).
3. Verify candidate template generation in [`lib/engine/candidates.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/engine/candidates.ts).
4. Run tests: `bun test tests/lib/farmer-decision-mcda.test.ts`.

### "I want to add or fix a NASA / Satellite data connection"
1. Weather: [`lib/nasa/power.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/power.ts) and [`lib/server/weather.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/server/weather.ts).
2. Rainfall: [`lib/nasa/imerg.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/imerg.ts).
3. Satellite Reflectance & Indices: [`lib/nasa/planetary-computer.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/planetary-computer.ts) and [`lib/nasa/derive/ndvi.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/derive/ndvi.ts).
4. QA Screening: [`lib/nasa/qa/`](file:///Users/happer/Projects/nasafarmingapp/lib/nasa/qa/).

### "I want to change the visual styling or UI layout"
1. Remember: **Light mode only** (strictly no dark mode classes or tokens).
2. Tokens & CSS: [`app/globals.css`](file:///Users/happer/Projects/nasafarmingapp/app/globals.css) and [`DESIGN_SYSTEM.md`](file:///Users/happer/Projects/nasafarmingapp/DESIGN_SYSTEM.md).
3. Base UI primitives: [`components/ui/`](file:///Users/happer/Projects/nasafarmingapp/components/ui/).
4. Screen layouts: [`app/(app)/fields/[fieldId]/`](file:///Users/happer/Projects/nasafarmingapp/app/(app)/fields/[fieldId]/) and [`components/field/`](file:///Users/happer/Projects/nasafarmingapp/components/field/).

### "I want to update localization copy"
1. English: [`lib/copy/en.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/copy/en.ts).
2. Burmese: [`lib/copy/my.ts`](file:///Users/happer/Projects/nasafarmingapp/lib/copy/my.ts).
