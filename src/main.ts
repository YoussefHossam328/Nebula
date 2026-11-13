import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { load } from "./config";
import { Input } from "./input";
import { Character, DT } from "./physics";
import { createWorld } from "./world";
import { astronaut } from "./assets";
import { panel } from "./settings";
import "./style.css";
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
  const player = new Character(world, s);
  const visual = await astronaut();
  scene.add(visual.root);
  const input = new Input(canvas);
  const target = new THREE.Vector3(),
    desired = new THREE.Vector3();
  let initial = true,
    elapsed = 0,
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
  panel(s, resize, notice);
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    accumulator += dt;
    elapsed += dt;
    while (accumulator >= DT) {
      const a = input.axes();
      const yaw = (s.yaw * Math.PI) / 180;
      const axis = {
        x: a.x * Math.cos(yaw) - a.z * Math.sin(yaw),
        z: -a.x * Math.sin(yaw) - a.z * Math.cos(yaw),
      };
      if (input.take("KeyR")) player.reset();
      player.tick(
        s,
        axis,
        input.down("ShiftLeft", "ShiftRight"),
        input.down("KeyC"),
        input.take("Space"),
      );
      accumulator -= DT;
      if (input.take("KeyE")) {
        const p = player.body.translation();
        if (Math.hypot(p.x - 3, p.z - 2) <= s.interactionRange) {
          area.beacon.material = new THREE.MeshStandardMaterial({
            color: 0x9ce5b2,
            emissive: 0x236747,
          });
          notice("Beacon checked. Interaction test successful.");
        } else notice("Move closer to the field beacon to interact.");
      }
    }
    const p = player.body.translation();
    visual.root.position.set(p.x, p.y - player.height / 2, p.z);
    visual.root.scale.y = player.height / s.standing;
    if (Math.hypot(player.vx, player.vz) > 0.1)
      visual.root.rotation.y = Math.atan2(player.vx, player.vz);
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
    );
    target.set(p.x, p.y - player.height / 2 + s.targetHeight, p.z);
    const yaw = (s.yaw * Math.PI) / 180,
      pitch = (s.pitch * Math.PI) / 180;
    desired
      .set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      )
      .multiplyScalar(s.distance)
      .add(target);
    camera.position.lerp(
      desired,
      initial ? 1 : 1 - Math.exp(-s.smoothing * dt),
    );
    camera.lookAt(target);
    initial = false;
    area.ring.rotation.z = elapsed * 0.3;
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
        position: { ...p },
        grounded: player.grounded,
        crouched: player.crouched,
        settings: s,
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
