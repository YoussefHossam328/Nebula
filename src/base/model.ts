import { SOL_SECONDS, validateBase, type BaseConfig } from "./config";
const radians = (d: number) => (d * Math.PI) / 180;
export function sunlight(time: number, c: BaseConfig) {
  const hour = (((c.startHour + (time / SOL_SECONDS) * 24) % 24) + 24) % 24,
    angle = ((hour - 6) * Math.PI) / 12;
  const direction = { x: Math.cos(angle), y: Math.sin(angle), z: 0 };
  const daylight = hour >= 6 && hour < 18;
  const tilt = c.tracking
    ? Math.min(c.maxTilt, (Math.acos(Math.max(0, direction.y)) * 180) / Math.PI)
    : c.fixedTilt;
  const azimuth = c.tracking ? (direction.x >= 0 ? 90 : -90) : c.fixedAzimuth;
  const normal = {
    x: Math.sin(radians(tilt)) * Math.sin(radians(azimuth)),
    y: Math.cos(radians(tilt)),
    z: Math.sin(radians(tilt)) * Math.cos(radians(azimuth)),
  };
  const incidence = Math.max(
    0,
    normal.x * direction.x + normal.y * direction.y + normal.z * direction.z,
  );
  const irradiance = daylight
    ? c.peakIrradiance * Math.sqrt(Math.max(0, direction.y))
    : 0;
  return { hour, daylight, direction, normal, irradiance, incidence };
}
function eventCDF(time: number, c: BaseConfig) {
  const u = Math.max(
    0,
    Math.min(1, (time - c.eventSol * SOL_SECONDS) / (c.eventHours * 3600)),
  );
  return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
}
export function doseBetween(
  a: number,
  b: number,
  c: BaseConfig,
  sheltered: boolean,
) {
  return (
    ((c.baselineMGyPerDay * (b - a)) / 86400) *
      (sheltered ? c.baselineTransmission : 1) +
    Math.max(0, c.eventDoseMGy - (c.baselineMGyPerDay * c.eventHours) / 24) *
      (eventCDF(b, c) - eventCDF(a, c)) *
      (sheltered ? c.eventTransmission : 1)
  );
}
export function doseRate(time: number, c: BaseConfig, sheltered: boolean) {
  const u = (time - c.eventSol * SOL_SECONDS) / (c.eventHours * 3600);
  const event =
    u > 0 && u < 1
      ? (Math.max(
          0,
          c.eventDoseMGy - (c.baselineMGyPerDay * c.eventHours) / 24,
        ) /
          c.eventHours) *
        4 *
        Math.min(u, 1 - u)
      : 0;
  return (
    (c.baselineMGyPerDay / 24) * (sheltered ? c.baselineTransmission : 1) +
    event * (sheltered ? c.eventTransmission : 1)
  );
}
export class BaseSimulation {
  elapsed = 0;
  nourishment = 80;
  crops = [1, 1];
  foodDrain = 25;
  mealSize = 35;
  cropSols = 1;
  cropWatts = 400;
  dustTransmission = 0.45;
  coldWatts = 300;
  hazard: "dust" | "cold" | "none" = "none";
  harvest() {
    if (this.state !== "running" || this.nourishment >= 100) return false;
    const i = this.crops.findIndex((v) => v >= 1);
    if (i < 0) return false;
    this.crops[i] = 0;
    this.nourishment = Math.min(100, this.nourishment + this.mealSize);
    return true;
  }
  /** Hands-on harvest of one ripe bed: `amount` of a meal, replant with a head start. */
  harvestBed(i: number, amount: number, headStart = 0) {
    if (this.state !== "running" && this.state !== "paused") return false;
    if (!(this.crops[i] >= 1) || !Number.isFinite(amount)) return false;
    const a = Math.max(0, Math.min(1, amount));
    this.crops[i] = Math.max(0, Math.min(0.5, headStart));
    this.nourishment = Math.min(100, this.nourishment + this.mealSize * a);
    return true;
  }
  battery: number;
  oxygen: number;
  dose = 0;
  stress = 0;
  dust: number;
  generator = true;
  generatorPowered = false;
  inShelter = false;
  cleanProgress = 0;
  private cleanLatched = false;
  cleanCount = 0;
  state: "ready" | "running" | "paused" | "completed" | "lost" = "ready";
  reason = "";
  producedWh = 0;
  loadWh = 0;
  chargeLossWh = 0;
  dischargeLossWh = 0;
  curtailedWh = 0;
  unservedWh = 0;
  cleanedAt = 0;
  endTime: number;
  constructor(public config: BaseConfig) {
    this.config = validateBase(config);
    this.battery = config.batteryCapacity * config.initialCharge;
    this.oxygen = config.initialOxygen;
    this.dust = config.initialDust;
    this.endTime = config.sols * SOL_SECONDS;
  }
  start() {
    if (this.state === "ready") {
      this.state = "running";
      if (this.oxygen <= 0) this.lose("Oxygen depleted");
    }
  }
  pause() {
    if (this.state === "running") {
      this.state = "paused";
      this.cleanProgress = 0;
      this.cleanLatched = false;
    }
  }
  resume() {
    if (this.state === "paused") this.state = "running";
  }
  lose(reason: string) {
    this.state = "lost";
    this.reason = reason;
    this.cleanProgress = 0;
  }
  toggle() {
    if (this.state === "running") this.generator = !this.generator;
  }
  /** Optional world shelter test (the habitat interior); falls back to the config box. */
  shelterTest?: (p: { x: number; y: number; z: number }) => boolean;
  /** Open hull punctures in the oxygen plant; each one vents reserve oxygen. */
  punctures = 0;
  nextLeakAt = -1;
  leakedKg = 0;
  /** Seals one puncture (oxygen plant minigame). */
  repair() {
    if (this.punctures <= 0) return false;
    this.punctures--;
    return true;
  }
  /** Breathing load multiplier from the stress meter (1 .. 1+penalty). */
  breathing(stress = this.stress) {
    const c = this.config;
    return c.stressEnabled ? 1 + (c.stressOxygenPenalty * stress) / 100 : 1;
  }
  /** Signed oxygen flow in kg/h for the current location. */
  oxygenFlow(powered: boolean, sheltered = this.inShelter, stress = this.stress) {
    const c = this.config;
    const make = powered && sheltered ? c.oxygenProduction : 0;
    const use =
      (c.oxygenConsumption + (sheltered ? 0 : c.evaOxygenConsumption)) *
      this.breathing(stress);
    return { make, use, leak: this.punctures * c.leakRate, net: make - use - this.punctures * c.leakRate };
  }
  /** Signed stress change per simulated hour at the given location. */
  stressFlow(sheltered = this.inShelter, t = this.elapsed) {
    const c = this.config;
    if (!c.stressEnabled) return 0;
    return (
      doseRate(t, c, sheltered) * c.stressPerMGy +
      (sheltered ? -c.stressRecoveryPerHour : c.stressEvaPerHour)
    );
  }
  isSheltered(p: { x: number; y: number; z: number }) {
    if (this.shelterTest) return this.shelterTest(p);
    const c = this.config;
    return (
      Math.abs(p.x - c.shelterX) < c.shelterWidth / 2 &&
      Math.abs(p.z - c.shelterZ) < c.shelterDepth / 2 &&
      p.y >= -0.1 &&
      p.y < c.shelterHeight
    );
  }
  eventState() {
    const c = this.config,
      start = c.eventSol * SOL_SECONDS,
      end = start + c.eventHours * 3600;
    return this.elapsed >= end
      ? "Recovered"
      : this.elapsed >= start
        ? "PARTICLE EVENT"
        : this.elapsed >= start - c.warningHours * 3600
          ? "Warning: seek shelter"
          : "Quiet";
  }
  flows(t = this.elapsed) {
    const c = this.config,
      sun = sunlight(t, c);
    const pv =
      (this.hazard === "dust" ? this.dustTransmission : 1) *
      sun.irradiance *
      c.area *
      c.panelEfficiency *
      this.dust *
      sun.incidence;
    const tracking = sun.daylight && c.tracking ? c.trackingPower : 0;
    const essential =
      c.baseLoad +
      (this.hazard === "cold" ? this.coldWatts : 0) +
      (this.inShelter ? c.shelterLoad : 0) +
      tracking;
    const available = pv + (this.battery > 1e-8 ? c.dischargeLimit : 0);
    const powered =
      this.generator && available + 1e-8 >= essential + c.generatorLoad;
    const cropsPowered =
      this.crops.some((v) => v < 1) &&
      available >= essential + (powered ? c.generatorLoad : 0) + this.cropWatts;
    const load =
      essential +
      (powered ? c.generatorLoad : 0) +
      (cropsPowered ? this.cropWatts : 0);
    const deficit = Math.max(0, load - pv);
    const batteryDraw = Math.min(
      deficit,
      this.battery > 1e-8 ? c.dischargeLimit : 0,
    );
    return {
      sun,
      pv,
      load,
      powered,
      cropsPowered,
      batteryDraw,
      unserved: Math.max(0, deficit - batteryDraw),
      surplus: Math.max(0, pv - load),
    };
  }
  advance(seconds: number, sheltered = this.inShelter) {
    if (this.state !== "running" || !Number.isFinite(seconds) || seconds <= 0)
      return;
    this.inShelter = sheltered;
    let remaining = Math.min(seconds, this.endTime - this.elapsed);
    // Bounded midpoint quadrature for PV; analytic event-dose integral. Resource boundaries split steps.
    while (remaining > 1e-7 && this.state === "running") {
      const c = this.config;
      if (this.nextLeakAt < 0) this.nextLeakAt = c.leakEverySols * SOL_SECONDS;
      let dt = Math.min(remaining, 30, this.endTime - this.elapsed);
      // Punctures happen on a boundary so outcomes don't depend on frame timing.
      if (this.nextLeakAt > this.elapsed + 1e-9)
        dt = Math.min(dt, this.nextLeakAt - this.elapsed);
      const f = this.flows(this.elapsed + dt / 2);
      // Midpoint stress: stress changes linearly over a step, so breathing load is exact.
      const midStress = c.stressEnabled
        ? Math.max(0, Math.min(100, this.stress + (this.stressFlow(sheltered, this.elapsed + dt / 2) * dt) / 7200))
        : 0;
      const oxygenRate = this.oxygenFlow(f.powered, sheltered, midStress).net / 3600;
      const batteryRate =
        f.surplus > 0
          ? (Math.min(f.surplus, c.chargeLimit) * c.chargeEfficiency) / 3600
          : -f.batteryDraw / c.dischargeEfficiency / 3600;
      if (oxygenRate < 0) dt = Math.min(dt, this.oxygen / -oxygenRate);
      if (batteryRate < 0 && this.battery > 1e-8)
        dt = Math.min(dt, this.battery / -batteryRate);
      if (batteryRate > 0 && this.battery < c.batteryCapacity - 1e-8)
        dt = Math.min(dt, (c.batteryCapacity - this.battery) / batteryRate);
      if (
        this.dose +
          doseBetween(this.elapsed, this.elapsed + dt, c, sheltered) >=
        c.doseLimitMGy
      ) {
        let lo = 0,
          hi = dt;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if (
            this.dose +
              doseBetween(this.elapsed, this.elapsed + mid, c, sheltered) >=
            c.doseLimitMGy
          )
            hi = mid;
          else lo = mid;
        }
        dt = hi;
      }
      if (dt < 1e-10) {
        if (this.oxygen <= 1e-8) this.lose("Oxygen depleted");
        else if (this.dose >= c.doseLimitMGy - 1e-8)
          this.lose("Operational dose limit exceeded");
        else {
          this.battery = batteryRate < 0 ? 0 : c.batteryCapacity;
          dt = Math.min(remaining, 0.001);
        }
        if (this.state !== "running") break;
      }
      const incomingDose = doseBetween(
        this.elapsed,
        this.elapsed + dt,
        c,
        sheltered,
      );
      this.dose += incomingDose;
      // Stress: dose-driven, plus EVA strain outside; recovers inside the habitat.
      this.stress = c.stressEnabled
        ? Math.max(
            0,
            Math.min(
              100,
              this.stress +
                incomingDose * c.stressPerMGy +
                ((sheltered ? -c.stressRecoveryPerHour : c.stressEvaPerHour) *
                  dt) /
                  3600,
            ),
          )
        : 0;
      if (oxygenRate < 0)
        this.leakedKg += (this.punctures * c.leakRate * dt) / 3600;
      this.oxygen = Math.max(
        0,
        Math.min(c.oxygenCapacity, this.oxygen + oxygenRate * dt),
      );
      const before = this.battery;
      this.battery = Math.max(
        0,
        Math.min(c.batteryCapacity, this.battery + batteryRate * dt),
      );
      if (this.battery < 1e-8) this.battery = 0;
      this.producedWh += (f.pv * dt) / 3600;
      this.loadWh += ((f.load - f.unserved) * dt) / 3600;
      this.unservedWh += (f.unserved * dt) / 3600;
      const charged = Math.max(0, this.battery - before);
      const discharged = Math.max(0, before - this.battery);
      this.chargeLossWh += charged * (1 / c.chargeEfficiency - 1);
      this.dischargeLossWh += discharged * (1 - c.dischargeEfficiency);
      this.curtailedWh += Math.max(
        0,
        (f.surplus * dt) / 3600 - charged / c.chargeEfficiency,
      );
      this.nourishment = Math.max(
        0,
        this.nourishment - (this.foodDrain * dt) / SOL_SECONDS,
      );
      if (f.cropsPowered)
        this.crops = this.crops.map((v) =>
          Math.min(1, v + dt / (this.cropSols * SOL_SECONDS)),
        );
      this.elapsed += dt;
      remaining -= dt;
      this.dust = Math.max(
        c.dustFloor,
        this.dust - (c.dustLossPerSol * dt) / SOL_SECONDS,
      );
      this.generatorPowered = f.powered;
      if (this.elapsed >= this.nextLeakAt - 1e-9) {
        if (this.punctures < c.maxPunctures) this.punctures++;
        // Deterministic jitter keeps runs comparable between attempts.
        const k = this.punctures + Math.floor(this.elapsed / SOL_SECONDS);
        this.nextLeakAt +=
          c.leakEverySols * SOL_SECONDS * (0.75 + 0.5 * ((k * 0.618) % 1));
      }
      if (this.nourishment <= 0) this.lose("Food depleted");
      else if (this.oxygen <= 1e-8) this.lose("Oxygen depleted");
      else if (this.dose >= c.doseLimitMGy - 1e-8)
        this.lose("Operational dose limit exceeded");
      else if (this.elapsed >= this.endTime - 1e-6) this.state = "completed";
    }
  }
  clean(realSeconds: number, held: boolean) {
    if (!Number.isFinite(realSeconds) || realSeconds < 0) return;
    if (this.state !== "running" || !held) {
      this.cleanProgress = 0;
      this.cleanLatched = false;
      return;
    }
    if (this.cleanLatched) return;
    this.cleanProgress += Math.max(0, realSeconds);
    if (this.cleanProgress >= this.config.cleanSeconds) {
      this.dust = this.config.cleanRestore;
      this.cleanProgress = this.config.cleanSeconds;
      this.cleanLatched = true;
      this.cleanCount++;
      this.cleanedAt = this.elapsed;
    }
  }
  /** Transmission when a hands-on service session began. */
  serviceStart = -1;
  /** How dirty the array is, 0 (fully restored) .. 1 (at the dust floor). */
  dirtiness() {
    const c = this.config,
      span = c.cleanRestore - c.dustFloor;
    return span > 1e-6
      ? Math.max(0, Math.min(1, (c.cleanRestore - this.dust) / span))
      : 0;
  }
  beginService() {
    this.serviceStart = this.dust;
  }
  /**
   * Hands-on brush cleaning: `fraction` of the visible dust removed so far.
   * Transmission recovers proportionally and never drops below its current value.
   */
  scrub(fraction: number) {
    if (this.serviceStart < 0 || !Number.isFinite(fraction)) return;
    if (this.state !== "running" && this.state !== "paused") return;
    const f = Math.max(0, Math.min(1, fraction));
    const target =
      this.serviceStart + (this.config.cleanRestore - this.serviceStart) * f;
    this.dust = Math.max(this.dust, Math.min(this.config.cleanRestore, target));
    this.cleanProgress = f * this.config.cleanSeconds;
  }
  finishService(complete: boolean) {
    if (this.serviceStart < 0) return;
    if (complete && (this.state === "running" || this.state === "paused")) {
      this.dust = this.config.cleanRestore;
      this.cleanCount++;
      this.cleanedAt = this.elapsed;
    }
    this.serviceStart = -1;
    this.cleanProgress = 0;
  }
}
