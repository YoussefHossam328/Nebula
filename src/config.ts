export const defaults = {
  gravity: 3.71,
  walk: 2.5,
  turnResponsiveness: 12,
  modelScale: 1,
  modelYaw: 180,
  modelOffsetY: 0,
  animationBlend: 0.18,
  walkAnimationRate: 1,
  runAnimationRate: 1.6,
  audioEnabled: true,
  masterVolume: 0.55,
  ambientVolume: 0.25,
  effectsVolume: 0.7,
  walkStepDistance: 0.8,
  runStepDistance: 1.1,
  run: 4.5,
  crouchSpeed: 1.2,
  acceleration: 14,
  braking: 20,
  airControl: 0.35,
  jumpHeight: 1.2,
  slope: 45,
  step: 0.3,
  standing: 1.6,
  crouching: 1,
  radius: 0.3,
  interactionRange: 2,
  yaw: 45,
  pitch: 35,
  distance: 12,
  fov: 40,
  targetHeight: 0.8,
  smoothing: 7,
  followDelay: 0.12,
  shakeEnabled: false,
  landingShake: true,
  runningShake: false,
  shakeStrength: 0.06,
  shakeFrequency: 14,
  shakeDuration: 0.25,
  resolution: 1.5,
  shadows: true,
  stationRoof: true,
  stationCutaway: true,
};
export type Settings = typeof defaults;
export function validate(input: unknown): Settings {
  if (!input || typeof input !== "object")
    throw Error("Settings must be an object.");
  const s = { ...defaults };
  const obj = input as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof Settings)[]) {
    const v = obj[key];
    if (
      v === undefined &&
      [
        "turnResponsiveness",
        "modelScale",
        "modelYaw",
        "modelOffsetY",
        "animationBlend",
        "walkAnimationRate",
        "runAnimationRate",
        "audioEnabled",
        "masterVolume",
        "ambientVolume",
        "effectsVolume",
        "walkStepDistance",
        "runStepDistance",
        "stationRoof",
        "stationCutaway",
        "landingShake",
        "runningShake",
        "followDelay",
        "shakeEnabled",
        "shakeStrength",
        "shakeFrequency",
        "shakeDuration",
      ].includes(key)
    )
      continue;
    if (typeof v !== typeof defaults[key]) throw Error(`Invalid ${key}`);
    if (typeof v === "number" && !Number.isFinite(v))
      throw Error(`Invalid ${key}`);
    Object.assign(s, { [key]: v });
  }
  const ranges: Partial<Record<keyof Settings, [number, number]>> = {
    gravity: [0.1, 30],
    walk: [0.1, 15],
    turnResponsiveness: [0.1, 40],
    modelScale: [0.1, 3],
    modelYaw: [-180, 180],
    modelOffsetY: [-1, 1],
    animationBlend: [0, 1],
    walkAnimationRate: [0.1, 4],
    runAnimationRate: [0.1, 4],
    masterVolume: [0, 1],
    ambientVolume: [0, 1],
    effectsVolume: [0, 1],
    walkStepDistance: [0.1, 3],
    runStepDistance: [0.1, 3],
    run: [0.1, 20],
    crouchSpeed: [0.1, 10],
    acceleration: [0.1, 60],
    braking: [0.1, 60],
    airControl: [0, 1],
    jumpHeight: [0.1, 5],
    slope: [1, 80],
    step: [0, 1],
    standing: [0.8, 3],
    crouching: [0.6, 2],
    radius: [0.1, 0.5],
    interactionRange: [0.5, 6],
    yaw: [-180, 180],
    pitch: [10, 80],
    distance: [3, 30],
    fov: [20, 90],
    targetHeight: [0, 3],
    smoothing: [0.1, 20],
    followDelay: [0, 1],
    shakeStrength: [0, 0.3],
    shakeFrequency: [1, 30],
    shakeDuration: [0.05, 2],
    resolution: [0.5, 2],
  };
  for (const [k, [min, max]] of Object.entries(ranges)) {
    const v = s[k as keyof Settings] as number;
    if (v < min || v > max)
      throw Error(`${k} must be between ${min} and ${max}`);
  }
  if (
    s.crouching > s.standing ||
    s.crouching < 2 * s.radius ||
    s.standing < 2 * s.radius
  )
    throw Error(
      "Collider heights must contain the diameter; crouching must not exceed standing.",
    );
  return s;
}
export function decode(text: string) {
  const data = JSON.parse(text);
  if (data.version !== 1) throw Error("Unsupported settings version");
  return validate(data.settings);
}
export function encode(settings: Settings) {
  return JSON.stringify({ version: 1, settings }, null, 2);
}
export function load(): Settings {
  try {
    const saved = localStorage.getItem("nebula.settings");
    return saved ? decode(saved) : { ...defaults };
  } catch {
    return { ...defaults };
  }
}
export function jumpSpeed(s: Settings) {
  return Math.sqrt(2 * s.gravity * s.jumpHeight);
}
export function approach(current: number, target: number, amount: number) {
  return current < target
    ? Math.min(target, current + amount)
    : Math.max(target, current - amount);
}
