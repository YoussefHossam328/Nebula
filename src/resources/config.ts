import type { Scenario } from "../data/types";
export function validateScenario(value: unknown): Scenario {
  if (!value || typeof value !== "object") throw Error("Invalid scenario");
  const s = value as Scenario;
  if (s.version !== 1 || typeof s.id !== "string" || typeof s.name !== "string")
    throw Error("Invalid scenario identity/version");
  for (const key of [
    "duration",
    "batteryCapacity",
    "oxygenCapacity",
    "battery",
    "oxygen",
    "backgroundDrain",
    "oxygenConsumption",
    "generatorDrain",
    "oxygenProduction",
    "warning",
    "critical",
  ] as const) {
    if (typeof s[key] !== "number" || !Number.isFinite(s[key]) || s[key] < 0)
      throw Error(`Invalid ${key}`);
  }
  if (
    s.duration <= 0 ||
    s.batteryCapacity <= 0 ||
    s.oxygenCapacity <= 0 ||
    s.battery > s.batteryCapacity ||
    s.oxygen > s.oxygenCapacity ||
    s.critical >= s.warning ||
    s.warning > 100
  )
    throw Error("Invalid capacities, reserves, duration or thresholds");
  return { ...s };
}
export function encodeScenario(s: Scenario) {
  return JSON.stringify({ version: 1, scenario: s }, null, 2);
}
export function decodeScenario(text: string) {
  const d = JSON.parse(text);
  if (d.version !== 1) throw Error("Unsupported resource settings");
  return validateScenario(d.scenario);
}
