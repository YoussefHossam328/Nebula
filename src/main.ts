import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { load } from "./config";
import { Input } from "./input";
import { Character, DT } from "./physics";
import { createWorld } from "./world";
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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(0xb87b60);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb87b60, 28, 75);
  const camera = new THREE.PerspectiveCamera(s.fov, 1, 0.1, 150);
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
  scene.add(sun);
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const area = createWorld(scene, world);
  if ("ready" in area.station) await area.station.ready;
  const baseScene = baseVisuals(scene, world);
  await baseScene.solarReady;
  const player = new Character(world, s);
  const visual = await astronaut();
  scene.add(visual.root);
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
    () => {
      player.reset();
      player.body.setTranslation(
        { x: 8, y: player.height / 2 + 0.15, z: -5 },
        true,
      );
      player.body.setNextKinematicTranslation(player.body.translation());
      follow.reset();
      current.copy(player.body.translation());
      previous.copy(current);
    },
  );
  describePanel(settingsPanel);
  let lastAudioEvent = "";
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
      if (wasGrounded && !player.grounded && player.vy > 0) audio.play("jump");
      if (!wasGrounded && player.grounded) {
        if (hadContact) audio.play("land");
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
      !game.blocked && input.down("KeyE"),
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
      game.blocked,
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
      sun.intensity = light.daylight ? 3 : 0;
      const hemi = scene.children.find(
        (o) => o instanceof THREE.HemisphereLight,
      ) as THREE.HemisphereLight;
      hemi.intensity = light.daylight ? 2.7 : 0.35;
      renderer.setClearColor(light.daylight ? 0xb87b60 : 0x151b2c);
      (scene.fog as THREE.Fog).color.setHex(
        light.daylight ? 0xb87b60 : 0x151b2c,
      );
    } else {
      sun.intensity = 3;
      sun.position.set(12, 24, 8);
      (
        scene.children.find(
          (o) => o instanceof THREE.HemisphereLight,
        ) as THREE.HemisphereLight
      ).intensity = 2.7;
      renderer.setClearColor(0xb87b60);
      (scene.fog as THREE.Fog).color.setHex(0xb87b60);
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
    visual.root.scale.y = player.height / s.standing;
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
    );
    target.set(
      rendered.x,
      rendered.y - player.height / 2 + s.targetHeight,
      rendered.z,
    );
    follow.update(target, dt, elapsed, s);
    area.ring.rotation.z = elapsed * 0.3;
    if (game.state !== "lab")
      scene.children.forEach((o) => {
        if (o instanceof THREE.Sprite)
          o.visible =
            !game.blocked && o.position.distanceTo(visual.root.position) < 5;
      });
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
  requestAnimationFrame(frame);
  canvas.focus();
}
start().catch((e) => {
  console.error(e);
  status.textContent = "Unable to start";
  notice(
    "Unable to initialize graphics or physics. Try a current browser with WebGL2 enabled, then reload. " +
      String(e),
  );
});
