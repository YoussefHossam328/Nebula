# Uploaded SolarPanel.glb inspection

Original uploaded asset: 72,056 bytes. SHA-256: `4e28df167f9979bed8ef82861c0c685c05d65529f50032066eadf39dbadfac6f`.

- Nodes: `SolarBase`, containing child `Panel`.
- Base rotation: Y-axis; panel tilt: X-axis, with receiving normal along local +Y.
- Materials array contains **one** entry: `Solar panel clean`.
- That material uses texture index 0, referencing the **one** embedded image: `Solar panel dirty`.
- Both mesh primitives reference material index 0.
- No KHR_materials_variants extension or animation clips are present.
- PNG inspection: one 1024×1024 frame; no second PNG signature in the GLB.

The GLB can be tracked correctly, but it does not supply two switchable material definitions. Blender may retain an unused clean/dirty material that was omitted from export, or the image assignment may differ from the intended setup. The original upload is preserved unchanged under `art-source/solar/SolarPanel-original.glb`; the runtime file under `public/models/` is rebuilt with the clean attachment as described below.

For the next export, provide two distinct exported material definitions named `Solar panel clean` and `Solar panel dirty`, both included in the file (for example through correctly exported material variants). Alternatively, supply separate clean/dirty GLBs with identical pivots. The runtime adapter automatically recognizes both material names when available. Until then, it preserves the exported texture and reports the missing variant; it does not claim to have recovered the absent clean texture.

The prototype scales the 3.212 m authored hinge height to its existing 1.8 m mast location. This visual model represents the aggregate array; its visible area does not replace the scenario's independently configured effective collecting area.

## Resolved with the clean atlas attachment

The later `Solar_panel_clean.rar` contains a 1024×1024 lossless WebP image named `.png`. It was re-encoded to PNG without changing any decoded RGBA pixels (verified SHA-256 of pixels: `dd2571588d106b13dd67ae1f37018d1275466ec35ea97c9b564576b3001a9a32`). Original source WebP, compatible PNG, and original one-material GLB are retained under `art-source/solar/`.

The rebuilt `public/models/SolarPanel.glb` is 88,052 bytes and contains both `Solar panel dirty` and `Solar panel clean` materials, two embedded images, and standard KHR_materials_variants mappings named Dirty/Clean. Geometry, UV accessors, node transforms and pivots are unchanged. The runtime explicitly switches the named materials; it does not depend on a viewer’s variant UI. No artwork was generated or repainted.
