# Myanmar Study Area Administrative Boundary Research

Research date: 14 November 2026 (Asia/Rangoon). Project: NasaFarmingApp.

Ownership: Geospatial Mapping & Visualization within the independent geospatial-farmer workspace.

Status: Source assessment and validation plan only. No GIS resources have been downloaded, inspected, or validated. No dataset has been selected for production.

## 1. Research Objective

Identify suitable administrative boundaries for Ayeyarwady Region, Magway Region, Mandalay Region, Shan State, and Bago Region. Boundaries will provide consistent study-area selection, geographic context, township filtering, and reporting units for future agricultural and satellite analysis.

Selection requires documented provenance, appropriate administrative coverage, usable licensing, stable identifiers, bilingual names, compatible geometry, and an explicit treatment of sub-regions. Administrative boundaries describe governance or reporting units; they cannot establish the location or extent of an individual farm.

## 2. Study Area Inventory

| Study area | Area type | Required administrative boundary | Intended mapping purpose | Validation status |
| --- | --- | --- | --- | --- |
| Ayeyarwady | Region | Region polygon; associated township polygons; village tracts if needed | Area selection, township filtering, regional summaries | Pending resource inspection |
| Magway | Region | Region polygon; associated township polygons; village tracts if needed | Area selection, township filtering, regional summaries | Pending resource inspection |
| Mandalay | Region | Region polygon; associated township polygons; village tracts if needed | Area selection, township filtering, regional summaries | Pending resource inspection |
| Shan | State | State polygon and explicit sub-region representation; associated townships; village tracts if needed | State/sub-region selection and summaries without double counting | Pending hierarchy and resource inspection |
| Bago | Region | Region polygon and explicit sub-region representation; associated townships; village tracts if needed | Region/sub-region selection and summaries without double counting | Pending hierarchy and resource inspection |

No township counts, geographic codes, coordinates, or area measurements are established here.

## 3. Administrative Boundary Levels

- **National boundary:** Country-level geographic context and coverage checks.
- **State/Region boundary:** Main selection and reporting unit for the five study areas.
- **Township boundary:** Finer administrative filtering and aggregation, linked to the correct parent area.
- **Village Tract boundary:** Local administrative context where coverage and hierarchy are verified. Availability must not be assumed for every locality.
- **Farm boundary:** A specific field or agricultural holding, supplied or confirmed independently by a farmer or suitable parcel source. It is not an administrative level.

Do not assume that provider-specific ADM numbers correspond to identical administrative concepts. Confirm each layer's hierarchy and attributes before joining datasets. Districts, sub-regions, and other units may intervene; this list is not a complete asserted hierarchy.

## 4. Data Source Assessment

### Primary candidate: MIMU

| Property | Assessment |
| --- | --- |
| Publisher | Myanmar Information Management Unit (MIMU) |
| Dataset | Myanmar Administrative Boundary |
| Source | https://data.themimu.info/en/dataset/myanmar-administrative-boundary |
| Version | PCode version 9.4, according to supplied research metadata; verify each resource's release and boundary dates separately |
| Source lineage | Supplied research metadata states that General Administration Department (GAD) data is included |
| Names | Supplied research metadata describes Myanmar Unicode and Roman transliteration; actual fields and completeness remain uninspected |
| Scale | Primarily digitized at approximately 1:250,000, according to supplied research metadata; not a claim of positional accuracy |
| License/use terms | Supplied research states that MIMU products may be used free of charge with attribution; no specific license identifier is confirmed here |
| Attribution | Credit MIMU and retain required source acknowledgements; confirm exact wording, redistribution terms, and any resource-specific notices before use |
| Verification status | Catalogue access attempted on 14 November 2026; HTTP 403 prevented direct verification. The metadata above is supplied research context, not newly verified page content |

Known assessment limitations: the stated scale is unsuitable evidence for farm-level precision; boundary currency, topology, coastline detail, local coverage, and identifier stability remain unknown. PCode version must not be treated as the boundary observation date. Confirm the publisher's boundary disclaimer and handling of disputed or changing administrative representations.

### Secondary comparison candidate: geoBoundaries

