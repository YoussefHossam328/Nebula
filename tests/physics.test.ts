import { beforeAll, describe, it, expect } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { Character, DT } from "../src/physics";
import { defaults, decode, encode, validate } from "../src/config";
beforeAll(async () => {
  await RAPIER.init();
});
function setup() {
  const w = new RAPIER.World({ x: 0, y: 0, z: 0 });
  w.createCollider(
    RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0),
  );
  const c = new Character(w, defaults);
  const tick = (
    n: number,
    axis = { x: 0, z: 0 },
    jump = false,
    crouch = false,
  ) => {
    for (let i = 0; i < n; i++) c.tick(defaults, axis, false, crouch, jump);
  };
  tick(120);
  return { w, c, tick };
}
describe("settings", () => {
  it("round-trips and rejects malformed, nonfinite and incompatible values", () => {
    expect(decode(encode(defaults))).toEqual(defaults);
    expect(() => decode('{"version":2}')).toThrow();
    expect(() => validate({ ...defaults, gravity: NaN })).toThrow();
    expect(() =>
      validate({ ...defaults, crouching: 0.6, radius: 0.5 }),
    ).toThrow();
  });
});
describe("Rapier character", () => {
  it("lands, moves at configured speed, stops, and resets", () => {
    const { w, c, tick } = setup();
    expect(c.grounded).toBe(true);
    const start = c.body.translation();
    tick(120, { x: 1, z: 0 });
    expect(c.body.translation().x - start.x).toBeGreaterThan(4);
    expect(c.body.translation().x - start.x).toBeLessThan(5.1);
    tick(60);
    expect(c.vx).toBe(0);
    c.reset();
    expect(c.body.translation().x).toBe(0);
    w.free();
  });
  it("uses the configured jump rise and cannot jump in midair", () => {
    const { w, c, tick } = setup();
    const y = c.body.translation().y;
    tick(1, { x: 0, z: 0 }, true);
    const initial = c.vy;
    tick(1, { x: 0, z: 0 }, true);
    expect(c.vy).toBeLessThan(initial);
    let peak = 0;
    for (let i = 0; i < 140; i++) {
      tick(1);
      peak = Math.max(peak, c.body.translation().y - y);
    }
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.3);
    expect(c.grounded).toBe(true);
    w.free();
  });
  it("blocks standing under a ceiling and restores height after it is removed", () => {
    const { w, c, tick } = setup();
    tick(1, { x: 0, z: 0 }, false, true);
    expect(c.crouched).toBe(true);
    const ceiling = w.createCollider(
      RAPIER.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(0, 1.25, 0),
    );
    w.step();
    tick(2);
    expect(c.crouched).toBe(true);
    w.removeCollider(ceiling, true);
    tick(2);
    expect(c.crouched).toBe(false);
    w.free();
  });
  it("blocks walls and resets after falling out of bounds", () => {
    const { w, c, tick } = setup();
    w.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 3, 5).setTranslation(2, 2, 0),
    );
    w.step();
    tick(180, { x: 1, z: 0 });
    expect(c.body.translation().x).toBeLessThan(1.6);
    c.body.setTranslation({ x: 0, y: -20, z: 0 }, true);
    tick(1);
    expect(c.body.translation().y).toBeGreaterThan(0);
    w.free();
  });
});
it("climbs a permitted step but not a tall obstacle", () => {
  for (const [height, shouldClimb] of [
    [0.2, true],
    [0.8, false],
  ] as const) {
    const { w, c, tick } = setup();
    w.createCollider(
      RAPIER.ColliderDesc.cuboid(2, height / 2, 2).setTranslation(
        3,
        height / 2,
        0,
      ),
    );
    w.step();
    tick(120, { x: 1, z: 0 });
    expect(c.body.translation().x > 2).toBe(shouldClimb);
    if (shouldClimb)
      expect(c.body.translation().y).toBeGreaterThan(
        defaults.standing / 2 + height - 0.05,
      );
    w.free();
  }
});
it("climbs a shallow ramp and rejects a steep ramp", () => {
  for (const degrees of [20, 65]) {
    const { w, c, tick } = setup();
    const a = (degrees * Math.PI) / 180;
    w.createCollider(
      RAPIER.ColliderDesc.cuboid(3, 0.15, 2)
        .setTranslation(3, 3 * Math.sin(a), 0)
        .setRotation({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) }),
    );
    w.step();
    tick(180, { x: 1, z: 0 });
    if (degrees === 20) expect(c.body.translation().y).toBeGreaterThan(1.2);
    else expect(c.body.translation().y).toBeLessThan(1.2);
    w.free();
  }
});
it("retains input facing while asymmetric velocity components brake to zero", () => {
  const { w, c, tick } = setup();
  tick(60, { x: 0.6, z: 0.8 });
  const heading = Math.atan2(0.6, 0.8);
  expect(c.facingYaw).toBeCloseTo(heading);
  for (let i = 0; i < 60; i++) {
    tick(1);
    expect(c.facingYaw).toBeCloseTo(heading);
  }
  expect(c.vx).toBe(0);
  expect(c.vz).toBe(0);
  tick(1, { x: -1, z: 0 });
  expect(c.facingYaw).toBeCloseTo(-Math.PI / 2);
  w.free();
});
