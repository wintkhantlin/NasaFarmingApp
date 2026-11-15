#!/usr/bin/env python3
"""
Microsoft Planetary Computer Satellite Data Ingestion Script.

Demonstrates the PySTAC client, Planetary Computer SDK, and Rasterio/Window
pixel extraction workflow for Myanmar agricultural fields.

Usage:
    python3 scripts/mpc_ingest.py --bbox 95.0 20.0 95.2 20.2 --start 2023-01-01 --end 2023-03-31
"""

import argparse
import json
import sys
from typing import Any, Dict, List, Optional

try:
    import pystac_client
    import planetary_computer as pc
    import rasterio
    from rasterio.windows import from_bounds
    import numpy as np
    DEPS_AVAILABLE = True
except ImportError:
    DEPS_AVAILABLE = False


def parse_args():
    parser = argparse.ArgumentParser(description="MPC Landsat & MODIS Ingestion")
    parser.add_argument("--bbox", nargs=4, type=float, default=[95.0, 20.0, 95.2, 20.2],
                        help="Bounding box in WGS84: min_lon min_lat max_lon max_lat")
    parser.add_argument("--start", type=str, default="2023-01-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, default="2023-03-31", help="End date (YYYY-MM-DD)")
    parser.add_argument("--collection", type=str, default="landsat-c2-l2",
                        choices=["landsat-c2-l2", "modis-13Q1-061"], help="STAC collection ID")
    parser.add_argument("--max-cloud", type=int, default=40, help="Maximum cloud cover percentage")
    parser.add_argument("--out", type=str, default="", help="Output JSON path (optional)")
    return parser.parse_args()


def decode_landsat_qa(qa_arr: np.ndarray) -> np.ndarray:
    """
    USGS Landsat Collection 2 QA_PIXEL mask.
    Bits:
      0: fill
      1: dilated cloud
      3: cloud
      4: cloud shadow
      5: snow
      7: water
    Returns boolean array of valid clear land pixels.
    """
    fill = (qa_arr & (1 << 0)) != 0
    dilated_cloud = (qa_arr & (1 << 1)) != 0
    cloud = (qa_arr & (1 << 3)) != 0
    shadow = (qa_arr & (1 << 4)) != 0
    snow = (qa_arr & (1 << 5)) != 0
    water = (qa_arr & (1 << 7)) != 0
    
    valid_land = ~fill & ~dilated_cloud & ~cloud & ~shadow & ~snow & ~water
    return valid_land


def process_landsat(item, bbox: List[float]) -> Optional[Dict[str, Any]]:
    """Extracts windowed red and nir rasters, applies QA mask, and calculates median NDVI."""
    signed_item = pc.sign(item)
    red_href = signed_item.assets["red"].href
    nir_href = signed_item.assets["nir08"].href
    qa_href = signed_item.assets["qa_pixel"].href

    minx, miny, maxx, maxy = bbox

    with rasterio.open(qa_href) as src_qa:
        win = from_bounds(minx, miny, maxx, maxy, src_qa.transform)
        qa = src_qa.read(1, window=win)

    with rasterio.open(red_href) as src_red:
        red_dn = src_red.read(1, window=win).astype(float)

    with rasterio.open(nir_href) as src_nir:
        nir_dn = src_nir.read(1, window=win).astype(float)

    valid_mask = decode_landsat_qa(qa)
    if not np.any(valid_mask):
        return None

    # USGS Collection 2 Level-2 Surface Reflectance scaling
    red = red_dn * 0.0000275 - 0.2
    nir = nir_dn * 0.0000275 - 0.2

    # Clamp physically valid range
    red[red < 0] = 0
    nir[nir < 0] = 0

    denom = nir + red
    valid_calc = valid_mask & (denom > 0)
    if not np.any(valid_calc):
        return None

    ndvi_arr = (nir - red) / denom
    valid_ndvi = ndvi_arr[valid_calc]

    date = item.properties.get("datetime", "")[:10]
    return {
        "id": item.id,
        "date": date,
        "ndvi_median": round(float(np.median(valid_ndvi)), 3),
        "valid_pixels": int(np.sum(valid_calc)),
        "total_pixels": int(qa.size),
        "cloud_cover": item.properties.get("eo:cloud_cover", 0),
    }


def main():
    args = parse_args()
    if not DEPS_AVAILABLE:
        print(json.dumps({
            "status": "notice",
            "message": "Python libraries pystac_client/planetary_computer/rasterio not installed.",
            "instructions": "Install via 'pip install pystac-client planetary-computer rasterio xarray' or use Green Ally Project's native TypeScript adapter in lib/nasa/planetary-computer.ts"
        }, indent=2))
        return

    catalog = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1")
    search = catalog.search(
        collections=[args.collection],
        bbox=args.bbox,
        datetime=f"{args.start}/{args.end}",
        query={"eo:cloud_cover": {"lt": args.max_cloud}},
        max_items=30
    )
    items = list(search.items())
    print(f"Found {len(items)} {args.collection} scenes over bbox {args.bbox}", file=sys.stderr)

    results = []
    if args.collection == "landsat-c2-l2":
        for item in items:
            try:
                obs = process_landsat(item, args.bbox)
                if obs:
                    results.append(obs)
            except Exception as e:
                print(f"Error processing scene {item.id}: {e}", file=sys.stderr)

    out_data = {
        "collection": args.collection,
        "bbox": args.bbox,
        "observations": results,
    }
    out_json = json.dumps(out_data, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(out_json)
        print(f"Saved results to {args.out}", file=sys.stderr)
    else:
        print(out_json)


if __name__ == "__main__":
    main()