| Property | Assessment |
| --- | --- |
| Provider | geoBoundaries, William & Mary geoLab and community contributors |
| Dataset/collection | Myanmar administrative layers from gbOpen, subject to availability and level confirmation |
| Website | https://www.geoboundaries.org/ |
| API documentation | https://www.geoboundaries.org/api.html |
| Version | No Myanmar release or boundary version selected; record a pinned release, boundary identifier, represented year, source update date, and build date during later assessment |
| Scale | No Myanmar-specific scale established; inspect source metadata and simplification before comparison |
| License | Official pages accessed on 14 November 2026 confirm gbOpen is CC BY 4.0; verify metadata accompanying the selected resource |
| Attribution | Attribute geoBoundaries, link to the provider and license, identify modifications, and retain applicable source credits. The provider requests a prominent website acknowledgement for web use |
| Verification status | General website and API documentation verified; no Myanmar API metadata or geometry inspected |

Use geoBoundaries for an independent comparison workflow, not an automatic replacement for MIMU. Check upstream lineage: two providers may distribute related source geometry and therefore may not constitute independent positional evidence. Differences may reflect dates, generalization, hierarchy, or source policy rather than errors. The gbOpen terms must not be generalized to gbHumanitarian or gbAuthoritative.

### Selection criteria

Prefer a candidate with documented authority and lineage, complete coverage of the five areas, clear parent-child relationships, stable identifiers, readable bilingual labels, valid geometry, reproducible versioning, and terms permitting the intended application use. Compare detail and file size against display needs. Preserve analytical geometry separately from any future display simplification, and record every transformation. Selection remains pending validation and team review.

## 5. Required Data Files

The following names are **candidate resources from supplied research**, not downloaded files or independently verified current catalogue listings:

| Candidate resource | Intended assessment |
| --- | --- |
| Myanmar State and Region Boundaries_MIMU_PCodev9.4 | Baseline study-area selection |
| Myanmar State and Region Boundaries with Sub-regions_MIMU_PCodev9.4 | Compare whole-area and sub-region representations |
| Myanmar Township Boundaries_MIMU_PCodev9.4 | Township filtering and parent joins |
| Ayeyarwady Region Village Tract Boundaries_MIMU_PCodev9.4 | Optional local administrative detail |
| Magway Region Village Tract Boundaries_MIMU_PCodev9.4 | Optional local administrative detail |
| Mandalay Region Village Tract Boundaries_MIMU_PCodev9.4 | Optional local administrative detail |
| Shan State Village Tract Boundaries_MIMU_PCodev9.4 | Optional local detail and hierarchy checks |
| Bago Region Village Tract Boundaries_MIMU_PCodev9.4 | Optional local detail and hierarchy checks |

Confirm exact resource names, identifiers, formats, availability, and dates before any future download. Village tract resources are optional for initial region selection; their listing does not authorize acquisition.

## 6. GIS Validation Checklist

All checks below are pending and require a separately authorized inspection stage.

- [ ] **CRS and projection:** Read declared CRS, datum, axis order, and units; compare with coordinates and metadata. Do not assign a CRS from appearance. Define an appropriate analysis CRS before area calculations and an explicit geographic interchange contract for the app.
- [ ] **Geometry type:** Record Polygon/MultiPolygon or other actual types, multipart units, islands, holes, and empty geometries; do not drop parts to fit the current farm geometry model.
- [ ] **Geometry validity:** Check ring closure, self-intersections, invalid holes, and empty/non-finite coordinates. Report issues before proposing repairs.
- [ ] **Feature count:** Record counts by resource, level, and study area; reconcile with publisher information without inventing expected totals.
- [ ] **PCode uniqueness:** Check missing and duplicate codes at the correct level and version, preserving leading zeros. Distinguish legitimate multipart representation from duplicate administrative records.
- [ ] **Myanmar Unicode and English names:** Inspect actual fields, encoding, Roman transliteration, missing labels, normalization, and display rendering; retain original values.
- [ ] **Missing attributes:** Check required identifiers, names, parent identifiers, and provenance; document nulls and unresolved joins.
- [ ] **Duplicate features:** Examine repeated identifiers, equivalent geometry, and duplicated records without automatic deletion.
- [ ] **Gaps and overlaps:** Check same-level topology and parent containment with a documented tolerance. Distinguish legitimate holes/water/disputed representations from defects.
- [ ] **Dataset version and date:** Separate PCode version, represented boundary date, publication/update date, and inspection date; record resource identifiers and future checksums.
- [ ] **License and attribution:** Retain applicable notices and confirm reuse, transformation, redistribution, and required credits.
- [ ] **Spatial coverage:** Confirm all five areas, relevant townships, islands, edge areas, and village tract coverage; compare with metadata and a second source.

