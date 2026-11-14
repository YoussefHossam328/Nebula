import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d";
import { load } from "./config";
import { Input } from "./input";
import { Character, DT } from "./physics";
import { createWorld } from "./world";
import { loadTerrainData } from "./terrain";
import { astronaut } from "./assets";
import { FollowCamera } from "./camera";
import { panel } from "./settings";
import "./style.css";
import { baseUI } from "./base/ui";
import { baseVisuals } from "./base/visuals";
import { SOL_SECONDS } from "./base/config";
import { describePanel } from "./setting-help";
import { smoothHeading } from "./turning";
import { GameAudio } from "./audio";
import { mission } from "./mission";
import { training } from "./resources/ui";
import { createFX } from "./fx";
import { touchControls } from "./touch";
import { ARRAY_POSITION } from "./base/visuals";
import { doseRate } from "./base/model";
declare global {
  interface Window {
    __nebulaProgress?: (stage: string, fraction: number) => void;
    __nebulaReady?: () => void;
  }
}
const progress = (f: number) => window.__nebulaProgress?.("scene", f);
const status = document.querySelector<HTMLElement>("#status")!;
let noticeUntil = 0;
function notice(text: string) {
  const n = document.querySelector<HTMLElement>("#notice")!;
  n.textContent = text;
  n.style.display = "block";
  noticeUntil = performance.now() + 5000;
}
async function start() {
  const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
  const s = load();
  const audio = new GameAudio(s);
  progress(0.05);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0xb87b60);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb87b60, 40, 160);
  const camera = new THREE.PerspectiveCamera(s.fov, 1, 0.1, 320);
  scene.add(new THREE.HemisphereLight(0xffe4c1, 0x52342b, 2.7));
  const sun = new THREE.DirectionalLight(0xffe4be, 3);
  sun.position.set(12, 24, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -20,
    right: 20,
    top: 20,
    bottom: -20,
  });
  sun.shadow.bias = -0.001;
  scene.add(sun, sun.target);
  const fx = createFX(scene);
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  // ?flat keeps the original flat pad (diagnostics / low-end devices).
  const terrainData = ["lab", "flat"].some((k) =>
    new URLSearchParams(location.search).has(k),
  )
    ? null
    : await loadTerrainData();
  const area = createWorld(scene, world, terrainData);
  progress(0.2);
  if ("ready" in area.station) await area.station.ready;
  progress(0.45);
  const baseScene = baseVisuals(scene, world);
  await baseScene.solarReady;
  progress(0.65);
  const player = new Character(world, s);
  const visual = await astronaut();
  scene.add(visual.root);
  const lamp = new THREE.SpotLight(0xdfeaff, 0, 14, 0.75, 0.6, 1.4);
  lamp.position.set(0, 1.45, 0.15);
  lamp.target.position.set(0, 0, 4);
  visual.root.add(lamp, lamp.target);
  progress(0.9);
  const input = new Input(canvas);
  let resources: Awaited<ReturnType<typeof training>> | undefined;
  try {
    resources = await training(() => input.clear());
  } catch (e) {
    notice("Training unavailable; sandbox is available. " + String(e));
  }
  const target = new THREE.Vector3();
  const follow = new FollowCamera(camera);
  const previous = new THREE.Vector3();
  const current = new THREE.Vector3();
  previous.copy(player.body.translation());
  current.copy(previous);
  let elapsed = 0,
    accumulator = 0,
    last = performance.now(),
    frames = 0,
    fps = 60,
    sample = last;
  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, s.resolution));
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
    renderer.shadowMap.enabled = s.shadows;
    fx.resize(innerHeight, renderer.getPixelRatio());
    sun.castShadow = s.shadows;
    document.querySelector("#gravity")!.textContent =
      `${s.gravity.toFixed(2)} m/s²`;
  }
  resize();
  window.addEventListener("resize", resize);
  const settingsPanel = panel(s, resize, notice);
  const resourceFolder = settingsPanel.addFolder(
    "Resources · model and tuning",
  );
  resourceFolder.close();
  resources?.mountSettings(resourceFolder.$children);
  settingsPanel
    .addFolder("Camera · preview")
    .add({ shake: () => follow.shake(s) }, "shake")
    .name("Preview shake (enable first)");
  const base = baseUI(
    settingsPanel,
    () => input.clear(),
    () => resources?.stop(),
    (c) => baseScene.configure(c),
  );
  baseScene.configure(base.sim.config);
  baseScene.update(0, base.sim.config, base.sim.dust);
  settingsPanel
    .addFolder("Audio · preview")
    .add({ previewAudio: () => audio.preview() }, "previewAudio")
    .name("Preview landing sound");
  const game = mission(
    base,
    settingsPanel,
    scene,
    world,
    () => input.clear(),
    (at) => {
      player.reset();
      player.body.setTranslation(
        at
          ? { x: at.x, y: at.y + player.height / 2 + 0.15, z: at.z }
          : { x: 8, y: player.height / 2 + 0.15, z: -5 },
        true,
      );
      player.body.setNextKinematicTranslation(player.body.translation());
      follow.reset();
      current.copy(player.body.translation());
      previous.copy(current);
    },
    {
      player: () => {
        const t = player.body.translation();
        return { x: t.x, y: Math.max(0, t.y - player.height / 2), z: t.z };
      },
      scrub: (i) => audio.scrub(i),
      cleaned: () => {
        audio.chime();
        fx.sparkle({ x: ARRAY_POSITION.x, y: 1.9, z: ARRAY_POSITION.z });
      },
      snip: (k) => audio.snip(k),
      hiss: (i, pan) => audio.hiss(i, pan),
      sealed: () => audio.sealed(),
      harvested: (at) => {
        audio.chime();
        fx.sparkle({ x: at.x, y: 1.2, z: at.z });
      },
    },
  );
  describePanel(settingsPanel);
  const touch = touchControls(input);
  audio.onStep = (running) => {
    const t = player.body.translation();
    fx.footstep({ x: t.x, y: t.y - player.height / 2, z: t.z }, running);
  };
  // Footstep sounds follow the animation's foot contacts so audio matches stride.
  audio.animationSteps = visual.stepsFromAnimation;
  visual.onStep = (running) => {
    if (!game.blocked) audio.step(running);
  };
  const actions = {
    autoScrub: (passes = 1) => game.cleaning?.autoScrub(passes),
    autoHarvest: () => game.harvest?.autoHarvest(),
    /** Jump to an hour (0-24.6) of the current sol. */
    setHour: (h: number) => {
      const sol = Math.floor(base.sim.elapsed / SOL_SECONDS);
      base.sim.elapsed = sol * SOL_SECONDS + h * 3600;
    },
    puncture: (n = 1) => {
      base.sim.punctures = Math.min(6, base.sim.punctures + n);
    },
    autoSeal: () => game.oxygenPlant?.autoSeal(),
    teleport: (x: number, z: number) => {
      const ground = area.terrain?.heightAt(x, z) ?? 0;
      player.body.setTranslation(
        { x, y: ground + player.height / 2 + 0.15, z },
        true,
      );
      current.copy(player.body.translation());
      previous.copy(current);
    },
  };
  const hemi = scene.children.find(
    (o) => o instanceof THREE.HemisphereLight,
  ) as THREE.HemisphereLight;
  let lastAudioEvent = "";
  let nightShown = -1;
  const HEMI_DAY = new THREE.Color(0xffe4c1),
    HEMI_NIGHT = new THREE.Color(0x8696cc),
    GROUND_DAY = new THREE.Color(0x52342b),
    GROUND_NIGHT = new THREE.Color(0x231c26);
  let lastRunShake = 0,
    visibleHeading = 0,
    hadContact = false;
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    accumulator += dt;
    elapsed += dt;
    while (accumulator >= DT) {
      const a = game.blocked ? { x: 0, z: 0 } : input.axes();
      const yaw = (s.yaw * Math.PI) / 180;
      const axis = {
        x: a.x * Math.cos(yaw) - a.z * Math.sin(yaw),
        z: -a.x * Math.sin(yaw) - a.z * Math.cos(yaw),
      };
      if (!game.blocked && input.take("KeyR")) {
        player.reset();
        follow.reset();
        current.copy(player.body.translation());
        previous.copy(current);
      }
      previous.copy(current);
      const wasGrounded = player.grounded;
      const fallSpeed = player.vy;
      player.tick(
        s,
        axis,
        !game.blocked && input.down("ShiftLeft", "ShiftRight"),
        !game.blocked && input.down("KeyC"),
        !game.blocked && input.take("Space"),
      );
      current.copy(player.body.translation());
      if (current.distanceTo(previous) > 5) {
        previous.copy(current);
        follow.reset();
      }
      if (wasGrounded && !player.grounded && player.vy > 0) {
        audio.play("jump");
        const t = player.body.translation();
        fx.jump({ x: t.x, y: t.y - player.height / 2, z: t.z });
      }
      if (!wasGrounded && player.grounded) {
        if (hadContact) {
          audio.play("land");
          const t = player.body.translation();
          fx.land(
            { x: t.x, y: t.y - player.height / 2, z: t.z },
            Math.min(1, Math.abs(fallSpeed) / 5),
          );
          visual.landed(Math.min(1, Math.abs(fallSpeed) / 5));
        }
        hadContact = true;
      }
      if (!wasGrounded && player.grounded && s.landingShake) follow.shake(s);
      if (
        s.runningShake &&
        player.grounded &&
        Math.hypot(player.vx, player.vz) > s.walk + 0.2 &&
        elapsed - lastRunShake > 0.35
      ) {
        follow.shake(s);
        lastRunShake = elapsed;
      }
      accumulator -= DT;
      if (!game.blocked && input.take("KeyE")) {
        const p = player.body.translation();
        const feet = p.y - player.height / 2;
        const oxygenDistance = Math.hypot(p.x + 2, p.z - 2);
        const beaconDistance = Math.hypot(p.x - 3, p.z - 2);
        const vertical = Math.abs(feet) < 1;
        if (game.interact({ x: p.x, y: feet, z: p.z })) {
        } else if (base.active) base.interact({ x: p.x, y: feet, z: p.z });
        else if (
          resources?.active &&
          vertical &&
          oxygenDistance <= s.interactionRange &&
          oxygenDistance <= beaconDistance
        )
          resources.interact();
        else if (vertical && beaconDistance <= s.interactionRange) {
          notice("Beacon checked. Interaction test successful.");
        } else notice("Approach an interaction target.");
      }
    }
    const p = player.body.translation();
    base.tick(
      now,
      { x: p.x, y: p.y - player.height / 2, z: p.z },
      game.state === "lab" && input.down("KeyE"),
    );
    game.update(
      dt,
      { x: p.x, y: p.y - player.height / 2, z: p.z },
      Math.hypot(player.vx, player.vz),
    );
    if ("event" in game && game.event !== lastAudioEvent) {
      lastAudioEvent = String(game.event);
      audio.cue();
    }
    audio.setScene(
      game.muted,
      base.sim.inShelter,
      base.sim.hazard === "dust",
    );
    if (base.active) {
      const light = baseScene.update(
        base.sim.elapsed,
        base.sim.config,
        base.sim.dust,
      );
      sun.position.set(
        light.direction.x * 24,
        Math.max(0.2, light.direction.y * 24),
        light.direction.z * 24,
      );
      // Shadow frustum follows the explorer across the terrain.
      sun.position.add(visual.root.position);
      sun.target.position.copy(visual.root.position);
      sun.target.updateMatrixWorld();
      // Long twilight: light fades over ~3 sim hours around sunrise/sunset
      // (≈15 real seconds at 120 s/sol) instead of switching at the horizon.
      const elev = light.direction.y;
      const day = THREE.MathUtils.smoothstep(elev, -0.3, 0.5);
      const golden = 1 - THREE.MathUtils.smoothstep(Math.abs(elev - 0.08), 0, 0.45);
      const storm = base.sim.hazard === "dust" ? 1 : 0;
      sun.intensity = 3 * THREE.MathUtils.smoothstep(elev, -0.12, 0.45) * (1 - 0.55 * fx.state.storm);
      sun.color.setHSL(0.07 + 0.02 * (1 - golden), 0.55 + 0.25 * golden, 0.6 + 0.3 * Math.min(1, Math.max(0, elev) * 2) - 0.12 * golden);
      hemi.intensity = 0.35 + 2.35 * day;
      // Day: warm dusty sky. Twilight: Mars' blue sunset glow. Night: cool, dim.
      hemi.color.copy(HEMI_DAY).lerp(HEMI_NIGHT, 1 - day);
      hemi.groundColor.copy(GROUND_DAY).lerp(GROUND_NIGHT, 1 - day);
      hemi.intensity = 1.05 + 1.65 * day;
      // Helmet lamp: fades in through twilight, lights the ground ahead.
      lamp.intensity = 14 * fx.state.night;
      // Hysteresis; both shader variants are precompiled, so toggling is cheap.
      if (!lamp.visible && fx.state.night > 0.12) lamp.visible = true;
      else if (lamp.visible && fx.state.night < 0.04) lamp.visible = false;
      fx.update(dt, elapsed, camera, target, {
        sunDir: light.direction,
        day,
        storm,
        fog: scene.fog as THREE.Fog,
      });
      // Continuous night factor for CSS (vignette, HUD) — no hard class switch.
      const n = Math.round(fx.state.night * 50) / 50;
      if (n !== nightShown) {
        nightShown = n;
        document.body.style.setProperty("--night", String(n));
      }
      document.body.classList.toggle("night", fx.state.night > 0.5);
      // Radiation counter: background ticks, a roar during particle events.
      if (!game.blocked)
        audio.geiger(0.25 + 3.5 * doseRate(base.sim.elapsed, base.sim.config, base.sim.inShelter), dt);
    } else {
      sun.intensity = 3;
      sun.color.setHex(0xffe4be);
      sun.position.set(12, 24, 8);
      hemi.intensity = 2.7;
      hemi.color.copy(HEMI_DAY);
      hemi.groundColor.copy(GROUND_DAY);
      lamp.intensity = 0;
      lamp.visible = false;
      fx.update(dt, elapsed, camera, target, {
        sunDir: { x: 0.45, y: 0.55, z: 0.3 },
        day: 1,
        storm: 0,
        fog: scene.fog as THREE.Fog,
      });
      document.body.classList.remove("night");
      if (nightShown !== 0) {
        nightShown = 0;
        document.body.style.setProperty("--night", "0");
      }
    }
    resources?.tick(now);
    resources?.prompt(
      Math.hypot(p.x + 2, p.z - 2) <= s.interactionRange &&
        Math.abs(p.y - player.height / 2) < 1,
    );
    area.oxygen.material.color.setHex(
      (base.active ? base.sim.generatorPowered : resources?.state.on)
        ? 0x9ce5b2
        : 0x436a69,
    );
    const stationState = area.station.update(
      { x: p.x, y: p.y - player.height / 2, z: p.z },
      s,
      base.active ? base.sim.flows().surplus > 0 : undefined,
    );
    const rendered = previous.clone().lerp(current, accumulator / DT);
    visual.root.position.set(
      rendered.x,
      rendered.y - player.height / 2,
      rendered.z,
    );
    visual.root.scale.y = visual.info.loaded ? 1 : player.height / s.standing;
    const turningInput = input.axes();
    if (Math.hypot(turningInput.x, turningInput.z) > 0)
      visibleHeading = smoothHeading(
        visibleHeading,
        player.facingYaw,
        s.turnResponsiveness,
        dt,
      );
    visual.root.rotation.y = visibleHeading;
    audio.update(
      p,
      player.grounded,
      Math.hypot(player.vx, player.vz) > s.walk + 0.2,
    );
    visual.update(
      dt,
      !player.grounded
        ? "jump"
        : player.crouched
          ? "crouch"
          : Math.hypot(player.vx, player.vz) > s.walk + 0.2
            ? "run"
            : Math.hypot(player.vx, player.vz) > 0.1
              ? "walk"
              : "idle",
      s,
      {
        speed: Math.hypot(player.vx, player.vz),
        vy: player.vy,
        grounded: player.grounded,
        crouched: player.crouched,
      },
    );
    target.set(
      rendered.x,
      rendered.y - player.height / 2 + s.targetHeight,
      rendered.z,
    );
    follow.update(target, dt, elapsed, s);
    area.ring.rotation.z = elapsed * 0.3;
    const labelRange = game.state === "lab" ? 7 : 5;
    scene.children.forEach((o) => {
      if (o instanceof THREE.Sprite)
        o.visible =
          !game.blocked &&
          o.position.distanceTo(visual.root.position) < labelRange;
    });
    touch.update(!game.blocked, game.prompt);
    renderer.render(scene, camera);
    frames++;
    if (now - sample > 1000) {
      fps = Math.round((frames * 1000) / (now - sample));
      frames = 0;
      sample = now;
    }
    status.textContent = `${player.grounded ? (player.crouched ? "Crouched" : "Surface contact") : "In flight"} · ${Math.hypot(player.vx, player.vz).toFixed(1)} m/s · ${fps} FPS`;
    if (now > noticeUntil)
      document.querySelector<HTMLElement>("#notice")!.style.display = "none";
    Object.assign(window, {
      nebula: {
        ready: true,
        game: game.state,
        position: { ...p },
        grounded: player.grounded,
        crouched: player.crouched,
        facingYaw: player.facingYaw,
        visualYaw: visibleHeading,
        model: visual.info,
        audio: audio.status,
        station: stationState,
        solar: baseScene.solarInfo,
        horizontalSpeed: Math.hypot(player.vx, player.vz),
        settings: s,
        actions,
        cleaning: game.cleaning
          ? { open: game.cleaning.open, fraction: game.cleaning.fraction }
          : null,
        apod: "apod" in game ? game.apod : null,
        harvest: game.harvest
          ? { open: game.harvest.open, ...game.harvest.progress }
          : null,
        oxygenPlant: game.oxygenPlant
          ? { open: game.oxygenPlant.open, leaks: game.oxygenPlant.leaks }
          : null,
        dust: base.active ? base.sim.dust : null,
        base: base.active
          ? {
              state: base.sim.state,
              elapsed: base.sim.elapsed,
              sol: base.sim.elapsed / SOL_SECONDS,
              battery: base.sim.battery,
              oxygen: base.sim.oxygen,
              dose: base.sim.dose,
              stress: base.sim.stress,
              nourishment: base.sim.nourishment,
              crops: [...base.sim.crops],
              hazard: base.sim.hazard,
              cleanProgress: base.sim.cleanProgress,
              cleanCount: base.sim.cleanCount,
              sheltered: base.sim.inShelter,
              punctures: base.sim.punctures,
              generator: base.sim.generator,
              tracking: base.sim.config.tracking,
            }
          : null,
        resources: resources
          ? {
              state: resources.state.state,
              battery: resources.state.battery,
              oxygen: resources.state.oxygen,
              on: resources.state.on,
            }
          : null,
      },
    });
  }
  // Precompile materials with and without the helmet lamp to avoid a dusk hitch.
  lamp.visible = true;
  renderer.compile(scene, camera);
  lamp.visible = false;
  renderer.compile(scene, camera);
  requestAnimationFrame(frame);
  canvas.focus();
  progress(1);
  window.__nebulaReady?.();
}
start().catch((e) => {
  console.error(e);
  status.textContent = "Unable to start";
  notice(
    "Unable to initialize graphics or physics. Try a current browser with WebGL2 enabled, then reload. " +
      String(e),
  );
});
