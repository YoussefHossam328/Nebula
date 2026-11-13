import GUI from "lil-gui";
import {
  baseDefaults,
  limits,
  validateBase,
  decodeBase,
  encodeBase,
  SOL_SECONDS,
  type BaseConfig,
} from "./config";
import { BaseSimulation, doseRate } from "./model";
import { ARRAY_POSITION } from "./visuals";
import context from "../data/donki-context.json";
export function baseUI(
  gui: GUI,
  clear: () => void,
  stopLegacy: () => void,
  onConfig: (c: BaseConfig) => void,
) {
  let saved = { ...baseDefaults };
  try {
    const v = localStorage.getItem("nebula.base");
    if (v) saved = decodeBase(v);
  } catch {}
  const draft = { ...saved };
  let sim = new BaseSimulation(saved);
  let active = false,
    last = performance.now();
  const host = document.createElement("section");
  host.className = "base-hud";
  host.hidden = true;
  host.setAttribute("aria-label", "Seven-sol base operations");
  host.innerHTML = `<b>NEBULA / BASE OPERATIONS</b><p id="base-clock"></p><div class="base-actions"><button id="base-pause">Pause</button><button id="base-restart">Restart scenario</button><button id="base-exit">Exit to sandbox</button></div><div class="base-meters"><label>Battery <meter id="base-energy" min="0" max="100"></meter><span id="base-energy-text"></span></label><label>Oxygen reserve <meter id="base-oxygen" min="0" max="100"></meter><span id="base-oxygen-text"></span></label><label>Accumulated exposure · mGy <meter id="base-dose" min="0" max="100"></meter><span id="base-dose-text"></span></label></div><div id="base-stress-block"><label>Radiation stress · fictional game meter <meter id="base-stress" min="0" max="100"></meter><span id="base-stress-text"></span></label></div><p id="base-power"></p><p id="base-location"></p><p id="base-exposure-note" class="base-source"></p><p id="base-event" role="status"></p><p id="base-prompt"></p><progress id="base-clean" max="1" value="0" aria-label="Cleaning progress"></progress><p id="base-outcome" role="status"></p><p class="base-source">Historical dose anchor + reconstructed timing. Settings → Base / Sources.</p>`;
  host
    .querySelector("#base-dose")!
    .closest("label")!
    .before(host.querySelector("#base-stress-block")!);
  document.body.append(host);
  const el = (id: string) => host.querySelector<HTMLElement>("#" + id)!;
  const settingsMessage = document.createElement("p");
  settingsMessage.setAttribute("role", "status");
  const notify = (message: string) => {
    settingsMessage.textContent = message;
    el("base-outcome").textContent = message;
  };
  const launcher = document.createElement("button");
  launcher.id = "base-start";
  launcher.textContent = `Start base maintenance · ${saved.sols} sols`;
  (document.querySelector(".training-actions") ?? document.body).prepend(
    launcher,
  );
  function persist() {
    try {
      localStorage.setItem("nebula.base", encodeBase(saved));
    } catch {
      notify("Browser storage unavailable. Export settings to keep them.");
    }
  }
  function start() {
    const validated = validateBase(draft);
    stopLegacy();
    saved = validated;
    sim = new BaseSimulation(saved);
    sim.start();
    active = true;
    host.hidden = false;
    document.body.classList.add("base-active");
    document.querySelector("header p")!.textContent =
      "Seven-sol base maintenance · NASA reference scenario";
    clear();
    last = performance.now();
    onConfig(saved);
    notify("");
    persist();
    render();
  }
  launcher.onclick = () => {
    try {
      start();
    } catch (e) {
      window.alert(String(e));
    }
  };
  function pause() {
    sim.pause();
    clear();
    last = performance.now();
    render();
  }
  el("base-pause").onclick = () => {
    if (sim.state === "paused") {
      sim.resume();
      last = performance.now();
    } else pause();
    clear();
    render();
  };
  el("base-restart").onclick = () => {
    sim = new BaseSimulation(saved);
    sim.start();
    clear();
    last = performance.now();
    notify("");
    render();
  };
  el("base-exit").onclick = () => {
    pause();
    active = false;
    host.hidden = true;
    document.body.classList.remove("base-active");
    document.querySelector("header p")!.textContent =
      "Movement & camera sandbox · no mission yet";
    render();
  };
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  const root = gui.addFolder("Base · seven-sol scenario");
  root.close();
  root.$children.append(settingsMessage);
  const groups: [string, (keyof BaseConfig)[]][] = [
    ["Scenario clock", ["sols", "realSecondsPerSol", "startHour"]],
    [
      "Solar tracking",
      [
        "area",
        "panelEfficiency",
        "peakIrradiance",
        "tracking",
        "trackingPower",
        "maxTilt",
        "fixedTilt",
        "fixedAzimuth",
      ],
    ],
    [
      "Battery and power · Wh / W",
      [
        "batteryCapacity",
        "initialCharge",
        "chargeLimit",
        "dischargeLimit",
        "chargeEfficiency",
        "dischargeEfficiency",
        "baseLoad",
        "generatorLoad",
        "shelterLoad",
      ],
    ],
    [
      "Oxygen · kg / kg per hour",
      [
        "oxygenCapacity",
        "initialOxygen",
        "oxygenConsumption",
        "oxygenProduction",
      ],
    ],
    [
      "Dust and maintenance",
      [
        "initialDust",
        "dustLossPerSol",
        "dustFloor",
        "cleanSeconds",
        "cleanRestore",
        "cleanVisualThreshold",
        "interactionRange",
      ],
    ],
    [
      "Radiation · mGy / hours",
      [
        "baselineMGyPerDay",
        "eventDoseMGy",
        "eventSol",
        "eventHours",
        "warningHours",
        "doseLimitMGy",
      ],
    ],
    [
      "Recovery · fictional stress",
      ["stressEnabled", "stressPerMGy", "stressRecoveryPerHour"],
    ],
    [
      "Shelter · metres / transmission",
      [
        "shelterX",
        "shelterZ",
        "shelterWidth",
        "shelterDepth",
        "shelterHeight",
        "baselineTransmission",
        "eventTransmission",
      ],
    ],
  ];
  for (const [name, keys] of groups) {
    const folder = root.addFolder(name);
    folder.close();
    for (const k of keys) {
      const controller =
        typeof draft[k] === "boolean"
          ? folder.add(draft, k)
          : folder.add(draft, k, ...limits[k]);
      controller.onChange(() => {
        pause();
        clear();
      });
    }
  }
  const actions = {
    apply() {
      try {
        start();
      } catch (e) {
        notify(String(e));
      }
    },
    reset() {
      Object.assign(draft, baseDefaults);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      pause();
    },
    export() {
      const value = validateBase(draft);
      const url = URL.createObjectURL(
        new Blob([encodeBase(value)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "nebula-base-v2.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    import() {
      pause();
      file.click();
    },
  };
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".json";
  file.hidden = true;
  root.$children.append(file);
  file.onchange = async () => {
    try {
      if (file.files?.[0]) {
        Object.assign(draft, decodeBase(await file.files[0].text()));
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
        notify("Base settings imported; Apply and restart to use them.");
      }
    } catch (e) {
      notify(String(e));
    }
    file.value = "";
  };
  root.add(actions, "apply").name("Apply base settings and restart");
  root.add(actions, "reset").name("Reset base draft");
  root.add(actions, "export").name("Export base v2 settings");
  root.add(actions, "import").name("Import base v2 settings");
  const sources = root.addFolder("Sources and assumptions");
  sources.close();
  const info = document.createElement("div");
  info.className = "base-methods";
  info.innerHTML = `<p>Radiation stress is a fictional recoverable game meter, not a NASA dose measurement or biological prediction. Stress gain per mGy and recovery per sheltered simulation hour are editable game-balance values. Reaching 100% is a warning, not an additional loss rule. The physical dose limit still applies independently.</p><p>Radiation is RAD-reference absorbed exposure (mGy), not mSv or a human medical assessment. The 5 mGy limit is an editable operational game rule, not a lethal-dose claim.</p><p>May 20, 2024: NASA/JPL reports 8,100 µGy = 8.1 mGy. Our triangular 8-hour curve is reconstructed, not measured. Background is included in this event total once; modeled shielding changes exposure.</p><p>Baseline 0.21 mGy/Earth-day: Curiosity surface plastic-detector/tissue-reference value reported by Hassler et al. (2014), Science, doi:10.1126/science.1244797. Not a constant for every Mars site or season.</p><p>Solar irradiance, dust, equipment efficiencies and shielding transmission are editable assumptions. Oxygen production is a simplified CO₂-processing plant; 30 kWh/kg at default settings is a gameplay hardware assumption, not MOXIE's measured specification. Feedstock is assumed available.</p><p>Automatic load shedding preserves essential base/occupied shelter loads before oxygen production. Passive shielding persists without electricity. Unserved electrical demand is reported; no unmodeled instantaneous death is invented.</p><p><a href="https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/" target="_blank" rel="noopener">NASA/JPL event reference</a> · <a href="https://doi.org/10.1126/science.1244797" target="_blank" rel="noopener">RAD surface paper</a> · <a href="https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/" target="_blank" rel="noopener">RAD archive</a></p>`;
  const record = document.createElement("p");
  record.textContent = `DONKI archived context: ${context.records.length} record(s); ${context.status}; retrieved ${context.retrievedAt ?? "not fetched"}. Context only, not a Mars dosimeter.`;
  info.append(record);
  sources.$children.append(info);
  function target(p: { x: number; y: number; z: number }) {
    if (Math.abs(p.y) > 1.5) return "";
    const a = Math.min(
        Math.hypot(p.x - ARRAY_POSITION.x, p.z - (ARRAY_POSITION.z - 2)),
        Math.hypot(p.x - ARRAY_POSITION.x, p.z - ARRAY_POSITION.z),
      ),
      o = Math.hypot(p.x + 2, p.z - 2),
      range = Math.max(3, saved.interactionRange);
    return a <= range && a <= o ? "array" : o <= range ? "oxygen" : "";
  }
  function render() {
    if (!active) return;
    const f = sim.flows(),
      c = saved;
    const pct = (id: string, v: number, text: string) => {
      (el(id) as HTMLMeterElement).value = Math.max(0, Math.min(100, v));
      el(id + "-text").textContent = text;
    };
    el("base-clock").textContent =
      `Sol ${Math.min(c.sols, Math.floor(sim.elapsed / SOL_SECONDS) + 1)} / ${c.sols} · ${f.sun.hour.toFixed(1)}h · ${f.sun.daylight ? "DAY" : "NIGHT"} · ${sim.state}`;
    pct(
      "base-energy",
      (sim.battery / c.batteryCapacity) * 100,
      `${(sim.battery / 1000).toFixed(2)} / ${(c.batteryCapacity / 1000).toFixed(1)} kWh`,
    );
    pct(
      "base-oxygen",
      (sim.oxygen / c.oxygenCapacity) * 100,
      `${sim.oxygen.toFixed(3)} kg · maker ${sim.generator ? (f.powered ? "ON" : "SHED: insufficient power") : "OFF"}`,
    );
    pct(
      "base-dose",
      (sim.dose / c.doseLimitMGy) * 100,
      `${sim.dose.toFixed(3)} / ${c.doseLimitMGy.toFixed(2)} mGy · ${doseRate(sim.elapsed, c, sim.inShelter).toFixed(3)} mGy/h`,
    );
    el("base-stress-block").hidden = !c.stressEnabled;
    const stressRate =
      doseRate(sim.elapsed, c, sim.inShelter) * c.stressPerMGy -
      (sim.inShelter ? c.stressRecoveryPerHour : 0);
    pct(
      "base-stress",
      sim.stress,
      `${sim.stress.toFixed(1)}% · ${sim.state !== "running" ? "paused" : sim.inShelter && stressRate < 0 ? "recovering in shelter" : stressRate > 0 ? "rising" : "stable"}`,
    );
    el("base-power").textContent =
      `PV ${f.pv.toFixed(0)} W · load ${f.load.toFixed(0)} W · net ${(f.pv - f.load).toFixed(0)} W · unmet ${f.unserved.toFixed(0)} W`;
    el("base-location").textContent =
      `${sim.inShelter ? "Inside storm shelter" : "Outside"} · array transmission ${(sim.dust * 100).toFixed(0)}% · ${c.tracking ? "Sun tracking" : "Fixed panel"}`;
    const outsideRate = doseRate(sim.elapsed, c, false);
    const shelteredRate = doseRate(sim.elapsed, c, true);
    const reduction =
      outsideRate > 0 ? (1 - shelteredRate / outsideRate) * 100 : 0;
    el("base-exposure-note").textContent = sim.inShelter
      ? `Shelter reduces incoming dose rate by ${reduction.toFixed(0)}%. Previously absorbed dose remains; the separate stress meter can recover.`
      : "Accumulated dose does not decay. Enter the storm shelter to reduce incoming exposure.";
    el("base-event").textContent = sim.eventState();
    (el("base-clean") as HTMLProgressElement).value =
      sim.cleanProgress / c.cleanSeconds;
    (el("base-pause") as HTMLButtonElement).disabled =
      sim.state === "lost" || sim.state === "completed";
    el("base-pause").textContent = sim.state === "paused" ? "Resume" : "Pause";
    if (sim.state === "lost")
      notify(
        `RUN LOST — ${sim.reason}. Dose is an operational limit, not a medical death prediction.`,
      );
    else if (sim.state === "completed")
      notify(
        `BASE MAINTAINED — ${c.sols} sols. Exposure ${sim.dose.toFixed(3)} mGy; ${sim.cleanCount} cleanings. Restart to compare strategies.`,
      );
  }
  return {
    start,
    target,
    pause,
    resume() {
      sim.resume();
      last = performance.now();
    },
    stop() {
      pause();
      active = false;
      host.hidden = true;
      document.body.classList.remove("base-active");
    },
    get active() {
      return active;
    },
    get sim() {
      return sim;
    },
    tick(now: number, p: { x: number; y: number; z: number }, held: boolean) {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      if (!active) return;
      if (document.hidden) {
        pause();
        return;
      }
      sim.advance(
        (dt * SOL_SECONDS) / saved.realSecondsPerSol,
        sim.isSheltered(p),
      );
      sim.clean(dt, held && target(p) === "array");
      el("base-prompt").textContent =
        sim.state !== "running"
          ? "Resume or restart to operate equipment."
          : target(p) === "array"
            ? `Hold E · clean solar array (${saved.cleanSeconds}s; release cancels)`
            : target(p) === "oxygen"
              ? `E · ${sim.generator ? "Disable" : "Enable"} oxygen production`
              : "Maintain panels, manage oxygen, seek shelter during the particle event.";
      render();
    },
    interact(p: { x: number; y: number; z: number }) {
      if (!active) return false;
      if (target(p) === "oxygen") sim.toggle();
      return true;
    },
  };
}
