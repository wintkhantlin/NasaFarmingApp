# Myanmar Townships Administrative Boundary Source

`geoboundaries-330-townships.json` contains 330 township administrative boundaries for Myanmar from geoBoundaries gbOpen ADM3 (Boundary ID: `MMR-ADM3-66882298`, build date Dec 12, 2023).

## Provenance and License

- **Provider**: geoBoundaries, William & Mary geoLab (wmgeolab)
- **Upstream Source**: The Myanmar Analytics Project, USAID/Burma (data.mmanalytics.org)
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0)
  - You are free to share, copy, redistribute, adapt, and build upon the material for any purpose, even commercially, with attribution.
- **Reference API**: https://www.geoboundaries.org/api/current/gbOpen/MMR/ADM3/
- **Represented Year**: 2019

## Administrative Hierarchy & Identifier Attribution

- **State / Region (ADM1)**: 14 states and regions joined from gbOpen ADM1 (`Ayeyarwady`, `Bago`, `Chin`, `Kachin`, `Kayah`, `Kayin`, `Magway`, `Mandalay`, `Mon`, `Rakhine`, `Sagaing`, `Shan`, `Tanintharyi`, `Yangon`).
- **District (ADM2)**: 74 districts joined from gbOpen ADM2.
- **Township (ADM3)**: 330 townships from gbOpen ADM3.
- **PCode Mapping Status**: Marked as **unavailable**. Upstream geoBoundaries features do not provide official GAD/MIMU PCodes; source-specific identifiers (`GB-MMR-{shapeID}`) are assigned without fabricating administrative codes.
- **Myanmar Unicode Names**: Unavailable in the upstream gbOpen release. Display defaults cleanly to Romanized township names.

## Usage in Green Ally Project

- Supplies geographic context and camera zoom in the farmer location picker.
- Does not replace farm-level parcel boundaries: farmers draw and confirm their own field boxes or polygons.
- Does not alter NASA environmental analysis coordinates, crop suitability formulas, or satellite resolution rules.
