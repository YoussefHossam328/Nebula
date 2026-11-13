import * as THREE from "three";
import { eventDefaults, scheduledEvent } from "./events";
import type GUI from "lil-gui";
import type { baseUI } from "./base/ui";
import { SOL_SECONDS } from "./base/config";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import RAPIER from "@dimforge/rapier3d-compat";
type Base = ReturnType<typeof baseUI>;
const lessons = [
  [
    "Welcome to Mars",
    "Walk with WASD. Hold Shift to run, Space to jump, and C to crouch. Try each before continuing.",
    "Move, run, jump and crouch.",
  ],
  [
    "Catch the sunlight",
    "The panels follow the Sun. Sunlight charges our battery. At night, equipment uses the stored energy.",
    "Walk to the solar array at the left of the base.",
  ],
  [
    "Keep panels clean",
    "Dust blocks sunlight. Stand by the service ring and hold E until cleaning finishes. Clean panels make more power.",
    "Hold E beside the solar service ring.",
  ],
  [
    "Make oxygen",
    "Our oxygen maker needs electricity. Press E at the oxygen station to turn it off, then on. Watch the reserve and power load.",
    "Toggle the oxygen maker twice.",
  ],
  [
    "Grow your next meal",
    "Press E at the green crop beds to eat. Each harvest replants itself. Growing needs power, so keep the battery charged.",
    "Eat one ready crop beside the green beds.",
  ],
  [
    "Find protection",
    "Particle events raise radiation. Walk into the storm shelter. Game stress falls there. Recorded dose stays: shelter reduces new exposure.",
    "Enter the shelter on the right and watch stress fall.",
  ],
  [
    "Messages take time",
    "Press E at the blue beacon to send a report. Earth cannot reply instantly. Keep working while the reply travels.",
    "Send a report, then wait for the delayed reply.",
  ],
  [
    "Your seven-sol mission",
    "Keep oxygen, food and power available for seven Mars days. Watch warnings, clean panels, grow food and shelter during particle events.",
    "Training complete. Begin with fresh supplies.",
  ],
];
export function mission(
  base: Base,
  gui: GUI,
  scene: THREE.Scene,
  world: RAPIER.World,
  clear: () => void,
  reset: () => void,
) {
  if (new URLSearchParams(location.search).has("lab"))
    return {
      blocked: false,
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
    "menu" | "dialogue" | "practice" | "mission" | "paused" | "results" =
    "menu";
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
  hud.innerHTML = `<div class="mission-top"><b>NEBULA</b><span id="mission-clock"></span><button id="game-pause">Pause</button><button id="game-debug">Debug / settings</button></div><div id="mission-event" role="status"></div><div class="mission-dock">${["Battery", "Oxygen", "Nourishment", "Stress"].map((v, i) => `<label><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${["M4 6h15v14H4z M9 3h5", "M12 3C8 10 4 12 5 16a7 7 0 0014 0C20 12 16 10 12 3Z", "M5 20V9h14v11z M12 9V3 M12 6L7 3 M12 7l5-4", "M12 3l9 17H3z M12 9v5 M12 17v1"][i]}"/></svg>${v}<meter id="mission-${v}" min="0" max="100"></meter><span id="value-${v}"></span></label>`).join("")}</div><p id="mission-prompt"></p><small id="mission-dose"></small>`;
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
    screen(
      "NEBULA",
      "A Mars survival field lab · Learn. Prepare. Stay curious.",
    );
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
  function challenge() {
    base.start();
    reset();
    mode = "mission";
    forced = "none";
    reportAt = -1;
    modified = false;
    lastEvent = "";
    eventText = "";
    replied = false;
    overlay.hidden = true;
    clear();
    document.querySelector<HTMLCanvasElement>("#world")?.focus();
  }
  function pause() {
    if (mode !== "mission" && mode !== "practice") return;
    returnMode = mode;
    mode = "paused";
    base.pause();
    screen("Paused", "Your supplies and events are paused.");
    button("Resume", () => {
      mode = returnMode;
      overlay.hidden = true;
      base.resume();
      clear();
      document.querySelector<HTMLCanvasElement>("#world")?.focus();
    });
    button("Restart tutorials", training);
    button("Restart challenge", challenge);
    button("Main menu", menu);
  }
  hud.querySelector<HTMLButtonElement>("#game-pause")!.onclick = pause;
  hud.querySelector<HTMLButtonElement>("#game-debug")!.onclick = () => {
    const visible = gui.domElement.style.display !== "none";
    gui.domElement.style.display = visible ? "none" : "block";
    if (!visible) {
      pause();
      gui.open();
    }
  };
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") pause();
    if (mode === "practice") tried.add(e.code);
  });
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
  beds.position.set(-2, 0, -3);
  scene.add(beds);
  const leaves: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.5, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x8b9d91 }),
    );
    bed.position.set(i * 1.6, 0.25, 0);
    beds.add(bed);
    const plant = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1, 5),
      new THREE.MeshStandardMaterial({ color: 0x78ba72 }),
    );
    plant.position.set(i * 1.6, 1, 0);
    beds.add(plant);
    leaves.push(plant);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.65, 0.25, 0.65).setTranslation(
        -2 + i * 1.6,
        0.25,
        -3,
      ),
    );
  }
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0x716b63 }),
  );
  pad.position.set(10, 0.04, -8);
  scene.add(pad);
  const dustGeometry = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(96 * 3);
  for (let i = 0; i < 96; i++) {
    dustPositions[i * 3] = ((i * 7.13) % 30) - 15;
    dustPositions[i * 3 + 1] = 0.4 + ((i * 1.37) % 5);
    dustPositions[i * 3 + 2] = ((i * 3.79) % 30) - 15;
  }
  dustGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(dustPositions, 3),
  );
  const dustParticles = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0xe4b98a,
      size: 0.07,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  scene.add(dustParticles);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.6, 24),
    new THREE.MeshBasicMaterial({ color: 0xaee7dd, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-6, 0.035, 0);
  scene.add(ring);
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
    if (Math.hypot(p.x + 1.2, p.z + 3) < 2.5) {
      const eaten = base.sim.harvest();
      if (eaten && lesson === 4) complete = true;
      eventText = eaten
        ? "Meal eaten. Crops replanted."
        : "Crops growing, or nourishment already full.";
      return true;
    }
    if (Math.hypot(p.x - 3, p.z - 2) < 2.5) {
      if (reportAt < 0) {
        reportAt = base.sim.elapsed;
        eventText = "Report sent. Reply in 8 simulated minutes.";
      }
      return true;
    }
    if (base.target(p) === "oxygen") {
      const before = base.sim.generator;
      base.interact(p);
      if (before !== base.sim.generator) toggles++;
      return true;
    }
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
    get event() {
      return lastEvent;
    },
    get state() {
      return mode;
    },
    interact,
    update(dt: number, p: { x: number; y: number; z: number }, speed: number) {
      Object.assign(base.sim, balance);
      dustParticles.visible = mode === "mission" && base.sim.hazard === "dust";
      if (dustParticles.visible) {
        for (let i = 0; i < 96; i++) {
          dustPositions[i * 3] += dt * 4;
          if (dustPositions[i * 3] > 15) dustPositions[i * 3] = -15;
        }
        dustGeometry.attributes.position.needsUpdate = true;
      }
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
              ? Math.hypot(p.x + 6, p.z) < 3
              : lesson === 2
                ? base.sim.cleanCount > cleanStart
                : lesson === 3
                  ? toggles >= 2
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
      if (mode === "mission" || mode === "practice") {
        if (forced !== "none" && base.sim.elapsed >= forceEnd) forced = "none";
        const scheduled = scheduledEvent(sol, calendar);
        base.sim.hazard =
          forced !== "none"
            ? forced
            : mode === "mission"
              ? scheduled.active
              : "none";
        const ev =
          mode === "mission" &&
          scheduled.warning !== "none" &&
          forced === "none"
            ? `WEATHER WARNING · ${scheduled.warning} approaching. Check power and crops.`
            : base.sim.hazard === "dust"
              ? "DUST STORM · sunlight reduced. Clean panels after the storm."
              : base.sim.hazard === "cold"
                ? "COLD SNAP · heaters draw an extra 300 W."
                : base.sim.eventState() === "PARTICLE EVENT"
                  ? "PARTICLE EVENT · seek shelter"
                  : base.sim.eventState().startsWith("Warning")
                    ? "PARTICLE WARNING · prepare shelter"
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
        document.body.classList.toggle(
          "dust-event",
          base.sim.hazard === "dust",
        );
        document.body.classList.toggle(
          "radiation-event",
          base.sim.eventState() === "PARTICLE EVENT",
        );
        if (base.sim.state === "lost" || base.sim.state === "completed") {
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
        hud.querySelector("#value-" + v)!.textContent =
          values[i].toFixed(0) + "%";
      });
      hud.querySelector("#mission-clock")!.textContent =
        `Sol ${Math.min(base.sim.config.sols, Math.floor(sol) + 1)} / ${base.sim.config.sols} · ${base.sim.flows().sun.hour.toFixed(1)}h${modified ? " · DEBUG" : ""}`;
      hud.querySelector("#mission-event")!.textContent = eventText;
      hud.querySelector("#mission-dose")!.textContent =
        `Recorded dose ${base.sim.dose.toFixed(3)} / ${base.sim.config.doseLimitMGy} mGy · ${base.sim.inShelter ? "Sheltered · stress recovering" : "Outside"} · NASA RAD reference, modeled scenario`;
      hud.querySelector("#mission-prompt")!.textContent =
        mode === "practice"
          ? lessons[lesson][2]
          : Math.hypot(p.x + 1.2, p.z + 3) < 2.5
            ? `E · Eat crop / auto replant · beds ${base.sim.crops.map((v) => Math.round(v * 100) + "%").join(" / ")} · ${base.sim.flows().cropsPowered ? "growing" : "ready or power unavailable"}`
            : Math.hypot(p.x + 6, p.z) < 3
              ? `Hold E · Clean array ${Math.round((base.sim.cleanProgress / base.sim.config.cleanSeconds) * 100)}%`
              : Math.hypot(p.x + 2, p.z - 2) < 2.5
                ? "E · Toggle oxygen maker"
                : Math.hypot(p.x - 3, p.z - 2) < 2.5
                  ? "E · Send station report"
                  : "WASD move · Shift run · Space jump · C crouch";
      leaves.forEach((m, i) =>
        m.scale.setScalar(0.2 + 0.8 * base.sim.crops[i]),
      );
    },
  };
}
