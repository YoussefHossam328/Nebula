export const SOL_SECONDS = 88775.244;
export const baseDefaults = {
  version: 2,
  sols: 7,
  realSecondsPerSol: 180,
  startHour: 6,
  area: 60,
  panelEfficiency: 0.22,
  peakIrradiance: 500,
  tracking: true,
  trackingPower: 10,
  maxTilt: 85,
  fixedTilt: 25,
  fixedAzimuth: 0,
  batteryCapacity: 24000,
  initialCharge: 0.8,
  chargeLimit: 6000,
  dischargeLimit: 6000,
  chargeEfficiency: 0.95,
  dischargeEfficiency: 0.95,
  baseLoad: 180,
  generatorLoad: 1500,
  oxygenCapacity: 4,
  initialOxygen: 2,
  oxygenConsumption: 0.035,
  oxygenProduction: 0.05,
  shelterLoad: 80,
  initialDust: 0.9,
  dustLossPerSol: 0.04,
  dustFloor: 0.3,
  cleanSeconds: 4,
  cleanRestore: 1,
  cleanVisualThreshold: 0.98,
  interactionRange: 2.5,
  baselineMGyPerDay: 0.21,
  eventDoseMGy: 8.1,
  eventSol: 3,
  eventHours: 8,
  warningHours: 6,
  doseLimitMGy: 5,
  stressEnabled: true,
  stressPerMGy: 15,
  stressRecoveryPerHour: 6,
  baselineTransmission: 0.7,
  eventTransmission: 0.2,
  shelterX: 6,
  shelterZ: 5,
  shelterWidth: 4,
  shelterDepth: 4,
  shelterHeight: 3,
};
export type BaseConfig = typeof baseDefaults;
export const limits: Record<keyof BaseConfig, [number, number, number]> = {
  version: [2, 2, 1],
  sols: [1, 30, 1],
  realSecondsPerSol: [10, 3600, 1],
  startHour: [0, 24, 0.1],
  area: [0, 500, 1],
  panelEfficiency: [0, 1, 0.01],
  peakIrradiance: [0, 1000, 1],
  tracking: [0, 1, 1],
  trackingPower: [0, 1000, 1],
  maxTilt: [0, 90, 1],
  fixedTilt: [0, 90, 1],
  fixedAzimuth: [-180, 180, 1],
  batteryCapacity: [1, 1000000, 100],
  initialCharge: [0, 1, 0.01],
  chargeLimit: [0, 100000, 100],
  dischargeLimit: [0, 100000, 100],
  chargeEfficiency: [0.01, 1, 0.01],
  dischargeEfficiency: [0.01, 1, 0.01],
  baseLoad: [0, 10000, 10],
  generatorLoad: [0, 10000, 10],
  oxygenCapacity: [0.01, 100, 0.1],
  initialOxygen: [0, 100, 0.1],
  oxygenConsumption: [0, 10, 0.001],
  oxygenProduction: [0, 10, 0.001],
  shelterLoad: [0, 10000, 10],
  initialDust: [0, 1, 0.01],
  dustLossPerSol: [0, 1, 0.01],
  dustFloor: [0, 1, 0.01],
  cleanSeconds: [0.1, 60, 0.1],
  cleanRestore: [0, 1, 0.01],
  cleanVisualThreshold: [0, 1, 0.01],
  interactionRange: [0.5, 6, 0.1],
  baselineMGyPerDay: [0, 10, 0.001],
  eventDoseMGy: [0, 1000, 0.1],
  eventSol: [0, 30, 0.1],
  eventHours: [0.1, 100, 0.1],
  warningHours: [0, 100, 0.1],
  doseLimitMGy: [0.001, 1000, 0.1],
  stressEnabled: [0, 1, 1],
  stressPerMGy: [0, 100, 0.1],
  stressRecoveryPerHour: [0, 100, 0.1],
  baselineTransmission: [0, 1, 0.01],
  eventTransmission: [0, 1, 0.01],
  shelterX: [-12, 12, 0.1],
  shelterZ: [-12, 12, 0.1],
  shelterWidth: [1, 10, 0.1],
  shelterDepth: [1, 10, 0.1],
  shelterHeight: [1.8, 6, 0.1],
};
export function validateBase(input: unknown): BaseConfig {
  if (!input || typeof input !== "object")
    throw Error("Expected base scenario object");
  const s = { ...baseDefaults };
  for (const k of Object.keys(s) as (keyof BaseConfig)[]) {
    const v = (input as Record<string, unknown>)[k];
    if (
      v === undefined &&
      [
        "stressEnabled",
        "stressPerMGy",
        "stressRecoveryPerHour",
        "cleanVisualThreshold",
      ].includes(k)
    )
      continue;
    if (typeof v !== typeof s[k]) throw Error(`Invalid ${k}`);
    if (
      typeof v === "number" &&
      (!Number.isFinite(v) || v < limits[k][0] || v > limits[k][1])
    )
      throw Error(`${k} outside supported range`);
    Object.assign(s, { [k]: v });
  }
  if (
    s.version !== 2 ||
    s.initialOxygen > s.oxygenCapacity ||
    s.initialDust < s.dustFloor ||
    s.cleanRestore < s.dustFloor
  )
    throw Error("Invalid version, reserves or dust bounds");
  return s;
}
export function encodeBase(s: BaseConfig) {
  return JSON.stringify(
    { schema: "nebula-base", version: 2, settings: s },
    null,
    2,
  );
}
export function decodeBase(text: string) {
  const d = JSON.parse(text);
  if (d.schema !== "nebula-base" || d.version !== 2)
    throw Error(
      "Expected version 2 base settings; legacy training settings are separate.",
    );
  return validateBase(d.settings);
}