Record findings, evidence, tolerances, and unresolved issues before accepting a dataset. No checklist item is completed by this document.

## 7. Special Geographic Considerations

### Shan State

Compare the standard State/Region resource with the resource containing sub-regions. Determine whether Shan is represented as a whole-state feature, multiple sub-region features, or both across resources. Verify exact names, identifiers, parent relationships, completeness, and whether parts overlap. Do not assert a sub-region count or label set before inspection.

### Bago Region

Perform the same comparison for Bago. Determine how the provider encodes any sub-regions and how they relate to whole-region and township features. Confirm that selection and aggregation use a single, explicit reporting level.

Do not silently dissolve, merge, remove, or rename sub-regions. Retain source distinctions and document any later approved derived geometry. Avoid adding whole-area totals to sub-region totals, which would double count coverage. A geocoder bounding box cannot resolve these hierarchy questions.

## 8. Intended Application Usage

- **Study area selection:** Select verified areas by stable identifiers and display confirmed names.
- **Township filtering:** Use verified parent relationships, with spatial checks where appropriate, rather than substring matching alone.
- **Spatial aggregation:** Define reporting level, metric, units, time interval, quality masking, and weighting. Avoid averaging categorical labels or treating differently sized pixels as equal-area observations without justification.
- **Regional map visualization:** Add administrative outlines and labels through the existing Mapbox stack, with source attribution and boundary dates.
- **Future satellite clipping and analysis:** Use validated polygons as areas of interest after defining CRS transformations, pixel inclusion rules, nodata treatment, and resolution limits. Clipping alone does not improve a sensor's spatial resolution.

Administrative polygons must never be presented as farm boundaries. They can contain many farms and non-agricultural areas. Preserve the existing farmer-confirmed field workflow, and reuse appropriate `lib/geo` utilities rather than building a parallel map engine. New administrative MultiPolygon handling may require a separate contract; do not force it into the existing Point/Polygon farm model.

## 9. Outstanding Questions

1. Can the MIMU catalogue and resource-specific terms be accessed and verified directly?
2. Are all eight candidate names and PCode v9.4 resources still available, and in which formats?
3. What boundary dates, revisions, source lineage, disclaimers, and attribution wording apply to each resource?
4. What CRS, geometry types, encoding, field names, parent keys, and code formats are actually supplied?
5. Are all five study areas and their relevant subordinate units covered completely, including islands and multipart features?
6. How are Shan and Bago sub-regions represented, and what reporting level should the application expose?
7. Are PCode values unique and consistent across levels and resources, or is a versioned crosswalk needed?
8. Are there topology defects, duplicates, missing names, or unexplained gaps and overlaps?
9. Which Myanmar gbOpen release and levels are suitable for comparison, and do they share MIMU lineage?
10. What differences between providers reflect dates, generalization, or administrative interpretation?
11. Which local reviewers can confirm labels, hierarchy, and appropriate farmer-facing presentation?
12. What analysis CRS, aggregation rules, boundary tolerances, and display simplification are appropriate after inspection?
13. Are village tract boundaries necessary for the initial scope, and are any redistribution restrictions resource-specific?

## 10. Sources

| Source | URL | Access date and result |
| --- | --- | --- |
| MIMU: Myanmar Administrative Boundary | https://data.themimu.info/en/dataset/myanmar-administrative-boundary | 14 November 2026; attempted access returned HTTP 403. MIMU details in this document remain supplied research metadata pending direct verification |
| geoBoundaries official website | https://www.geoboundaries.org/ | 14 November 2026; accessed for provider, licensing, and attribution guidance |
| geoBoundaries API documentation | https://www.geoboundaries.org/api.html | 14 November 2026; accessed for collection distinctions, administrative-level conventions, and available metadata fields |

The task's supplied research notes are the provenance for the candidate MIMU resource names, PCode version, scale, GAD lineage, bilingual description, and free-use-with-attribution statement. No source access here establishes downloaded-file properties or completed GIS validation.
