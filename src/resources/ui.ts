import { mockProvider } from "../data/mock-provider";
import { Simulation } from "./simulation";
import { encodeScenario, decodeScenario, validateScenario } from "./config";
import type { Scenario } from "../data/types";
export async function training(clearInput: () => void) {
  const host = document.createElement("section");
  host.className = "training";
  host.setAttribute("aria-label", "Resource training");
  document.body.append(host);
  const { scenario: fixture, source } = await mockProvider.load();
  let config: Scenario = { ...fixture };
  try {
    const saved = localStorage.getItem("nebula.resources");
    if (saved) config = decodeScenario(saved);
  } catch {}
  let sim = new Simulation(config);
  let active = false;
  let last = performance.now();
  let level = "";
  host.innerHTML = `<b>OUTPOST / RESOURCE TRAINING</b><p class="source"></p><p>Making oxygen uses battery power. Keep both above zero until the training timer ends.</p><div class="meters"><label>Battery <meter id="battery-meter" min="0" max="100"></meter><span id="battery-text"></span></label><label>Oxygen reserve <meter id="oxygen-meter" min="0" max="100"></meter><span id="oxygen-text"></span></label></div><p id="training-status" aria-live="polite"></p><p id="training-prompt"></p><div class="training-actions"><button id="training-start">Start resource training</button><button id="training-pause">Pause</button><button id="training-restart">Restart training</button><button id="training-exit">Exit training</button></div><details><summary>About this model / resource settings</summary><p>Fictional training units, not NASA measurements. Reserves belong to an abstract outpost, not your suit. The oxygen maker requires electricity and an assumed available feedstock. No recharging occurs during this short exercise. Movement does not affect consumption.</p><p>Editing pauses training. Apply restarts with your new settings.</p><form id="resource-form"></form><button id="resource-export">Export resource settings</button><button id="resource-import">Import resource settings</button><button id="resource-reset">Default resource settings</button></details><p id="resource-message" role="status"></p>`;
  host.querySelector(".source")!.textContent = source.attribution;
  const el = (id: string) => host.querySelector<HTMLElement>("#" + id)!;
  const message = (s: string) => {
    el("resource-message").textContent = s;
  };
  const pause = () => {
    sim.pause();
    clearInput();
    last = performance.now();
    render();
  };
  const reset = () => {
    sim = new Simulation(config);
    sim.start();
    active = true;
    level = "";
    message("");
    last = performance.now();
    clearInput();
    render();
  };
  el("training-start").onclick = reset;
  el("training-restart").onclick = reset;
  el("training-exit").onclick = () => {
    active = false;
    sim = new Simulation(config);
    clearInput();
    render();
  };
  el("training-pause").onclick = () => {
    if (sim.state === "paused") {
      sim.resume();
      last = performance.now();
    } else pause();
    clearInput();
    render();
  };
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  host.addEventListener("focusin", () => clearInput());
  host.querySelector("details")!.addEventListener("toggle", () => {
    if (host.querySelector("details")!.open) pause();
  });
  const form = host.querySelector<HTMLFormElement>("form")!;
  const keys = [
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
  ] as const;
  function fields() {
    form.replaceChildren();
    for (const key of keys) {
      const label = document.createElement("label");
      label.textContent = key + " ";
      const input = document.createElement("input");
      input.name = key;
      input.type = "number";
      input.step = "any";
      input.value = String(config[key]);
      input.required = true;
      label.append(input);
      form.append(label);
    }
    const button = document.createElement("button");
    button.textContent = "Apply and restart";
    form.append(button);
  }
  function save() {
    try {
      localStorage.setItem("nebula.resources", encodeScenario(config));
    } catch {
      message("Browser storage unavailable; export to retain settings.");
    }
  }
  form.addEventListener("input", pause);
  form.onsubmit = (e) => {
    e.preventDefault();
    try {
      const next = { ...config };
      for (const key of keys)
        next[key] = Number(
          (form.elements.namedItem(key) as HTMLInputElement).value,
        );
      config = validateScenario(next);
      save();
      reset();
    } catch (e) {
      message(String(e));
    }
  };
  el("resource-export").onclick = () => {
    const url = URL.createObjectURL(
      new Blob([encodeScenario(config)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "nebula-resources.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".json";
  file.hidden = true;
  host.append(file);
  el("resource-import").onclick = () => {
    pause();
    file.click();
  };
  file.onchange = async () => {
    try {
      if (file.files?.[0]) {
        config = decodeScenario(await file.files[0].text());
        save();
        fields();
        reset();
      }
    } catch (e) {
      message(String(e));
    }
    file.value = "";
  };
  el("resource-reset").onclick = () => {
    config = { ...fixture };
    save();
    fields();
    reset();
  };
  fields();
  function render() {
    host.classList.toggle("active", active);
    for (const name of ["battery", "oxygen"] as const) {
      const percent =
        (sim[name] /
          config[name === "battery" ? "batteryCapacity" : "oxygenCapacity"]) *
        100;
      const meter = el(name + "-meter") as HTMLMeterElement;
      meter.value = percent;
      const rising =
        name === "oxygen" &&
        sim.on &&
        config.oxygenProduction > config.oxygenConsumption;
      el(name + "-text").textContent =
        `${percent.toFixed(1)}% · ${rising ? "↑ rising" : "↓ falling"}`;
    }
    el("training-start").hidden = active;
    for (const name of ["pause", "restart", "exit"])
      el("training-" + name).hidden = !active;
    (el("training-pause") as HTMLButtonElement).disabled =
      sim.state === "completed" || sim.state === "needs-retry";
    el("training-pause").textContent =
      sim.state === "paused" ? "Resume" : "Pause";
    const ended = sim.state === "completed" || sim.state === "needs-retry";
    el("training-status").textContent = !active
      ? "Sandbox — supplies are not being consumed."
      : ended
        ? `${sim.state === "completed" ? "Training complete!" : "Try another balance."} Oxygen production used battery power. Unit ran ${sim.runTime.toFixed(1)}s; final battery ${sim.battery.toFixed(1)}, oxygen ${sim.oxygen.toFixed(1)} units.`
        : `${sim.state} · ${Math.ceil(config.duration - sim.elapsed)}s left · Oxygen maker ${sim.on ? "ON" : "OFF"}`;
    const min =
      Math.min(
        sim.battery / config.batteryCapacity,
        sim.oxygen / config.oxygenCapacity,
      ) * 100;
    const next =
      min <= config.critical
        ? "Critical: check your reserves."
        : min <= config.warning
          ? "Supplies low: consider your next choice."
          : "";
    if (next !== level) {
      level = next;
      message(next);
    }
  }
  render();
  return {
    tick(now: number) {
      if (document.hidden) {
        pause();
        return;
      }
      sim.advance(Math.max(0, (now - last) / 1000));
      last = now;
      render();
    },
    prompt(near: boolean) {
      el("training-prompt").textContent =
        active && sim.state !== "running"
          ? "Resume or restart training to operate the oxygen maker."
          : active
            ? near
              ? `E · Turn oxygen maker ${sim.on ? "OFF — save battery; oxygen will fall" : "ON — oxygen will rise; battery drains faster"}`
              : "Approach the O₂ unit to change production."
            : "";
    },
    interact() {
      if (active && sim.state === "running") sim.toggle();
      render();
    },
    get active() {
      return active;
    },
    get state() {
      return sim;
    },
  };
}
