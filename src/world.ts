import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
export function createWorld(scene: THREE.Scene, world: RAPIER.World) {
  const orange = new THREE.MeshStandardMaterial({
    color: 0x9c5138,
    roughness: 1,
    flatShading: true,
  });
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color = 0x9c5138,
    angle = 0,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.z = angle;
    mesh.receiveShadow = mesh.castShadow = true;
    scene.add(mesh);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
        .setTranslation(x, y, z)
        .setRotation({
          x: 0,
          y: 0,
          z: Math.sin(angle / 2),
          w: Math.cos(angle / 2),
        }),
    );
    return mesh;
  }
  box(32, 1, 32, 0, -0.5, 0, 0xa95e43);
  // Platforms, stairs, and ramps are real collision geometry.
  for (let i = 0; i < 5; i++)
    box(1, 0.2 * (i + 1), 2, -5 - i, 0.1 * (i + 1), -3, 0xbd7952);
  box(4, 0.3, 3, 5, 0.9, -3, 0xbf8059, Math.PI / 8);
  box(2, 0.3, 3, 7.7, 1.65, -3, 0xbf8059);
  box(3, 0.3, 3, -6, 1.4, 5, 0x8c513e, Math.PI / 3);
  box(3, 0.25, 3, 0, 1.45, -6, 0x67594e);
  box(0.25, 1.4, 3, -1.4, 0.7, -6, 0x67594e);
  box(0.25, 1.4, 3, 1.4, 0.7, -6, 0x67594e);
  function label(text: string, x: number, y: number, z: number) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#201a19";
    ctx.fillRect(0, 0, 512, 96);
    ctx.font = "bold 30px sans-serif";
    ctx.fillStyle = "#f2d9b2";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 59);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        depthTest: true,
      }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(3, 0.56, 1);
    scene.add(sprite);
  }
  label("01 / STEP TEST", -7, 2, -3);
  label("02 / SLOPE", 6, 2.8, -3);
  label("03 / CROUCH", 0, 2.2, -6);
  label("04 / STEEP", -6, 3, 5);
  const beacon = box(0.65, 0.9, 0.65, 3, 0.45, 2, 0x436a69);
  label("E / FIELD BEACON", 3, 1.6, 2);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.6, 0.04, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0x93efca }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(3, 0.05, 2);
  scene.add(ring);
  // Deterministic decorative rocks and distant mountains; no extra gameplay colliders.
  let seed = 74;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  for (let i = 0; i < 65; i++) {
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12 + rand() * 0.35, 0),
      orange,
    );
    const x = (rand() - 0.5) * 31,
      z = (rand() - 0.5) * 31;
    if (Math.hypot(x, z) < 10) continue;
    rock.position.set(x, 0.1, z);
    rock.scale.y = 0.6;
    scene.add(rock);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(5 + rand() * 5, 5 + rand() * 9, 5),
      orange,
    );
    mountain.position.set(Math.cos(a) * 44, 1, Math.sin(a) * 44);
    scene.add(mountain);
  }
  const oxygen = box(0.8, 1.2, 0.8, -2, 0.6, 2, 0x436a69);
  label("E / O₂ UNIT", -2, 1.9, 2);
  return { beacon, ring, oxygen };
}
