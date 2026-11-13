import { describe, it, expect } from "vitest";
import {
  baseDefaults as defaults,
  validateBase,
  SOL_SECONDS,
  decodeBase,
  encodeBase,
} from "../src/base/config";
import { BaseSimulation, sunlight, doseBetween } from "../src/base/model";
function make(patch: Partial<typeof defaults> = {}) {
  const s = new BaseSimulation({ ...defaults, ...patch });
  s.start();
  return s;
}
describe("seven-sol engineering model", () => {
  it("validates and round-trips versioned physical settings without accepting normalized legacy settings", () => {
    expect(decodeBase(encodeBase(defaults))).toEqual(defaults);
    expect(() => decodeBase('{"version":1}')).toThrow();
    for (const p of [
      { cleanSeconds: 0 },
      { area: NaN },
      { initialOxygen: 100 },
      { initialDust: 0.1 },
      { doseLimitMGy: 0 },
    ])
      expect(() => validateBase({ ...defaults, ...p })).toThrow();
  });
  it("tracks east-to-west with night output zero and tilt limits respected", () => {
    const morning = sunlight(0, { ...defaults, startHour: 8 }),
      evening = sunlight(0, { ...defaults, startHour: 16 });
    expect(morning.normal.x).toBeGreaterThan(0);
    expect(evening.normal.x).toBeLessThan(0);
    expect(sunlight(0, { ...defaults, startHour: 0 }).irradiance).toBe(0);
    expect(morning.incidence).toBeGreaterThan(
      sunlight(0, { ...defaults, startHour: 8, tracking: false, fixedTilt: 0 })
        .incidence,
    );
    const capped = sunlight(0, { ...defaults, startHour: 6, maxTilt: 30 });
    expect(capped.normal.y).toBeCloseTo(Math.cos(Math.PI / 6));
  });
  it("conserves energy, including efficiencies and curtailment", () => {
    const s = make({ eventDoseMGy: 0, doseLimitMGy: 100 });
    s.advance(SOL_SECONDS);
    const expected =
      defaults.batteryCapacity * defaults.initialCharge +
      s.producedWh -
      s.loadWh -
      s.curtailedWh -
      s.chargeLossWh -
      s.dischargeLossWh;
    expect(s.battery).toBeCloseTo(expected, 5);
    expect(s.battery).toBeLessThanOrEqual(defaults.batteryCapacity);
  });
  it("charges during sun, discharges at night and automatically sheds generator without erasing reserves", () => {
    const s = make({ startHour: 12, initialCharge: 0.5 });
    s.advance(3600);
    expect(s.battery).toBeGreaterThan(defaults.batteryCapacity * 0.5);
    const n = make({ startHour: 0 });
    n.advance(3600);
    expect(n.battery).toBeLessThan(defaults.batteryCapacity * 0.8);
    const empty = make({ startHour: 0, initialCharge: 0 });
    empty.advance(60);
    expect(empty.state).toBe("running");
    expect(empty.generatorPowered).toBe(false);
    expect(empty.unservedWh).toBeGreaterThan(0);
  });
  it("normalizes outdoor reconstructed event TOTAL without double-counting background", () => {
    const a = defaults.eventSol * SOL_SECONDS;
    expect(
      doseBetween(a, a + defaults.eventHours * 3600, defaults, false),
    ).toBeCloseTo(8.1);
    expect(
      doseBetween(a, a + defaults.eventHours * 3600, defaults, true),
    ).toBeLessThan(2);
  });
  it("fails immediately at dose maximum and freezes thereafter", () => {
    const s = make({ eventSol: 0, doseLimitMGy: 0.1 });
    s.advance(36000);
    expect(s.state).toBe("lost");
    expect(s.reason).toContain("dose");
    expect(s.dose).toBeCloseTo(0.1);
    const t = s.elapsed;
    s.advance(1000);
    expect(s.elapsed).toBe(t);
  });
  it("holds clean in real time, cancels on release/pause and restores only on completion", () => {
    const s = make();
    s.clean(2, true);
    expect(s.dust).toBe(0.9);
    s.clean(0, false);
    expect(s.cleanProgress).toBe(0);
    s.clean(4, true);
    expect(s.dust).toBe(1);
    expect(s.cleanCount).toBe(1);
    s.clean(10, true);
    expect(s.cleanCount).toBe(1);
    s.clean(0, false);
    s.clean(2, true);
    s.pause();
    expect(s.cleanProgress).toBe(0);
    const t = s.elapsed;
    s.advance(10000);
    expect(s.elapsed).toBe(t);
  });
  it("checks shelter geometry, including altitude, while passive shielding works without power", () => {
    const s = make({ initialCharge: 0 });
    expect(s.isSheltered({ x: 6, y: 0, z: 5 })).toBe(true);
    expect(s.isSheltered({ x: 6, y: 5, z: 5 })).toBe(false);
    s.advance(60, true);
    expect(s.dose).toBeCloseTo(
      ((defaults.baselineMGyPerDay * 60) / 86400) *
        defaults.baselineTransmission,
    );
  });
  it("is survivable for seven sols with cleaning and shelter, without exceeding the physical dose limit", () => {
    const s = make();
    for (let i = 0; i < 7 * 24 * 4 && s.state === "running"; i++) {
      s.advance(SOL_SECONDS / 96, true);
      if (i % 96 === 0) s.clean(4, true);
    }
    expect({
      state: s.state,
      reason: s.reason,
      oxygen: s.oxygen,
      energy: s.battery,
      dose: s.dose,
    }).toMatchObject({ state: "completed", reason: "" });
    expect(s.dose).toBeLessThan(defaults.doseLimitMGy);
  });
  it("preserves outcomes across different frame schedules", () => {
    const a = make(),
      b = make();
    for (let i = 0; i < 3600; i++) a.advance(1);
    for (let i = 0; i < 120; i++) b.advance(30);
    expect(a.dose).toBeCloseTo(b.dose, 8);
    expect(a.oxygen).toBeCloseTo(b.oxygen, 8);
    expect(Math.abs(a.battery - b.battery)).toBeLessThan(1);
  });
  it("loses on oxygen depletion at the boundary", () => {
    const s = make({ initialOxygen: 0.001 });
    s.generator = false;
    s.advance(10000);
    expect(s.state).toBe("lost");
    expect(s.elapsed).toBeCloseTo((0.001 / defaults.oxygenConsumption) * 3600);
  });
});
