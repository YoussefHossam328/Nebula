import { it, expect } from "vitest";
import fixture from "../src/data/scenario.json";
import { Simulation } from "../src/resources/simulation";
import {
  validateScenario,
  encodeScenario,
  decodeScenario,
} from "../src/resources/config";
import { mockProvider } from "../src/data/mock-provider";
const make = () => {
  const sim = new Simulation(validateScenario(fixture));
  sim.start();
  return sim;
};
it("labels offline fixture honestly and validates settings", async () => {
  const d = await mockProvider.load();
  expect(d.source.kind).toBe("simulated");
  expect(d.source.observedAt).toBeNull();
  expect(decodeScenario(encodeScenario(d.scenario))).toEqual(d.scenario);
  for (const patch of [
    { duration: 0 },
    { battery: 101 },
    { oxygenConsumption: NaN },
    { critical: 30 },
    { generatorDrain: -1 },
  ])
    expect(() => validateScenario({ ...fixture, ...patch })).toThrow();
});
it("always off and always on end at the first depletion", () => {
  const off = make();
  off.advance(120);
  expect(off.state).toBe("needs-retry");
  expect(off.elapsed).toBeCloseTo(35 / 0.6);
  const on = make();
  on.toggle();
  on.advance(120);
  expect(on.elapsed).toBeCloseTo(70 / 1.3);
  expect(on.state).toBe("needs-retry");
});
it("40 on then 80 off succeeds", () => {
  const s = make();
  s.toggle();
  s.advance(40);
  s.toggle();
  s.advance(80);
  expect(s.battery).toBeCloseTo(10);
  expect(s.oxygen).toBeCloseTo(11);
  expect(s.state).toBe("completed");
});
it("is frame independent and pause consumes nothing", () => {
  for (const fps of [30, 60, 120]) {
    const s = make();
    s.toggle();
    for (let i = 0; i < 40 * fps; i++) s.advance(1 / fps);
    s.toggle();
    s.pause();
    const oxygen = s.oxygen;
    s.advance(100);
    expect(s.oxygen).toBe(oxygen);
    s.resume();
    for (let i = 0; i < 80 * fps; i++) s.advance(1 / fps);
    expect(s.battery).toBeCloseTo(10);
    expect(s.oxygen).toBeCloseTo(11);
    expect(s.state).toBe("completed");
  }
});
it("full tank wastes power and exact end depletion is a retry", () => {
  const s = new Simulation(validateScenario({ ...fixture, oxygen: 100 }));
  s.start();
  s.toggle();
  s.advance(1);
  expect(s.oxygen).toBe(100);
  expect(s.battery).toBeCloseTo(68.7);
  const z = new Simulation(
    validateScenario({ ...fixture, duration: 10, oxygen: 6 }),
  );
  z.start();
  z.advance(10);
  expect(z.state).toBe("needs-retry");
});
