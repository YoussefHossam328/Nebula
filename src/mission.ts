import { ARRAY_POSITION } from "./base/visuals";
import { stationLayout } from "./layout";
import * as THREE from "three";
import { eventDefaults, scheduledEvent } from "./events";
import type GUI from "lil-gui";
import type { baseUI } from "./base/ui";
import { SOL_SECONDS } from "./base/config";
import { createApodWidget } from "./apod";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import RAPIER from "@dimforge/rapier3d";
import { cleaningGame } from "./cleaning";
import { harvestGame, type HarvestResult } from "./harvest";
import { oxygenPlantGame } from "./o2plant";
import { captureSave, clearSave, readSave, writeSave, type MissionSave } from "./save";
type Base = ReturnType<typeof baseUI>;
const lessons = [
  [
    "Welcome to Mars",
    "Walk with WASD (or the on-screen stick). Hold Shift to run, Space to jump, and C to crouch. Try each before continuing.",
    "Move, run, jump and crouch.",
  ],
  [
    "Catch the sunlight",
    "The panels follow the Sun. Sunlight charges our battery. At night, equipment uses the stored energy.",
    "Walk to the solar array at the left of the base.",
  ],
  [
    "Keep panels clean",
    "Dust blocks sunlight. Stand on the service ring and press E to open the service hatch, then scrub the panel by dragging across it. Caked spots need a few passes. Clean panels make more power.",
    "Press E at the solar service ring and scrub the panel clean.",
  ],
  [
    "Make oxygen",
    "The oxygen maker needs electricity, and its output only reaches you indoors: outside, your suit drains the reserve. Press E at the oxygen station to open the plant. Flip the maker off and on. A line is punctured: listen for the hiss, hold to spray detector until it foams, then circle the foam to wind tape.",
    "Open the oxygen plant, toggle the maker twice and seal the leak.",
  ],
  [
    "Grow your next meal",
    "Press E at the crop beds to harvest. Swipe across a red truss stalk just above its knuckle for a clean cut. Leave green trusses and the main stem alone; trim yellow leaves for a faster regrow. Growing needs power.",
    "Harvest a ripe bed at the crop beds.",
  ],
  [
    "Find protection",
    "Particle events raise radiation, and time outside builds stress. The habitat walls are your shelter: inside, incoming dose drops and stress recovers. Recorded dose stays. Listen to the counter clicks.",
    "Go inside the habitat and watch stress fall.",
  ],
  [
    "Messages take time",
    "Press E at the blue beacon to send a report. Earth cannot reply instantly. Keep working while the reply travels.",
    "Send a report, then wait for the delayed reply.",
  ],
  [
    "Your seven-sol mission",
    "Keep oxygen, food and power available for seven Mars days. Watch warnings, clean panels, harvest food, seal oxygen leaks and stay indoors during particle events.",
    "Training complete. Begin with fresh supplies.",
  ],
];
export function mission(
  base: Base,
  gui: GUI,
  scene: THREE.Scene,
  world: RAPIER.World,
  clear: () => void,
  reset: (at?: { x: number; y: number; z: number }) => void,
  hooks: {
    player: () => { x: number; y: number; z: number };
    scrub: (intensity: number) => void;
    cleaned: () => void;
    snip?: (kind: "clean" | "bruised" | "wasted" | "leaf" | "nick") => void;
    hiss?: (intensity: number, pan: number) => void;
    sealed?: () => void;
    harvested?: (at: { x: number; z: number }) => void;
  } = { player: () => ({ x: 0, y: 0, z: 0 }), scrub: () => {}, cleaned: () => {} },
) {
  if (new URLSearchParams(location.search).has("lab"))
    return {
      blocked: false,
      muted: false,
      prompt: "",
      state: "lab",
      interact: (_p: { x: number; y: number; z: number }) => false,
      update: (
        _dt: number,
        _p: { x: number; y: number; z: number },
        _speed: number,
      ) => {},
    };
  const calendar = { ...eventDefaults };
  const balance = {
    foodDrain: 25,
    mealSize: 35,
    cropSols: 1,
    cropWatts: 400,
    dustTransmission: 0.45,
    coldWatts: 300,
  };
  let mode:
    | "menu"
    | "dialogue"
    | "practice"
    | "mission"
    | "cleaning"
    | "harvest"
    | "oxygen"
    | "paused"
    | "results" = "menu";
  let cleanReturn: "practice" | "mission" = "mission",
    debugPaused = false,
    saveTimer = 0,
    promptText = "";
  const inService = () =>
    mode === "cleaning" || mode === "harvest" || mode === "oxygen";
  const playing = () => mode === "practice" || mode === "mission" || inService();
  const kind = () => (inService() ? cleanReturn : mode);
  function closeService() {
    if (mode === "cleaning") cleaning.close();
    else if (mode === "harvest") harvest.close();
    else if (mode === "oxygen") oxygenPlant.close();
  }
  let returnMode: "practice" | "mission" = "mission",
    lesson = 0,
    moved = 0,
    toggles = 0,
    cleanStart = 0,
    stressStart = 0;
  const tried = new Set<string>();
  let complete = false,
    reportAt = -1,
    replied = false,
    modified = false;
  let forced: "dust" | "cold" | "none" = "none",
    forceEnd = 0;
  let eventText = "",
    lastEvent = "",
    eventTimer = 0;
  const overlay = document.createElement("section");
  overlay.id = "game-overlay";
  const hud = document.createElement("section");
  hud.id = "mission-hud";
  hud.innerHTML = `<div class="mission-top"><b>NEBULA</b><span id="mission-clock"></span><span id="mission-leak" role="status"></span><button id="game-pause">Pause</button><button id="game-debug">Debug / settings</button></div><div id="mission-event" role="status"></div><div class="mission-dock">${["Battery", "Oxygen", "Nourishment", "Stress"].map((v, i) => `<label><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${["M4 6h15v14H4z M9 3h5", "M12 3C8 10 4 12 5 16a7 7 0 0014 0C20 12 16 10 12 3Z", "M5 20V9h14v11z M12 9V3 M12 6L7 3 M12 7l5-4", "M12 3l9 17H3z M12 9v5 M12 17v1"][i]}"/></svg>${v}<meter id="mission-${v}" min="0" max="100"></meter><span id="value-${v}"></span></label>`).join("")}</div><p id="mission-prompt"></p><small id="mission-dose"></small><span id="mission-saved" aria-live="polite"></span>`;
  const apod = createApodWidget(document.body);
  let solsDone = 0;
  document.body.append(hud, overlay);
  document.body.classList.add("game-shell");
  gui.domElement.style.display = "none";
  const button = (text: string, action: () => void) => {
    const b = document.createElement("button");
    b.textContent = text;
    b.onclick = action;
    overlay.append(b);
  };
  function screen(title: string, text: string) {
    overlay.hidden = false;
    overlay.classList.remove("enter");
    void overlay.offsetWidth;
    overlay.classList.add("enter");
    overlay.replaceChildren();
    const h = document.createElement("h1");
    h.textContent = title;
    const p = document.createElement("p");
    p.textContent = text;
    overlay.append(h, p);
    clear();
  }
  function menu() {
    base.stop();
    mode = "menu";
    apod.reset();
    screen(
      "NEBULA",
      "A Mars survival field lab · Learn. Prepare. Stay curious.",
    );
    const saved = readSave();
    if (saved) {
      const sol = Math.floor((saved.sim.elapsed as number) / SOL_SECONDS) + 1;
      button(
        `Continue mission · Sol ${sol} / ${saved.config.sols}`,
        () => continueMission(saved),
      );
    }
    button("Play", () => training());
    button("Start challenge", () => challenge());
  }
  function training() {
    lesson = 0;
    reset();
    tutorial();
  }
  function tutorial() {
    base.start();
    base.pause();
    base.sim.state = "paused";
    base.sim.reason = "";
    base.sim.oxygen = Math.max(1, base.sim.oxygen);
    base.sim.config.eventDoseMGy = 0;
    base.sim.nourishment = 65;
    base.sim.stress = 30;
    base.sim.dust = 0.6;
    base.sim.punctures = lesson === 3 ? 1 : 0;
    base.sim.nextLeakAt = Number.POSITIVE_INFINITY;
    base.sim.crops = [1, 1];
    cleanStart = base.sim.cleanCount;
    stressStart = base.sim.stress;
    moved = 0;
    toggles = 0;
    tried.clear();
    reportAt = -1;
    replied = false;
    complete = false;
    mode = "dialogue";
    screen(lessons[lesson][0], lessons[lesson][1]);
    button(lesson === 7 ? "Begin mission" : "Try it", () => {
      if (lesson === 7) challenge();
      else {
        mode = "practice";
        overlay.hidden = true;
        base.resume();
        clear();
        document.querySelector<HTMLCanvasElement>("#world")?.focus();
      }
    });
  }
  function continueMission(save: MissionSave) {
    reset(save.player);
    base.restore(save);
    Object.assign(balance, save.balance);
    Object.assign(calendar, save.calendar);
    forced = save.forced;
    forceEnd = save.forceEnd;
    modified = save.modified;
    reportAt = save.reportAt;
    replied = save.replied;
    solsDone = Math.floor(base.sim.elapsed / SOL_SECONDS);
    apod.reset(solsDone);
    mode = "mission";
    lastEvent = "";
    eventText = "";
    overlay.hidden = true;
    clear();
    document.querySelector<HTMLCanvasElement>("#world")?.focus();
    flash("Mission resumed from local save");
  }
  function snapshot() {
    if (kind() !== "mission" && !(mode === "paused" && returnMode === "mission"))
      return;
    if (base.sim.state !== "running" && base.sim.state !== "paused") return;
    const ok = writeSave(
      captureSave(base.sim, {
        balance: { ...balance },
        calendar: { ...calendar },
        forced,
        forceEnd,
        modified,
        reportAt,
        replied,
        player: hooks.player(),
      }),
    );
    if (ok) flash("Saved");
  }
  let flashTimer = 0;
  function flash(text: string) {
    const el = hud.querySelector<HTMLElement>("#mission-saved")!;
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => el.classList.remove("show"), 1600);
  }
  function challenge() {
    clearSave();
    base.start();
    reset();
    mode = "mission";
    forced = "none";
    reportAt = -1;
    modified = false;
    solsDone = 0;
    apod.reset();
    lastEvent = "";
    eventText = "";
    replied = false;
    overlay.hidden = true;
    clear();
    document.querySelector<HTMLCanvasElement>("#world")?.focus();
  }
  function resumePlay() {
    if (mode !== "paused") return;
    mode = returnMode;
    overlay.hidden = true;
    base.resume();
    clear();
    document.querySelector<HTMLCanvasElement>("#world")?.focus();
  }
  function pause() {
    closeService();
    if (mode !== "mission" && mode !== "practice") return;
    returnMode = mode;
    mode = "paused";
    base.pause();
    snapshot();
    screen("Paused", "Your supplies and events are paused.");
    button("Resume", () => {
      debugPaused = false;
      resumePlay();
    });
    button("Restart tutorials", training);
    button("Restart challenge", challenge);
    button("Main menu", () => {
      snapshot();
      menu();
    });
  }
  hud.querySelector<HTMLButtonElement>("#game-pause")!.onclick = pause;
  const debugButton = hud.querySelector<HTMLButtonElement>("#game-debug")!;
  function setDebug(open: boolean) {
    gui.domElement.style.display = open ? "block" : "none";
    debugButton.classList.toggle("on", open);
    if (open) {
      gui.open();
      if (playing()) {
        pause();
        debugPaused = true;
      }
    } else {
      // Return to play if the debug window was what paused the game.
      if (debugPaused && mode === "paused") resumePlay();
      debugPaused = false;
    }
  }
  debugButton.onclick = () =>
    setDebug(gui.domElement.style.display === "none");
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      if (inService()) closeService();
      else if (gui.domElement.style.display !== "none" && debugPaused)
        setDebug(false);
      else pause();
    }
    if (mode === "practice") tried.add(e.code);
  });
  window.addEventListener("pagehide", snapshot);
  window.addEventListener("beforeunload", snapshot);
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  const f = gui.addFolder("Mission · events and crops");
  f.close();
  const debug = {
    duration: 0.25,
    dust: () => force("dust"),
    cold: () => force("cold"),
    puncture: () => {
      base.sim.punctures = Math.min(base.sim.config.maxPunctures || 3, base.sim.punctures + 1);
      modified = true;
    },
    particles: () => {
      base.sim.config.eventSol = base.sim.elapsed / SOL_SECONDS;
      base.sim.config.eventDoseMGy = 8.1;
      modified = true;
    },
    clear: () => {
      forced = "none";
      base.sim.config.eventDoseMGy = 0;
      modified = true;
    },
    mature: () => {
      base.sim.crops = [1, 1];
      modified = true;
    },
    food: () => {
      base.sim.nourishment = 80;
      modified = true;
    },
    tutorials: training,
    challenge,
  };
  f
    .add(debug, "duration", 0.02, 1, 0.01)
    .name("Disaster duration · sols").$name.title =
    "Duration of manually triggered dust or cold events.";
  for (const k of [
    "dust",
    "cold",
    "puncture",
    "particles",
    "clear",
    "mature",
    "food",
    "tutorials",
    "challenge",
  ] as const)
    f.add(debug, k).$name.title = {
      dust: "Queue a dust storm; reduces sunlight after resuming.",
      cold: "Queue a cold snap; adds heater demand after resuming.",
      puncture: "Puncture an oxygen plant line now (vents reserve until sealed).",
      particles:
        "Start the RAD-reference particle curve at the current simulation time. Resume to advance it.",
      clear:
        "End manually forced weather and disable particle dose for this run. Scheduled weather still follows its calendar.",
      mature: "Set both crop beds ready to harvest immediately.",
      food: "Restore nourishment to 80 points.",
      tutorials: "Restart at the first tutorial with fresh practice supplies.",
      challenge: "Start a fresh survival challenge; discards the current run.",
    }[k];
  for (const [k, min, max] of [
    ["foodDrain", 0, 100],
    ["mealSize", 1, 100],
    ["cropSols", 0.05, 5],
    ["cropWatts", 0, 2000],
    ["dustTransmission", 0, 1],
    ["coldWatts", 0, 2000],
  ] as const)
    f.add(balance, k, min, max).onChange(() => {
      modified = true;
    }).$name.title =
      "Gameplay balance: food points per sol, meal points, powered regrowth sols, or total growing watts. Applies to this run.";
  const calendarFolder = gui.addFolder("Mission · event calendar");
  calendarFolder.close();
  for (const key of Object.keys(calendar) as (keyof typeof calendar)[])
    calendarFolder.add(calendar, key, 0, 10, 0.01).onChange(() => {
      modified = true;
    }).$name.title =
      "Local schedule in sols. Start and duration settings control dust/cold events; warningSols sets advance notice. Applies to this run.";
  function force(v: "dust" | "cold") {
    forced = v;
    forceEnd = base.sim.elapsed + debug.duration * SOL_SECONDS;
    modified = true;
  }
  const beds = new THREE.Group();
  const layout = stationLayout();
  beds.position.set(layout.farm.x, 0, layout.farm.z);
  scene.add(beds);
  const leaves: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.5, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x8b9d91 }),
    );
    bed.position.set(i * 1.6, 0.25, 0);
    beds.add(bed);
    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.09, 1.12),
      new THREE.MeshStandardMaterial({ color: 0x433c30 }),
    );
    soil.position.set(i * 1.6, 0.51, 0);
    beds.add(soil);
    const plant = new THREE.Group();
    for (const x of [-0.3, 0.3])
      for (const z of [-0.3, 0.3]) {
        const stalk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.035, 0.3, 5),
          new THREE.MeshStandardMaterial({ color: 0x6c9460 }),
        );
        stalk.position.set(x, 0.18, z);
        plant.add(stalk);
        for (const side of [-1, 1]) {
          const leaf = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.22, 0),
            new THREE.MeshStandardMaterial({
              color: side === 1 ? 0x83b76c : 0x527f4a,
            }),
          );
          leaf.scale.set(1, 0.4, 0.7);
          leaf.rotation.z = side * 0.4;
          leaf.position.set(x + side * 0.12, 0.28, z);
          plant.add(leaf);
        }
      }
    plant.position.set(i * 1.6, 0.55, 0);
    beds.add(plant);
    leaves.push(plant);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.65, 0.25, 0.65).setTranslation(
        layout.farm.x + i * 1.6,
        0.25,
        layout.farm.z,
      ),
    );
  }
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0x716b63 }),
  );
  pad.position.set(10, 0.04, -8);
  scene.add(pad);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.6, 24),
    new THREE.MeshBasicMaterial({
      color: 0xaee7dd,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(ARRAY_POSITION.x, 0.035, ARRAY_POSITION.z - 2);
  scene.add(ring);
  const cleaning = cleaningGame({
    progress: (f) => base.sim.scrub(f),
    complete: () => {
      base.sim.finishService(true);
      hooks.cleaned();
      eventText = "Array cleaned · full sunlight reaching the cells.";
    },
    close: () => {
      base.sim.finishService(false);
      if (mode === "cleaning") mode = cleanReturn;
      hooks.scrub(0);
      clear();
      document.querySelector<HTMLCanvasElement>("#world")?.focus();
    },
    scrub: (i) => hooks.scrub(i),
  });
  let bed = 0,
    harvestApplied = false;
  function applyHarvest(r: HarvestResult) {
    if (harvestApplied || r.ripeCut <= 0) return;
    harvestApplied = true;
    const amount = r.ripeTotal ? r.yield * (r.ripeCut / r.ripeTotal) : 0;
    const before = base.sim.nourishment;
    if (base.sim.harvestBed(bed, r.ripeCut >= r.ripeTotal ? r.yield : amount, r.headStart)) {
      if (lesson === 4 && mode !== "mission" && cleanReturn === "practice") complete = true;
      eventText = `Harvest in · +${Math.round(base.sim.nourishment - before)} nourishment · bed replanted${r.headStart > 0.01 ? ` (+${Math.round(r.headStart * 100)}% head start)` : ""}.`;
      hooks.harvested?.({ x: layout.farm.x + bed * 1.6, z: layout.farm.z });
    }
  }
  const harvest = harvestGame({
    complete: (r) => applyHarvest(r),
    close: (r) => {
      applyHarvest(r);
      if (mode === "harvest") mode = cleanReturn;
      clear();
      document.querySelector<HTMLCanvasElement>("#world")?.focus();
    },
    snip: (k) => hooks.snip?.(k),
  });
  const oxygenPlant = oxygenPlantGame({
    state: () => {
      const f = base.sim.flows();
      return {
        fraction: base.sim.oxygen / base.sim.config.oxygenCapacity,
        on: base.sim.generator,
        powered: f.powered,
        netKgH: base.sim.oxygenFlow(f.powered, true).net,
      };
    },
    toggle: () => {
      const before = base.sim.generator;
      base.sim.toggle();
      if (before !== base.sim.generator) toggles++;
      return base.sim.generator;
    },
    sealed: () => {
      base.sim.repair();
      hooks.sealed?.();
      eventText = base.sim.punctures
        ? `Leak sealed · ${base.sim.punctures} still venting.`
        : "All oxygen lines sealed · pressure holding.";
    },
    close: () => {
      if (mode === "oxygen") mode = cleanReturn;
      hooks.scrub(0);
      clear();
      document.querySelector<HTMLCanvasElement>("#world")?.focus();
    },
    work: (i) => hooks.scrub(i * 0.55),
    hiss: (i, pan) => hooks.hiss?.(i, pan),
  });
  function openHarvest() {
    if (mode !== "practice" && mode !== "mission") return false;
    const i = base.sim.crops.findIndex((v) => v >= 1);
    if (i < 0) return false;
    bed = i;
    harvestApplied = false;
    cleanReturn = mode;
    mode = "harvest";
    clear();
    harvest.show();
    return true;
  }
  function openOxygen() {
    if (mode !== "practice" && mode !== "mission") return false;
    cleanReturn = mode;
    mode = "oxygen";
    clear();
    oxygenPlant.show(base.sim.punctures);
    return true;
  }
  function openCleaning() {
    if (mode !== "practice" && mode !== "mission") return;
    cleanReturn = mode;
    mode = "cleaning";
    clear();
    base.sim.beginService();
    cleaning.show(
      base.sim.dirtiness(),
      base.sim.dust,
      base.sim.config.cleanRestore,
    );
  }
  // Ground the world-space GLB bounds; proxy collision intentionally remains simple.
  new GLTFLoader().load(
    import.meta.env.BASE_URL + "models/Lander.glb",
    (g) => {
      const m = g.scene;
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      m.scale.setScalar(4 / Math.max(size.x, size.y, size.z));
      const b = new THREE.Box3().setFromObject(m);
      const center = b.getCenter(new THREE.Vector3());
      m.position.set(10 - center.x, -b.min.y, -8 - center.z);
      scene.add(m);
    },
    undefined,
    () => console.warn("Lander unavailable"),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(1.5, 1.3, 1.5).setTranslation(10, 1.3, -8),
  );
  function interact(p: { x: number; y: number; z: number }) {
    if (mode !== "mission" && mode !== "practice") return false;
    if (Math.abs(p.y) > 1.5) return false;
    if (
      Math.hypot(p.x - layout.farmTarget.x, p.z - layout.farmTarget.z) < 2.5
    ) {
      if (!openHarvest())
        eventText = `Crops still growing · beds ${base.sim.crops.map((v) => Math.round(v * 100) + "%").join(" / ")}${base.sim.flows().cropsPowered ? "" : " · grow lights need power"}`;
      return true;
    }
    if (Math.hypot(p.x - 3, p.z - 2) < 2.5) {
      if (reportAt < 0) {
        reportAt = base.sim.elapsed;
        eventText = "Report sent. Reply in 8 simulated minutes.";
      }
      return true;
    }
    if (base.target(p) === "array") {
      openCleaning();
      return true;
    }
    if (base.target(p) === "oxygen" && openOxygen()) return true;
    return false;
  }
  f
    .add(
      {
        sandbox: () => {
          location.search = "?lab";
        },
      },
      "sandbox",
    )
    .name("Open legacy laboratory").$name.title =
    "Open the original movement sandbox and engineering exercises in this tab.";
  menu();
  return {
    get blocked() {
      return mode !== "mission" && mode !== "practice";
    },
    /** World audio is muted only outside play (cleaning keeps ambience). */
    get muted() {
      return !playing();
    },
    get prompt() {
      return promptText;
    },
    get cleaning() {
      return cleaning;
    },
    get harvest() {
      return harvest;
    },
    get oxygenPlant() {
      return oxygenPlant;
    },
    get event() {
      return lastEvent;
    },
    get apod() {
      return apod.state;
    },
    get state() {
      return mode;
    },
    interact,
    update(dt: number, p: { x: number; y: number; z: number }, speed: number) {
      Object.assign(base.sim, balance);
      if (mode === "menu") {
        document.body.classList.remove("dust-event", "radiation-event");
      }
      hud.hidden = mode === "menu";
      if (mode === "practice" && base.sim.state === "paused") base.resume();
      if (mode === "practice") {
        moved += speed * dt;
        complete ||=
          lesson === 0
            ? moved > 3 &&
              ["Space", "KeyC"].every((k) => tried.has(k)) &&
              (tried.has("ShiftLeft") || tried.has("ShiftRight"))
            : lesson === 1
              ? Math.hypot(
                  p.x - ARRAY_POSITION.x,
                  p.z - (ARRAY_POSITION.z - 2),
                ) < 3
              : lesson === 2
                ? base.sim.cleanCount > cleanStart
                : lesson === 3
                  ? toggles >= 2 && base.sim.punctures === 0 && mode === "practice"
                  : lesson === 5
                    ? base.sim.inShelter && base.sim.stress < stressStart - 2
                    : lesson === 6
                      ? replied
                      : false;
        base.sim.oxygen = Math.max(1, base.sim.oxygen);
        base.sim.nourishment = Math.max(30, base.sim.nourishment);
        if (complete) {
          mode = "dialogue";
          base.pause();
          screen(
            "Good work",
            "You have tried this system. In the mission, your supplies and choices carry over each sol.",
          );
          button("Next lesson", () => {
            lesson++;
            tutorial();
          });
        }
      }
      const sol = base.sim.elapsed / SOL_SECONDS;
      if (reportAt >= 0 && !replied && base.sim.elapsed - reportAt >= 480) {
        replied = true;
        eventText =
          "Earth reply received: report confirmed. Keep maintaining the base.";
      }
      if (kind() === "mission") {
        // Each completed sol, Earth beams up a NASA Astronomy Picture of the Day.
        const done = Math.min(base.sim.config.sols, Math.floor(sol));
        if (done > solsDone) {
          solsDone = done;
          void apod.deliver(done, base.sim.config.sols);
        }
        saveTimer += dt;
        if (saveTimer > 5) {
          saveTimer = 0;
          snapshot();
        }
      }
      if (kind() === "mission" || kind() === "practice") {
        if (forced !== "none" && base.sim.elapsed >= forceEnd) forced = "none";
        const scheduled = scheduledEvent(sol, calendar);
        base.sim.hazard =
          forced !== "none"
            ? forced
            : kind() === "mission"
              ? scheduled.active
              : "none";
        const ev =
          kind() === "mission" &&
          scheduled.warning !== "none" &&
          forced === "none"
            ? `WEATHER WARNING · ${scheduled.warning} approaching. Check power and crops.`
            : base.sim.punctures > 0 && kind() === "mission"
              ? "O₂ PLANT PUNCTURE · reserve venting. Seal it at the oxygen station."
            : base.sim.hazard === "dust"
              ? "DUST STORM · sunlight reduced. Clean panels after the storm."
              : base.sim.hazard === "cold"
                ? "COLD SNAP · heaters draw an extra 300 W."
                : base.sim.eventState() === "PARTICLE EVENT"
                  ? "PARTICLE EVENT · get inside the habitat"
                  : base.sim.eventState().startsWith("Warning")
                    ? "PARTICLE WARNING · head indoors soon"
                    : sol < 1
                      ? "First sol · store energy for sunset"
                      : sol >= 6
                        ? "Final sol · keep supplies ready"
                        : "Maintain panels, crops and oxygen";
        if (ev !== lastEvent) {
          lastEvent = ev;
          eventText = ev;
          eventTimer = 0;
        }
        eventTimer += dt;
        const leakBadge = hud.querySelector<HTMLElement>("#mission-leak")!;
        const leakText = base.sim.punctures
          ? `O₂ LEAK ×${base.sim.punctures}`
          : "";
        if (leakBadge.textContent !== leakText) {
          leakBadge.textContent = leakText;
          leakBadge.classList.toggle("show", Boolean(leakText));
        }
        document.body.classList.toggle(
          "dust-event",
          base.sim.hazard === "dust",
        );
        document.body.classList.toggle(
          "radiation-event",
          base.sim.eventState() === "PARTICLE EVENT",
        );
        if (base.sim.state === "lost" || base.sim.state === "completed") {
          const wasMission = kind() === "mission";
          closeService();
          if (wasMission) clearSave();
          mode = "results";
          screen(
            base.sim.state === "completed"
              ? "Seven sols complete"
              : "Run ended",
            `${base.sim.reason || "Base maintained."} Recorded dose ${base.sim.dose.toFixed(2)} mGy. ${base.sim.cleanCount} cleanings.${modified ? " Debug-modified run." : ""}`,
          );
          button("Restart tutorials", training);
          button("Restart challenge", challenge);
          button("Main menu", menu);
        }
      }
      const values = [
        (base.sim.battery / base.sim.config.batteryCapacity) * 100,
        (base.sim.oxygen / base.sim.config.oxygenCapacity) * 100,
        base.sim.nourishment,
        base.sim.stress,
      ];
      ["Battery", "Oxygen", "Nourishment", "Stress"].forEach((v, i) => {
        (hud.querySelector("#mission-" + v) as HTMLMeterElement).value =
          values[i];
        hud
          .querySelector("#mission-" + v)!
          .closest("label")!
          .classList.toggle(
            "low",
            mode !== "menu" && (i < 3 ? values[i] < 20 : values[i] > 80),
          );
        hud.querySelector("#value-" + v)!.textContent =
          values[i].toFixed(0) + "%";
      });
      hud.querySelector("#mission-clock")!.textContent =
        `Sol ${Math.min(base.sim.config.sols, Math.floor(sol) + 1)} / ${base.sim.config.sols} · ${base.sim.flows().sun.hour.toFixed(1)}h${modified ? " · DEBUG" : ""}`;
      hud.querySelector("#mission-event")!.textContent = eventText;
      hud.querySelector("#mission-dose")!.textContent =
        `Recorded dose ${base.sim.dose.toFixed(3)} / ${base.sim.config.doseLimitMGy} mGy · ${base.sim.inShelter ? "Sheltered · stress recovering" : "Outside"} · NASA RAD reference, modeled scenario`;
      const nearArray =
        Math.hypot(p.x - ARRAY_POSITION.x, p.z - (ARRAY_POSITION.z - 2)) < 3;
      ring.scale.setScalar(nearArray ? 1 + 0.08 * Math.sin(performance.now() / 180) : 1);
      (ring.material as THREE.MeshBasicMaterial).opacity = nearArray ? 1 : 0.55;
      promptText =
        mode === "cleaning"
          ? ""
          : mode === "practice"
          ? lessons[lesson][2]
          : Math.hypot(p.x - layout.farmTarget.x, p.z - layout.farmTarget.z) <
              2.5
            ? `E · Harvest crops · beds ${base.sim.crops.map((v) => Math.round(v * 100) + "%").join(" / ")} · ${base.sim.flows().cropsPowered ? "growing" : "ready or power unavailable"}`
            : Math.hypot(p.x - ARRAY_POSITION.x, p.z - (ARRAY_POSITION.z - 2)) <
                3
              ? `E · Open panel service · sunlight reaching cells ${Math.round(base.sim.dust * 100)}%`
              : Math.hypot(p.x - layout.oxygen.x, p.z - layout.oxygen.z) < 2.5
                ? "E · Toggle oxygen maker"
                : Math.hypot(p.x - 3, p.z - 2) < 2.5
                  ? "E · Send station report"
                  : document.body.classList.contains("touch")
                    ? "Stick move · RUN · JUMP · CROUCH · USE"
                    : "WASD move · Shift run · Space jump · C crouch";
      hud.querySelector("#mission-prompt")!.textContent = promptText;
      hud.classList.toggle("is-cleaning", mode === "cleaning");
      leaves.forEach((m, i) =>
        m.scale.setScalar(0.2 + 0.8 * base.sim.crops[i]),
      );
    },
  };
}
