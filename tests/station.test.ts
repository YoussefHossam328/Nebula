import { it, expect } from "vitest";
import { insideHabitat } from "../src/station";
import { generalHelp, baseHelp, legacyHelp } from "../src/setting-help";
import { defaults, decode } from "../src/config";
import { baseDefaults } from "../src/base/config";
import fixture from "../src/data/scenario.json";
it("habitat trigger distinguishes interior, doorway, outdoors and above roof", () => {
  expect(insideHabitat({ x: 0, y: 0, z: -3 })).toBe(true);
  expect(insideHabitat({ x: 0, y: 0, z: 0 })).toBe(false);
  expect(insideHabitat({ x: 0, y: 4, z: -3 })).toBe(false);
  expect(insideHabitat({ x: 5, y: 0, z: -3 })).toBe(false);
});
it("every numeric/boolean developer value has a meaningful description", () => {
  for (const k of Object.keys(defaults))
    expect(generalHelp[k as keyof typeof defaults]?.length).toBeGreaterThan(15);
  for (const k of Object.keys(baseDefaults).filter((k) => k !== "version"))
    expect((baseHelp as Record<string, string>)[k]?.length).toBeGreaterThan(15);
  for (const k of Object.keys(fixture).filter(
    (k) =>
      typeof (fixture as Record<string, unknown>)[k] === "number" &&
      k !== "version",
  ))
    expect(legacyHelp[k]?.length).toBeGreaterThan(15);
});
it("migrates saved settings from before station-view controls", () => {
  const old = { ...defaults };
  delete (old as Record<string, unknown>).stationRoof;
  delete (old as Record<string, unknown>).stationCutaway;
  expect(decode(JSON.stringify({ version: 1, settings: old }))).toMatchObject({
    stationRoof: true,
    stationCutaway: true,
  });
});
