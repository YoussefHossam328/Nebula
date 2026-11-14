#!/usr/bin/env python3
"""
Bake the Nebula base site from real Mars 2020 terrain data.

Source (NASA Mars 2020 Terrain Relative Navigation products, hosted by USGS
Astrogeology on the PDS imaging node bucket):
  DEM   : JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
          (CTX stereo DTM, 20 m/px, controlled to MOLA, Mars 2020 delta geoid)
  Ortho : JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif (CTX, 6 m/px)
Both are read in-place over HTTP range requests; only the site window is
downloaded.

Output (public/terrain/):
  site.json    metadata (location, scale, provenance, encoding)
  heights.bin  (N x N) little-endian uint16, real metres above the window
               minimum in decimetres; row 0 = north edge, col 0 = west edge
  ortho.jpg    matching CTX orthophoto, north up

Requires: pip install rasterio numpy pillow
Usage:    python3 scripts/bake-terrain.py [--row 382 --col 262 --half 120]
"""
import argparse, json, math, os
import numpy as np
import rasterio
from rasterio.windows import Window, from_bounds
from rasterio.enums import Resampling
from PIL import Image

BASE = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/"
DEM = BASE + "JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif"
ORTHO = BASE + "JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif"
MARS_RADIUS = 3396190.0  # IAU sphere used by the products' equirectangular CRS

ap = argparse.ArgumentParser()
ap.add_argument("--row", type=int, default=382, help="DEM row of the base site")
ap.add_argument("--col", type=int, default=262, help="DEM column of the base site")
ap.add_argument("--half", type=int, default=120, help="half window in DEM pixels")
ap.add_argument("--compression", type=float, default=16.0,
                help="real metres per game metre (applied to all axes)")
ap.add_argument("--ortho-size", type=int, default=1024)
ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "public", "terrain"))
a = ap.parse_args()

os.makedirs(a.out, exist_ok=True)
with rasterio.open("/vsicurl/" + DEM) as d:
    n = 2 * a.half + 1
    win = Window(a.col - a.half, a.row - a.half, n, n)
    h = d.read(1, window=win).astype(np.float64)
    if (h < -1e30).any():
        raise SystemExit("window touches DEM nodata; pick another site")
    res = d.res[0]
    cx, cy = d.xy(a.row, a.col)
    left, top = d.xy(a.row - a.half, a.col - a.half)
    right, bottom = d.xy(a.row + a.half, a.col + a.half)

lo = h.min()
dm = np.round((h - lo) * 10).astype("<u2")
dm.tofile(os.path.join(a.out, "heights.bin"))

with rasterio.open("/vsicurl/" + ORTHO) as o:
    pad = res / 2
    w = from_bounds(left - pad, bottom - pad, right + pad, top + pad, o.transform)
    img = o.read(1, window=w, out_shape=(a.ortho_size, a.ortho_size),
                 resampling=Resampling.average).astype(np.float64)
v = img[img > 0]
p1, p99 = np.percentile(v, [1, 99])
img = np.clip((img - p1) / (p99 - p1), 0, 1)
Image.fromarray((img * 255).astype(np.uint8)).save(
    os.path.join(a.out, "ortho.jpg"), quality=84, optimize=True)

lat = math.degrees(cy / MARS_RADIUS)
lon = math.degrees(cx / MARS_RADIUS)
center = float(h[a.half, a.half])
meta = {
    "name": "Jezero Crater, western rim area",
    "lat": round(lat, 5),
    "lon": round(lon, 5),
    "elevation": round(center, 1),
    "elevationDatum": "Mars 2020 delta geoid (MOLA-controlled)",
    "size": n,
    "realSpacing": res,
    "realExtent": res * (n - 1),
    "compression": a.compression,
    "heights": {"file": "heights.bin", "type": "uint16le", "unit": "dm",
                "offset": round(lo, 2), "rowOrder": "north-to-south"},
    "ortho": {"file": "ortho.jpg", "orientation": "north-up"},
    "source": {
        "dem": DEM, "ortho": ORTHO,
        "credit": "NASA/JPL-Caltech/MSSS/USGS — Mars 2020 TRN CTX DTM and orthomosaic",
        "window": {"row": a.row, "col": a.col, "half": a.half},
    },
}
json.dump(meta, open(os.path.join(a.out, "site.json"), "w"), indent=2)
print(json.dumps({k: meta[k] for k in ("lat", "lon", "elevation", "size", "realExtent")}))
print("relief (m):", round(h.min() - center, 1), "to", round(h.max() - center, 1))
