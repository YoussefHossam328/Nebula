import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { assets } from "../assets";
import RAPIER from "@dimforge/rapier3d-compat";
import type { BaseConfig } from "./config";
import { sunlight } from "./model";
export const ARRAY_POSITION = { x: -6, y: 0, z: 2 };
export function baseVisuals(scene: THREE.Scene, world: RAPIER.World) {
  const root = new THREE.Group();
  scene.add(root);
  const pivot = new THREE.Group();
  pivot.position.set(-6, 1.8, 2);
  root.add(pivot);
  const arrayMat = new THREE.MeshStandardMaterial({
    color: 0x273c59,
    metalness: 0.3,
    roughness: 0.65,
  });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 2.5), arrayMat);
  plate.castShadow = plate.receiveShadow = true;
  pivot.add(plate);
  for (let x = -1.5; x <= 1.5; x += 0.5) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.02, 2.45),
      new THREE.MeshBasicMaterial({ color: 0x8fb6d2 }),
    );
    line.position.set(x, 0.07, 0);
    pivot.add(line);
  }
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0xbbb5a3 }),
  );
  mast.position.set(-6, 0.9, 2);
  root.add(mast);
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.9, 0.2).setTranslation(-6, 0.9, 2),
  );
  const shelter = new THREE.Group();
  root.add(shelter);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8d8b7b,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  // Three physical walls and a roof; open entrance on the negative-Z side.
  const pieces = [
    new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat),
    new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat),
    new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat),
    new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat),
  ];
  pieces.forEach((p) => shelter.add(p));
  let colliders: RAPIER.Collider[] = [];
  let signature = "";
  let customShelter: THREE.Object3D | undefined;
  function configure(c: BaseConfig) {
    const sig = [
      c.shelterX,
      c.shelterZ,
      c.shelterWidth,
      c.shelterDepth,
      c.shelterHeight,
    ].join();
    if (sig === signature) return;
    signature = sig;
    if (customShelter)
      customShelter.position.set(
        c.shelterX + assets.shelter.offset[0],
        assets.shelter.offset[1],
        c.shelterZ + assets.shelter.offset[2],
      );
    colliders.forEach((x) => world.removeCollider(x, true));
    colliders = [];
    const w = c.shelterWidth,
      d = c.shelterDepth,
      h = c.shelterHeight,
      x = c.shelterX,
      z = c.shelterZ;
    const boxes = [
      [0.15, h, d, x - w / 2, h / 2, z],
      [0.15, h, d, x + w / 2, h / 2, z],
      [w, h, 0.15, x, h / 2, z + d / 2],
      [w, 0.15, d, x, h, z],
    ];
    boxes.forEach((b, i) => {
      pieces[i].scale.set(b[0], b[1], b[2]);
      pieces[i].position.set(b[3], b[4], b[5]);
      colliders.push(
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(
            b[0] / 2,
            b[1] / 2,
            b[2] / 2,
          ).setTranslation(b[3], b[4], b[5]),
        ),
      );
    });
  }
  const label = (text: string, x: number, y: number, z: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 80;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#201b18";
    ctx.fillRect(0, 0, 512, 80);
    ctx.fillStyle = "#edd1a4";
    ctx.textAlign = "center";
    ctx.font = "bold 27px sans-serif";
    ctx.fillText(text, 256, 48);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }),
    );
    sprite.scale.set(3.8, 0.6, 1);
    sprite.position.set(x, y, z);
    scene.add(sprite);
    return sprite;
  };
  label("HOLD E / CLEAN ARRAY", -6, 3.6, 2);
  const shelterLabel = label("STORM SHELTER · WALK IN", 6, 3.6, 5);
  for (const [asset, parent, hide] of [
    [assets.solarPanel, pivot, [...pivot.children]],
    [assets.shelter, root, pieces],
  ] as const) {
    if (asset.path)
      new GLTFLoader().load(
        import.meta.env.BASE_URL + asset.path,
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(asset.scale);
          model.rotation.y = asset.yaw;
          model.position.fromArray(asset.offset);
          if (asset === assets.shelter) {
            customShelter = model;
            model.position.x += 6;
            model.position.z += 5;
            signature = "";
          }
          parent.add(model);
          hide.forEach((mesh) => (mesh.visible = false));
        },
        undefined,
        () => console.warn("Base model unavailable; keeping placeholder."),
      );
  }
  return {
    configure,
    update(time: number, c: BaseConfig, dust: number) {
      configure(c);
      const light = sunlight(time, c);
      pivot.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(light.normal.x, light.normal.y, light.normal.z),
      );
      arrayMat.color.setRGB(
        0.13 + 0.3 * (1 - dust),
        0.22 + 0.1 * (1 - dust),
        0.35 - 0.12 * (1 - dust),
      );
      shelterLabel.position.set(c.shelterX, c.shelterHeight + 0.6, c.shelterZ);
      return light;
    },
  };
}
