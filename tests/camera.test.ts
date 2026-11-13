import { it, expect } from "vitest";
import * as THREE from "three";
import { FollowCamera } from "../src/camera";
import { defaults, decode } from "../src/config";
it("migrates older settings without losing movement values", () => {
  const old = { ...defaults, walk: 3 };
  for (const k of [
    "followDelay",
    "shakeEnabled",
    "shakeStrength",
    "shakeFrequency",
    "shakeDuration",
  ])
    delete (old as Record<string, unknown>)[k];
  expect(decode(JSON.stringify({ version: 1, settings: old }))).toMatchObject({
    walk: 3,
    followDelay: 0.12,
    shakeEnabled: false,
  });
});
it("delays response and resets history after teleport", () => {
  const camera = new THREE.PerspectiveCamera();
  const f = new FollowCamera(camera);
  f.update(new THREE.Vector3(), 1 / 60, 0, defaults);
  const start = camera.position.clone();
  f.update(new THREE.Vector3(1, 0, 0), 1 / 60, 0.05, defaults);
  expect(camera.position.distanceTo(start)).toBeLessThan(1e-8);
  f.update(new THREE.Vector3(1, 0, 0), 1 / 60, 0.2, defaults);
  expect(camera.position.x).toBeGreaterThan(start.x);
  f.reset();
  f.update(new THREE.Vector3(10, 0, 0), 1 / 60, 1, defaults);
  expect(camera.position.x - start.x).toBeCloseTo(10);
});
it("keeps shake off when disabled", () => {
  const c = new THREE.PerspectiveCamera();
  const f = new FollowCamera(c);
  f.update(new THREE.Vector3(), 0, 0, defaults);
  const p = c.position.clone();
  f.shake(defaults);
  f.update(new THREE.Vector3(), 0.01, 0.01, defaults);
  expect(c.position.distanceTo(p)).toBeLessThan(1e-8);
});
