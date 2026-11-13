import type GUI from "lil-gui";
import type { Settings } from "./config";
import type { BaseConfig } from "./base/config";
export const generalHelp: Record<keyof Settings, string> = {
  gravity:
    "Downward acceleration in m/s². Higher gravity makes falls faster and changes the jump launch speed.",
  walk: "Walking speed in metres per second.",
  run: "Speed in metres per second while Shift is held.",
  crouchSpeed: "Movement speed in metres per second while crouching.",
  acceleration:
    "How quickly ground speed approaches the requested speed, in m/s².",
  braking:
    "How quickly speed falls after releasing movement, in m/s². Does not rotate the character.",
  airControl:
    "Fraction of ground acceleration available in the air: 0 = no steering, 1 = full steering.",
  jumpHeight:
    "Target jump rise in metres. Launch speed is calculated from this and gravity.",
  slope: "Steepest walkable slope in degrees.",
  step: "Maximum obstacle height, in metres, that the controller can step over.",
  standing:
    "Total standing collision height in metres, including the capsule ends.",
  crouching:
    "Total crouched collision height in metres. Standing requires overhead clearance.",
  radius:
    "Collision capsule radius in metres; larger values make tight gaps harder to pass.",
  interactionRange:
    "Maximum distance in metres for the legacy oxygen/beacon interaction. Base maintenance has its own range.",
  yaw: "Camera angle around the character in degrees; movement remains relative to this view.",
  pitch:
    "Downward camera angle in degrees. Higher values look more from above.",
  distance: "Camera distance from its follow target in metres.",
  fov: "Vertical field of view in degrees. Larger values show more of the scene.",
  targetHeight:
    "Height in metres above the character’s feet that the camera aims at.",
  smoothing:
    "Follow responsiveness. Higher values catch up faster; lower values feel softer.",
  followDelay:
    "Follow history delay in real seconds before the camera responds to movement.",
  shakeEnabled:
    "Master camera shake switch. Turn off to disable all shake, including preview.",
  landingShake:
    "Allow a brief shake when the character lands; master shake must also be enabled.",
  runningShake:
    "Allow repeated small shakes while running; master shake must also be enabled.",
  shakeStrength:
    "Maximum shake displacement in metres. Zero removes visible shake.",
  shakeFrequency:
    "Base shake frequency in Hz; higher values shake more rapidly.",
  shakeDuration: "Length of each shake impulse in real seconds.",
  resolution:
    "Maximum rendering pixel ratio. Lower values improve performance but soften the image.",
  shadows: "Enable dynamic shadows. Disabling can improve performance.",
  stationRoof:
    "Show the placeholder habitat roof from outside. Turn off to inspect the interior at any time.",
  stationCutaway:
    "Automatically hide the roof and camera-side walls when the character enters the habitat. Collision stays active.",
};
export const baseHelp: Record<Exclude<keyof BaseConfig, "version">, string> = {
  sols: "Number of Mars days to survive. One sol is about 24 hours 39 minutes.",
  realSecondsPerSol:
    "Real seconds per in-game sol. Lower values accelerate every base simulation system.",
  startHour:
    "Starting local solar hour, 0–24. The representative daylight interval is 6–18.",
  area: "Effective solar array area in m². The small placeholder represents the whole array.",
  panelEfficiency:
    "Fraction of incoming sunlight converted to electricity, 0–1.",
  peakIrradiance:
    "Peak direct solar irradiance in W/m²; a scenario assumption, not live Mars weather.",
  tracking:
    "Automatically point panels toward the modeled sun within the tilt limit. Off uses fixed angles.",
  trackingPower: "Electrical load in watts while daylight tracking is active.",
  maxTilt: "Maximum tracking tilt away from horizontal in degrees.",
  fixedTilt: "Panel tilt from horizontal in degrees when tracking is off.",
  fixedAzimuth:
    "Fixed panel compass angle in degrees when tracking is off: 0 points +Z, 90 points +X.",
  batteryCapacity:
    "Maximum stored battery energy in watt-hours. 1,000 Wh = 1 kWh.",
  initialCharge: "Starting battery state of charge as a fraction, 0–1.",
  chargeLimit: "Maximum electrical charging power in watts.",
  dischargeLimit: "Maximum power the battery can supply in watts.",
  chargeEfficiency: "Fraction of charging energy retained in storage, 0–1.",
  dischargeEfficiency:
    "Fraction of energy removed from storage delivered to loads, 0–1.",
  baseLoad:
    "Essential station electrical demand in watts, independent of oxygen production.",
  generatorLoad:
    "Extra electrical demand in watts when the oxygen plant is powered.",
  oxygenCapacity:
    "Maximum outpost oxygen reserve in kilograms; not a suit tank.",
  initialOxygen:
    "Starting oxygen reserve in kilograms. Must not exceed capacity.",
  oxygenConsumption: "Outpost oxygen use in kilograms per simulation hour.",
  oxygenProduction:
    "Oxygen made per simulation hour while the plant has power, in kg/hour.",
  shelterLoad:
    "Extra environmental-support load in watts while occupied. It does not create radiation shielding.",
  initialDust:
    "Starting fraction of light transmitted through dust, 0–1. Higher means cleaner.",
  dustLossPerSol: "Amount subtracted from dust transmission each sol.",
  dustFloor: "Lowest dust transmission allowed by the deposition model.",
  cleanSeconds:
    "Real seconds to hold E near the array. Releasing, leaving range or pausing cancels progress.",
  cleanRestore: "Dust transmission after a complete cleaning, 0–1.",
  interactionRange:
    "Maximum distance in metres for base oxygen controls and panel cleaning.",
  baselineMGyPerDay:
    "Background absorbed-dose reference in mGy per Earth day (86,400 seconds). Literature reference, not live data.",
  eventDoseMGy:
    "Outdoor total mGy over the reconstructed event interval, including modeled background. Changing it modifies the historical scenario.",
  eventSol:
    "Elapsed sols before the particle event starts: 3 means the beginning of displayed Sol 4.",
  eventHours:
    "Reconstructed particle-event duration in simulation hours; not a measured NASA time curve.",
  warningHours:
    "Simulation hours of advance warning before particle-event onset.",
  doseLimitMGy:
    "Accumulated mGy that immediately loses the run. An operational game rule, not a lethal medical dose.",
  baselineTransmission:
    "Fraction of baseline exposure received inside shelter. Lower values protect more.",
  eventTransmission:
    "Fraction of particle-event exposure received inside shelter. A modeling assumption, not measured material performance.",
  shelterX:
    "Shelter center X coordinate in metres; moves both collision and protection volume.",
  shelterZ:
    "Shelter center Z coordinate in metres; moves both collision and protection volume.",
  shelterWidth: "Shelter width in metres along X.",
  shelterDepth:
    "Shelter depth in metres along Z; the entrance is on the negative-Z side.",
  shelterHeight:
    "Shelter height in metres. Protection applies only below this height.",
};
export const legacyHelp: Record<string, string> = {
  duration: "Duration of the original training exercise in real seconds.",
  batteryCapacity:
    "Maximum battery reserve in fictional training units, not Wh.",
  oxygenCapacity: "Maximum oxygen reserve in fictional training units, not kg.",
  battery: "Starting battery reserve in training units.",
  oxygen: "Starting oxygen reserve in training units.",
  backgroundDrain:
    "Battery training units used each second, even with the oxygen maker off.",
  oxygenConsumption: "Oxygen training units consumed each second.",
  generatorDrain:
    "Extra battery units consumed each second while the oxygen maker is on.",
  oxygenProduction:
    "Oxygen training units produced each second while the maker is on.",
  warning: "Percentage below which a low-supply warning appears.",
  critical:
    "Percentage below which a critical warning appears. Must be lower than warning.",
};
const actionHelp: Record<string, string> = {
  reset:
    "Restore the default movement, camera, station-view and rendering settings.",
  export: "Download movement, camera and rendering settings as JSON.",
  import: "Load a compatible settings JSON file; invalid values are rejected.",
  low: "Use a lower pixel ratio and disable shadows for better performance.",
  standard: "Restore the standard rendering quality preset.",
  shake: "Preview a shake impulse. The master shake switch must be enabled.",
};
const baseActions: Record<string, string> = {
  apply:
    "Validate the base draft and restart the entire scenario with it. Supplies, dust, dose and time reset.",
  reset:
    "Restore default base values into the draft. Apply and restart to use them.",
  export:
    "Download the current base draft as version-2 JSON with physical units.",
  import:
    "Load version-2 base settings into the draft. Apply and restart to use them; legacy training files stay separate.",
};
let serial = 0;
export function attachHelp(
  parent: HTMLElement,
  text: string,
  control?: HTMLElement,
) {
  const small = document.createElement("small");
  small.className = "setting-help";
  small.textContent = text;
  small.id = `setting-help-${++serial}`;
  parent.append(small);
  if (control) {
    control.setAttribute("aria-describedby", small.id);
    control.title = text;
  }
  return small;
}
export function describePanel(gui: GUI) {
  for (const c of gui.controllersRecursive()) {
    let base = false;
    for (
      let folder: GUI | undefined = c.parent;
      folder;
      folder = folder.parent
    ) {
      if (folder.$title.textContent?.includes("Base ·")) base = true;
    }
    const key = String(c.property);
    const description = base
      ? ((baseHelp as Record<string, string>)[key] ?? baseActions[key])
      : ((generalHelp as Record<string, string>)[key] ?? actionHelp[key]);
    if (!description)
      throw Error(
        `Missing setting description: ${base ? "base" : "general"}.${key}`,
      );
    c.domElement.dataset.setting = key;
    c.domElement.classList.add("has-setting-help");
    const help = attachHelp(
      c.domElement,
      description +
        (base ? " Changes pause the run; Apply and restart to commit." : ""),
    );
    c.domElement
      .querySelectorAll<HTMLElement>("input,select,button")
      .forEach((input) => {
        input.setAttribute("aria-describedby", help.id);
        input.title = description;
      });
  }
}
