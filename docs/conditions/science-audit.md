# Science and Source-Availability Audit: Field Conditions & Four Geospatial Risks

**Date:** 15 November 2026  
**Auditor:** Agent A (Scientific Evidence Contract Agent)  
**Standard:** Field Shift Technical Appendix v3.2, `FIELD_LEVEL_VULNERABILITIES_NASA_DATA.md`, `INTERACTIVE_NASA_TRENDS_MAPS.md`  

---

## 1. Dataset & Provenance Inventory

| Hazard Domain | Dataset / Engine | Native Footprint | Scale Classification | Status States Supported | What It Measures | What It Does NOT Measure |
|:---|:---|:---|:---|:---|:---|:---|
| **Water Stress** | NASA POWER Daily (`PRECTOTCORR`, `ET0` via Hargreaves) | 0.5° × 0.625° (~50 km) | `regional_context` (`wider`) | `ready`, `partial`, `loading`, `unavailable`, `stale`, `error` | Regional gridded reanalysis rainfall and atmospheric evaporative demand. | Farm field rainfall, field crop canopy transpiration, irrigation application, or root-zone water depletion. |
| **Water Stress** | GPM IMERG v7 (`imerg`) | 0.1° (~10 km) | `local_proxy` (`village`) | `ready`, `partial`, `loading`, `unconfigured`, `unavailable` | Satellite-gauge merged precipitation rate and daily totals. | Farm-scale rainfall or soil moisture. |
| **Water Stress** | SMAP L4 (`smap`) | 9 km grid | `regional_context` (`wider`) | `ready`, `partial`, `loading`, `unconfigured`, `unavailable` | Regional root-zone soil wetness estimate (0–100 cm). | Field-scale soil moisture or irrigation status. |
| **Water Stress** | NASA ECOSTRESS (`ecostress-et`) | 70 m (intermittent scenes) | `field_observation` | `ready`, `partial`, `loading`, `unconfigured`, `unavailable` | Thermal infrared surface evapotranspiration during clear-sky overpasses. | Continuous daily evapotranspiration or crop water stress index without validated canopy baseline. |
| **Water Stress** | FAO-56 Crop Water Balance (`ETc = Kc × ET0`) | Agronomic calculation | `local_proxy` | `ready`, `partial`, `unavailable` | Potential well-watered crop water demand. | Actual crop water consumption without starting soil water calibration. Missing initial storage must NOT default to 0 or field capacity. |
| **Flood** | Landsat C2 L2 / HLS Water QA (`QA_PIXEL`) | 30 m pixels | `field_observation` | `ready`, `partial`, `loading`, `unconfigured`, `unavailable` | Binary surface water classification on clear observation dates. | Flood depth, flow velocity, inundation duration, recurrence probability, or crop damage. Paddy irrigation is not distinguished from floods without local context. |
| **Flood** | NASA OPERA DSWx-HLS | 30 m pixels | `field_observation` | `unconfigured` / `unavailable` | Dynamic surface water extent from optical/SAR. | Depth, hazard probability, or crop failure risk. |
| **Erosion** | SRTM v3 / NASADEM (`srtm`) | 30 m grid (~1 arc-sec) | `local_proxy` (`estimated`) | `ready`, `partial`, `loading`, `unconfigured`, `unavailable` | Topographic slope (degrees and steepness classification). | Soil loss (tonnes/ha), rill erosion, or gully formation. Missing DEM means erosion cannot be classified. |
| **Erosion** | ISRIC SoilGrids v2 | 250 m model | `local_proxy` (`estimated`) | `ready`, `unavailable` | Regional soil texture class and organic carbon. | Field soil stability or erosion resistance. |
| **Erosion** | RUSLE Screening (`A = R·K·LS·C·P`) | Agronomic model | `local_proxy` | `partial`, `unavailable` | Qualitative susceptibility screening when factors exist. | Field soil loss without management (P) and conservation practices (C). Tonnes/ha is forbidden. |
| **Heat & Cold** | NASA POWER Daily (`T2M_MAX`, `T2M_MIN`) | 0.5° × 0.625° (~50 km) | `regional_context` (`wider`) | `ready`, `partial`, `loading`, `unavailable`, `stale` | 2-meter ambient air temperature exceedances (e.g., days ≥35°C). | Crop canopy temperature, pollen sterility, heat injury, or frost deposition on plant tissues. |
| **Heat & Cold** | Crop Growth Stage Window | Farmer rotation calendar | `field_observation` | `ready`, `partial`, `unavailable` | Calendar timing of flowering/sowing vs historical hot/cold months. | Crop injury without cultivar-specific thermal thresholds. |

---

## 2. Screenshot Example Audit (Anti-Hardcoding Gate)

The following values from screenshots must **NEVER** be hardcoded:
- `866 mm` annual rainfall: Must come dynamically from `conditions.annualRainMm` or `conditions.monthlyRainMm` sum.
- `68 days ≥35°C` in 2025: Must be derived from live `TrendSeries` or POWER daily temperatures; if missing/unvalidated, show truthful `unavailable` or `insufficient valid days`.
- `pH 5.9`, `SOC 30.5 g/kg`, `clay loam`: Must come from `conditions.soil` or `engineData.soil`.
- `2025` selected year: Must reflect available data years (e.g. up to previous complete calendar year in trends or active observation dates).

---

## 3. Scientific Gate Constraints

1. **Water Stress Gate:**
   - Rainfall minus demand (`P - ETc`) is a screening gap, NOT an irrigation requirement.
   - If initial root-zone moisture is unknown, the interface must state: *"Water storage at planting is not known"*. Do not assume 0 or 100%.
   - SMAP unavailable state must explicitly display: *"Regional soil-moisture observations not available"*.
2. **Flood Gate:**
   - Observed open water on valid acquisition dates must be labelled: *"Surface water observed in valid imagery"*.
   - Never display "Flood depth (m)", "Flood hazard probability (%)", or "Flood safe".
   - Prompt the farmer: *"Is standing water normal for your rice field, or does it damage crops or delay planting?"*.
3. **Erosion Gate:**
   - If SRTM slope is missing: *"Slope data is not available, so field erosion exposure cannot be assessed"*.
   - Never emit tonnes/ha or "low erosion" badges without slope, soil, and management factors.
   - Distinguish surface sheet/rill erosion from riverbank erosion or flooding.
4. **Heat & Cold Gate:**
   - Heat and Cold are internal sub-views of the single "Heat & cold" risk.
   - Threshold exceedance count (`days ≥35°C`) is distinct from a "heatwave" (consecutive-day duration).
   - Air temperature `Tmin < 0°C` is regional freezing air, not verified crop tissue frost.
   - If crop calendar is missing: *"Crop-stage exposure not evaluated"*.

---

## 4. Map Overlays & Footprint Support

- **Field Boundary:** Confirmed farmer polygon or pin centroid.
- **Footprint Outlines:**
  - NASA POWER: 0.5° × 0.625° cell box.
  - GPM IMERG: 0.1° cell box.
  - SMAP: 9 km box.
  - Landsat / HLS: 30 m pixel context.
- **Missing Data Behavior:** If no QA-valid scene or product data exists for the selected date, the map displays the field boundary with satellite basemap and a clear banner: *"No valid satellite observation on this date. Showing regional baseline."* Never render synthetic heatmap rasters.
