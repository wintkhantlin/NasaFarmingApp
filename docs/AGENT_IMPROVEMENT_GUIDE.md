# AI Agent Improvement & Engineering Handoff Guide

> **Status:** Operational Handoff & Optimization Roadmap  
> **Audience:** Next AI Agent, Autonomous Coding Subagents, Research Engineers  
> **Companion Documents:** [MATHS_AND_SCIENCE.md](MATHS_AND_SCIENCE.md), [ALGORITHMS.md](ALGORITHMS.md), [DATASETS.md](DATASETS.md)  
> **Verification Harness:** `npx vitest run` (16 test suites, 151 test cases)  
> **Last Verified:** November 2026

---

## Table of Contents
1. [Handoff Briefing & Architectural Map](#1-handoff-briefing--architectural-map)
2. [Critical Audit: Current Implementations vs. Theoretical Ideals](#2-critical-audit-current-implementations-vs-theoretical-ideals)
3. [Prioritized Actionable Work Packages (WPs)](#3-prioritized-actionable-work-packages-wps)
   - [WP-1: Advanced FAO-56 Dual $K_c$ & Hydrological Water Balance](#wp-1-advanced-fao-56-dual-k_c--hydrological-water-balance)
   - [WP-2: Climate-Triggered & Soil-Moisture-Triggered Dynamic Sowing Engine](#wp-2-climate-triggered--soil-moisture-triggered-dynamic-sowing-engine)
   - [WP-3: Combinatorial Pareto Frontier Optimization & TOPSIS MCDA](#wp-3-combinatorial-pareto-frontier-optimization--topsis-mcda)
   - [WP-4: Live Satellite Data Pipelines & Cloud-Penetrating Radar (SAR)](#wp-4-live-satellite-data-pipelines--cloud-penetrating-radar-sar)
   - [WP-5: Variety-Specific Calibration & Dynamic Nitrogen Mineralization](#wp-5-variety-specific-calibration--dynamic-nitrogen-mineralization)
4. [Prompt Templates for Triggering Subagent Improvements](#4-prompt-templates-for-triggering-subagent-improvements)
5. [Regression Test Suite & Safety Invariants](#5-regression-test-suite--safety-invariants)

---

## 1. Handoff Briefing & Architectural Map

All calculations and decision logic reside in `lib/engine/*`. NASA and soil adapters reside in `lib/nasa/*` and `lib/soil/*`.
Run tests with `npx vitest run`. All 151 unit tests must pass before merging improvements.

---

## 2. Critical Audit: Current Implementations vs. Theoretical Ideals

- **Bioclimatology:** Hargreaves is used as fallback when secondary variables are missing; $RH_{\text{mean}}$ approximates actual vapor pressure.
- **Hydrology:** Runoff is currently assumed zero; water stress is flagged when $D_r > 0.5 \cdot TAW$ rather than continuously adjusted with $K_s$.
- **MCDA:** Uses Weighted Sum Model (WSM) with min-max normalization; templates are predefined rather than combinatorially explored.
- **Phenology:** Planting dates are static regional dates rather than dynamic monsoon onset triggers.
- **Remote Sensing:** Optical scenes have high monsoon cloud gaps; no radar SAR integration yet.

---

## 3. Prioritized Actionable Work Packages (WPs)

### WP-1: Advanced FAO-56 Dual $K_c$ & Hydrological Water Balance
- Implement USDA-NRCS SCS Curve Number surface runoff ($RO$).
- Implement dynamic water stress coefficient $K_s = \frac{TAW - D_r}{(1 - p) TAW}$.
- Update rootZoneBalance to adjust actual transpiration: $ET_{c,\text{adj}} = (K_s K_{cb} + K_e) ET_0$.

### WP-2: Climate-Triggered & Soil-Moisture-Triggered Dynamic Sowing Engine
- Replace static calendar dates with:
  1. 3-day cumulative rainfall $\ge 25\text{ mm}$.
  2. Topsoil depletion fraction $\le 0.40$.
  3. No subsequent 10-day dry spell.
- Drive phenological progression via cumulative thermal time ($GDD_{\text{cum}}$).

### WP-3: Combinatorial Pareto Frontier Optimization & TOPSIS MCDA
- Build an agronomic sequence graph and enumerate valid multi-year cycles.
- Extract non-dominated solutions along the Pareto efficiency frontier.
- Implement TOPSIS alongside WSM.

### WP-4: Live Satellite Data Pipelines & Cloud-Penetrating Radar (SAR)
- Wire `EARTHDATA_TOKEN` into live IMERG and AppEEARS client.
- Ingest Sentinel-1 SAR C-band ($VV/VH$) to observe soil moisture through monsoon clouds.

### WP-5: Variety-Specific Calibration & Dynamic Nitrogen Mineralization
- Parameterize named regional cultivars (*Sin Thu Kha*, *Magway-1*, *Yezin-3*).
- Implement residue nitrogen mineralization based on biomass, $C:N$ ratio, soil temperature, and moisture.

---

## 4. Prompt Templates for Triggering Subagent Improvements

Refer to Section 4 of this guide for pre-formulated prompts when delegating WP-1 through WP-5 to coding agents.

---

## 5. Regression Test Suite & Safety Invariants
- **No Imputation:** Missing data must yield `unknown`, never `0` or pass.
- **Resolution Honesty:** Gridded data must be labelled `"regional-context"`.
- **Light Mode Only:** Do not add dark mode classes or theme toggles.
- **Never Color Alone:** Every verdict pairs an icon/word with its color token.
- **100% Tests Pass:** Preserve all 151 passing vitest tests.
