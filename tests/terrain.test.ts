import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d";
import { createTerrain, gameHeights, PAD_RADIUS, type SiteMeta } from "../src/terrain";

const meta = JSON.parse(
  readFileSync("public/terrain/site.json", "utf8"),
) as SiteMeta;
const dm = new Uint16Array(readFileSync("public/terrain/heights.bin").buffer.slice(0));
const zero = meta.elevation - meta.heights.offset;
const relief = Float32Array.from(dm, (v) => v / 10 - zero);

test("baked site is real Jezero-region data with a level pad for the base", () => {
  expect(meta.size * meta.size).toBe(dm.length);
  expect(meta.lat).toBeGreaterThan(18);
  expect(meta.lat).toBeLessThan(19);
  expect(meta.lon).toBeGreaterThan(77);
  expect(meta.lon).toBeLessThan(78);
  expect(meta.source.dem).toContain("mars2020_trn");
  const g = gameHeights({ meta, relief });
  const c = (meta.size - 1) / 2;
  expect(g.heights[c * meta.size + c]).toBe(0);
  // Real relief survives outside the pad: crater wall rises > 10 game m.
  expect(Math.max(...g.heights)).toBeGreaterThan(10);
});

test("physics collider matches the rendered heights (orientation and scale)", () => {
  const world = new RAPIER.World({ x: 0, y: -3.71, z: 0 });
  const scene = new THREE.Scene();
  const t = createTerrain(scene, world, { meta, relief });
  world.step();
  let checked = 0;
  for (const [x, z] of [
    [60, -40],
    [-70, 30],
    [90, 85],
    [-110, -100],
    [40, 120],
    [PAD_RADIUS - 2, 0],
  ]) {
    const ray = new RAPIER.Ray({ x, y: 200, z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, 400, true);
    expect(hit).not.toBeNull();
    const y = 200 - hit!.timeOfImpact;
    // Bilinear vs triangle interpolation differ slightly on slopes.
    expect(Math.abs(y - t.heightAt(x, z))).toBeLessThan(0.6);
    checked++;
  }
  expect(checked).toBe(6);
});
