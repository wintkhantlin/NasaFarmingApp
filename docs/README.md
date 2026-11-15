# NASA Crop Rotation Planning Documentation

> **System Documentation Suite**  
> **Status:** Current & Validated  
> **Repository:** `nasafarmingapp`  
> **Release Target:** Field Almanac / Crop Rotation Decision Engine

---

## Documentation Suite Map

This directory contains the complete scientific, algorithmic, data catalog, and engineering handoff specifications for the NASA Farming Crop Rotation Planning platform.

| Document | Purpose & Content | Target Audience |
|---|---|---|
| **[SCREEN_DIRECTORY.md](SCREEN_DIRECTORY.md)** | **Master screen directory & refinement guide:** Complete inventory of every screen (S01–S19, Plan Wizard, Settings, Guides) with screenshot visual index, jobs-to-be-done, components, and actionable agent refinement tasks. | Autonomous Coding Agents, Product Designers |
| **[SCREEN_FLOWS.md](SCREEN_FLOWS.md)** | Comprehensive UX process architecture, user journeys (J1–J6), transition policies (*Ye-pyan* relay broadcast), feasibility gates, and data contracts. | UX Designers, Frontend Architects |
| **[MATHS_AND_SCIENCE.md](MATHS_AND_SCIENCE.md)** | Mathematical physics, bioclimatology, FAO-56 Penman-Monteith, Hargreaves fallback, soil hydrology, root-zone depletion balance, growing degree days, extreme heat/cold exposure, remote sensing radiometry, Horn's 3x3 DEM slope, biological nitrogen fixation, and stochastic economics. | Agronomic Modelers, Physicists, AI Subagents |
| **[ALGORITHMS.md](ALGORITHMS.md)** | Algorithmic logic, pseudocode, multi-criteria decision analysis (MCDA) with dynamic weight renormalization, candidate generation and combinatorial constraints, 4-tier suitability classification, season replay simulation, bare-ground satellite detection, and soil data arbitration. | Algorithm Engineers, Optimization Specialists |
| **[DATASETS.md](DATASETS.md)** | Complete data catalog, API request schemas, ingestion pipelines, units, scaling factors ($d\_factor$), fill value conversions, quality bitmasks (HLS Fmask, MODIS VI), NASA POWER, GPM IMERG, AppEEARS, ISRIC SoilGrids v2, and the 11-crop Myanmar library. | Data Engineers, Remote Sensing Specialists |
| **[AGENT_IMPROVEMENT_GUIDE.md](AGENT_IMPROVEMENT_GUIDE.md)** | Engineering handoff and improvement roadmap for incoming AI agents: critical audit of current simplifications vs. theoretical ideals, 5 prioritized work packages (FAO-56 Dual $K_c$, dynamic sowing trigger, Pareto frontier optimization, live SAR fusion, variety-level genetics), subagent prompt templates, and testing safety invariants. | Autonomous Coding Agents, Tech Leads |
| **[PREDOWNLOAD_MYANMAR_COST_ANALYSIS.md](PREDOWNLOAD_MYANMAR_COST_ANALYSIS.md)** | Comprehensive volume, storage, bandwidth, and cost analysis for pre-downloading and caching all environmental and satellite datasets across the 5 Agricultural Heartland Regions (Ayeyarwady, Magway, Mandalay, Shan, Bago: >85% cropland) vs. nationwide Myanmar. | Systems Architects, Project Leads |
| **[DATASET_RESEARCH_DOSSIER.md](DATASET_RESEARCH_DOSSIER.md)** | Deep-dive research dossier compiled during initial platform research on NASA Earthdata missions, AppEEARS products, and international agricultural datasets. | Researchers, Agronomists |
| **[data-spikes.md](data-spikes.md)** | Empirical results from Phase 0 connectivity spikes (AppEEARS, IMERG, SoilGrids, NASA POWER, Earthdata login). | Systems Engineers |

---

## Architectural Principles at a Glance

1. **Resolution Honesty:** Gridded data ($0.5^\circ$ NASA POWER, $0.1^\circ$ IMERG, $9\text{ km}$ SMAP) are presented as regional atmospheric context ("around your field"), never falsely resampled as field-gate microclimate measurements.
2. **Strict Non-Imputation:** Missing data is never substituted with zero, an average, or an unearned pass. Decisive missing parameters yield an auditable `unknown` state.
3. **Historical Scenario Replay:** The platform replays rotations against 40+ years of observed daily weather rather than generating uncalibrated probabilistic forecasts.
4. **Light Mode Only:** As dictated by `AGENTS.md` and `DESIGN.md`, the platform is strictly designed for daylight visibility in the field.
5. **Never Color Alone:** Every data verdict or risk indicator pairs an icon or descriptive word with its color token.

---

## Verification & Test Harness

The engine is protected by a 16-suite unit test harness:
```bash
# Run the entire test suite (151 tests)
npx vitest run

# Run engine modules test suite only
npx vitest run tests/lib/engine-modules.test.ts

# Run NASA adapters and remote sensing test suite
npx vitest run tests/lib/nasa-sources.test.ts
```
