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
  battery: number;
  oxygen: number;
  dose = 0;
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
  isSheltered(p: { x: number; y: number; z: number }) {
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
      sun.irradiance * c.area * c.panelEfficiency * this.dust * sun.incidence;
    const tracking = sun.daylight && c.tracking ? c.trackingPower : 0;
    const essential =
      c.baseLoad + (this.inShelter ? c.shelterLoad : 0) + tracking;
    const available = pv + (this.battery > 1e-8 ? c.dischargeLimit : 0);
    const powered =
      this.generator && available + 1e-8 >= essential + c.generatorLoad;
    const load = essential + (powered ? c.generatorLoad : 0);
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
      let dt = Math.min(remaining, 30, this.endTime - this.elapsed);
      const f = this.flows(this.elapsed + dt / 2);
      const oxygenRate =
        ((f.powered ? c.oxygenProduction : 0) - c.oxygenConsumption) / 3600;
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
      this.dose += doseBetween(this.elapsed, this.elapsed + dt, c, sheltered);
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
      this.elapsed += dt;
      remaining -= dt;
      this.dust = Math.max(
        c.dustFloor,
        this.dust - (c.dustLossPerSol * dt) / SOL_SECONDS,
      );
      this.generatorPowered = f.powered;
      if (this.oxygen <= 1e-8) this.lose("Oxygen depleted");
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
}
