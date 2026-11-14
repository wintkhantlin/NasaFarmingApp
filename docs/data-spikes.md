# Data spikes (14 Nov 2026)

Results of the five Phase 0 spikes from the implementation plan. Raw samples are in `tests/fixtures/ames/`.

| # | Spike | Result | Decision |
|---|---|---|---|
| 1 | AppEEARS point task for SMAP + MOD13Q1 | **Blocked on credentials.** The public product list answers: `SPL3SMP_E.006` (9 km daily), `SPL4SMGP.008` (surface and root-zone soil moisture, 9 km daily), `MOD13Q1.061` (NDVI/EVI, 250 m, 16-day) and `HLS*_VI.020` (30 m) are all available. Submitting a task needs an Earthdata login; none is set. | Build the adapter against recorded response shapes and mark it `unverified-live`. Fallback if it never works: NDVI and soil moisture are dropped to POWER `GWETROOT`, and the app says so. |
| 2 | IMERG point series | **Failed.** GES DISC Hydrology Data Rods answers with a 301 to a notice that the service was discontinued. NASA POWER's `IMERG_PRECTOT` returns `-999` (no data) for every date tested (2015 and 2024). AppEEARS has no IMERG or GPM products. | IMERG needs Earthdata-authenticated access (Harmony or OPeNDAP on GES DISC), which requires credentials. Until then the rainfall record is POWER `PRECTOTCORR`, labelled "NASA POWER (MERRA-2, bias-corrected)", not "GPM IMERG". The UI must not claim IMERG. |
| 3 | GIBS satellite basemap | **Works.** WMTS in EPSG:3857 lists `HLS_L30_Nadir_BRDF_Adjusted_Reflectance` and `VIIRS_SNPP_CorrectedReflectance_TrueColor`; a VIIRS tile returned 25 KB. | Superseded: the app's map is **Mapbox** (`satellite-streets-v12`), chosen by the product owner on 14 Nov 2026. GIBS stays available as an optional NASA overlay later. Mapbox needs a public token in `NEXT_PUBLIC_MAPBOX_TOKEN` (see `.env.example`). |
| 4 | SoilGrids | **Works, with caveats.** Rural Iowa point returned all 8 properties for 3 depths. An urban point (Ames campus) returned `null` for everything. One 8-property, 3-depth request took 12 s; a 4-property request took 3.4 s. Values are scaled integers: divide by `d_factor` (clay 312 → 31.2 %, pH 65 → 6.5, SOC 230 → 23 g/kg). | Server-side fetch with a 20 s timeout, cached by 250 m cell. A null result is not an error: show "No soil map data here, enter a soil test" and ask for texture and pH. |
| 5 | Earthdata credentials | **Not available** (`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD` unset, no `.env`). | Someone with an Earthdata account must provide them before SMAP, MODIS and IMERG can be verified live. |

## Also confirmed

- **NASA POWER daily point (AG community)** returns all ten planned parameters without a key: `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `WS2M`, `GWETTOP`, `GWETROOT`, `GWETPROF`. Fill value is `-999`. The full 1981–2024 record for 5 parameters is 1.3 MB and took 2.6 s.
- **POWER climatology** returns monthly normals (`JAN`…`DEC`, plus an annual value).
- **Photon (OpenStreetMap) geocoder** responds in about 1 s and returns an `extent` for regions.

## Consequences for the plan

- F3 and F7 rainfall evidence uses POWER until IMERG access exists. Everything the UI says about "satellite rainfall" must name POWER.
- SMAP and MODIS overlays are optional layers that appear only when the AppEEARS job has returned; the comparison works without them and says so under uncertainty.
- Test fixtures for Magway (Myanmar) and Nakuru (Kenya) still need recording; only Ames is saved so far.
