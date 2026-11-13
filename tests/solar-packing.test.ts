import { it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
it("embeds two atlas slots and standard variants without changing source geometry or UV data", () => {
  const dir = mkdtempSync(join(tmpdir(), "nebula-solar-"));
  try {
    const original = readFileSync("art-source/solar/SolarPanel-original.glb");
    const n = original.readUInt32LE(12);
    const doc = JSON.parse(original.subarray(20, 20 + n).toString());
    const binStart = 20 + n + 8;
    const view = doc.bufferViews[doc.images[0].bufferView];
    const image = original.subarray(
      binStart + (view.byteOffset ?? 0),
      binStart + (view.byteOffset ?? 0) + view.byteLength,
    );
    const clean = join(dir, "atlas-fixture.png"),
      out = join(dir, "packed.glb");
    // Reusing the atlas bytes tests container packing only; this fixture is never shipped as clean art.
    writeFileSync(clean, image);
    execFileSync("python3", [
      "scripts/pack-solar-materials.py",
      "--source",
      "art-source/solar/SolarPanel-original.glb",
      "--clean",
      clean,
      "--output",
      out,
    ]);
    const packed = readFileSync(out);
    const m = packed.readUInt32LE(12);
    const result = JSON.parse(packed.subarray(20, 20 + m).toString());
    expect(packed.readUInt32LE(8)).toBe(packed.length);
    expect(result.materials.map((x: { name: string }) => x.name)).toEqual([
      "Solar panel dirty",
      "Solar panel clean",
    ]);
    expect(result.images).toHaveLength(2);
    expect(result.extensions.KHR_materials_variants.variants).toHaveLength(2);
    expect(result.nodes).toEqual(doc.nodes);
    expect(result.accessors).toEqual(doc.accessors);
    const originalBin = original.subarray(binStart);
    const packedBin = packed.subarray(20 + m + 8);
    expect(packedBin.subarray(0, originalBin.length).equals(originalBin)).toBe(
      true,
    );
    expect(
      readFileSync("art-source/solar/SolarPanel-original.glb").equals(original),
    ).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it("runtime GLB contains the supplied clean PNG unchanged and retains original UV accessors and pivots", () => {
  function parse(path: string) {
    const bytes = readFileSync(path);
    const n = bytes.readUInt32LE(12);
    return {
      doc: JSON.parse(bytes.subarray(20, 20 + n).toString()),
      bin: bytes.subarray(20 + n + 8),
    };
  }
  const source = parse("art-source/solar/SolarPanel-original.glb");
  const packed = parse("public/models/SolarPanel.glb");
  expect(packed.doc.nodes).toEqual(source.doc.nodes);
  expect(packed.doc.accessors).toEqual(source.doc.accessors);
  const image = packed.doc.images.find(
    (i: { name: string }) => i.name === "Solar panel clean",
  );
  const view = packed.doc.bufferViews[image.bufferView];
  expect(
    packed.bin
      .subarray(view.byteOffset, view.byteOffset + view.byteLength)
      .equals(readFileSync("art-source/solar/Solar-panel-clean.png")),
  ).toBe(true);
});
