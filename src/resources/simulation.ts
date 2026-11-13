import type { Scenario } from "../data/types";
import { validateScenario } from "./config";
export class Simulation {
  elapsed = 0;
  battery: number;
  oxygen: number;
  on = false;
  runTime = 0;
  state: "ready" | "running" | "paused" | "completed" | "needs-retry" = "ready";
  choices: { time: number; on: boolean }[] = [];
  constructor(public scenario: Scenario) {
    this.scenario = validateScenario(scenario);
    this.battery = scenario.battery;
    this.oxygen = scenario.oxygen;
  }
  start() {
    if (this.state === "ready")
      this.state =
        this.battery <= 0 || this.oxygen <= 0 ? "needs-retry" : "running";
  }
  pause() {
    if (this.state === "running") this.state = "paused";
  }
  resume() {
    if (this.state === "paused") this.state = "running";
  }
  toggle() {
    if (this.state === "running") {
      this.on = !this.on;
      this.choices.push({ time: this.elapsed, on: this.on });
    }
  }
  advance(dt: number) {
    if (this.state !== "running" || !Number.isFinite(dt) || dt <= 0) return;
    const s = this.scenario,
      b = s.backgroundDrain + (this.on ? s.generatorDrain : 0),
      o = (this.on ? s.oxygenProduction : 0) - s.oxygenConsumption;
    const bt = b > 0 ? this.battery / b : Infinity,
      ot = o < 0 ? this.oxygen / -o : Infinity;
    const step = Math.max(0, Math.min(dt, s.duration - this.elapsed, bt, ot));
    this.elapsed += step;
    this.battery = Math.max(
      0,
      Math.min(s.batteryCapacity, this.battery - b * step),
    );
    this.oxygen = Math.max(
      0,
      Math.min(s.oxygenCapacity, this.oxygen + o * step),
    );
    if (this.on) this.runTime += step;
    if (this.battery <= 1e-8 || this.oxygen <= 1e-8) this.state = "needs-retry";
    else if (this.elapsed >= s.duration - 1e-8) this.state = "completed";
  }
}
