import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createStation } from "./station";
export function createWorld(scene: THREE.Scene, world: RAPIER.World) {
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: number,
  ) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    );
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z),
    );
    return m;
  }
  box(32, 1, 32, 0, -0.5, 0, 0xa95e43);
  const station = createStation(scene, world);
  function label(text: string, x: number, y: number, z: number) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 80;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#201a19";
    ctx.fillRect(0, 0, 512, 80);
    ctx.font = "bold 26px sans-serif";
    ctx.fillStyle = "#f2d9b2";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 49);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(2.8, 0.44, 1);
    scene.add(sprite);
    return sprite;
  }
  label("HABITAT / OPEN ENTRANCE", 0, 3.65, -1);
  label("BATTERY / CONTROL", -1.8, 2.1, -5.5);
  const beacon = box(0.4, 0.8, 0.4, 3, 0.4, 2, 0x436a69);
  label("E / CONTROL PYLON", 3, 1.35, 2);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.025, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0x93efca }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(3, 0.05, 2);
  scene.add(ring);
  const oxygen = box(0.8, 1.2, 0.8, -2, 0.6, 2, 0x436a69);
  label("E / O₂ PLANT", -2, 1.9, 2);
  for (const x of [-3, -3.6]) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9c8b4 }),
    );
    tank.position.set(x, 0.6, 2.8);
    scene.add(tank);
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.6, 0.22).setTranslation(x, 0.6, 2.8),
    );
  }
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x9c5138,
    roughness: 1,
    flatShading: true,
  });
  let seed = 74;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  for (let i = 0; i < 60; i++) {
    const x = (rand() - 0.5) * 31,
      z = (rand() - 0.5) * 31;
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.15 + rand() * 0.3, 0),
      rockMaterial,
    );
    rock.position.set(x, 0.1, z);
    rock.scale.y = 0.6;
    scene.add(rock);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(5 + rand() * 5, 5 + rand() * 9, 5),
      rockMaterial,
    );
    m.position.set(Math.cos(a) * 44, 1, Math.sin(a) * 44);
    scene.add(m);
  }
  return { beacon, ring, oxygen, station };
}
