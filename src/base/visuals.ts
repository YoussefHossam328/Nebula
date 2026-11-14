import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { assets } from "../assets";
import RAPIER from "@dimforge/rapier3d";
import type { BaseConfig } from "./config";
import { loadSolarModel } from "./solar-model";
import { sunlight } from "./model";
import { makeLabel } from "../label";
export const ARRAY_POSITION =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("lab")
    ? { x: -6, y: 0, z: 2 }
    : { x: -8, y: 0, z: 5 };
export function baseVisuals(scene: THREE.Scene, world: RAPIER.World) {
  const root = new THREE.Group();
  scene.add(root);
  const pivot = new THREE.Group();
  pivot.position.set(ARRAY_POSITION.x, 1.8, ARRAY_POSITION.z);
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
  mast.position.set(ARRAY_POSITION.x, 0.9, ARRAY_POSITION.z);
  root.add(mast);
  const mastCollider = world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.9, 0.2).setTranslation(
      ARRAY_POSITION.x,
      0.9,
      ARRAY_POSITION.z,
    ),
  );
  let solarModel: Awaited<ReturnType<typeof loadSolarModel>> | undefined;
  let solarFailed = false;
  const solarReady = loadSolarModel(root, ARRAY_POSITION)
    .then((model) => {
      solarModel = model;
      mastCollider.setShape(new RAPIER.Cylinder(0.9, model.info.scale));
      pivot.visible = false;
      mast.visible = false;
    })
    .catch(() => {
      solarFailed = true;
      console.warn("Solar GLB unavailable; retaining placeholder.");
    });
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
  const legacyShelter =
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).has("lab");
  // Outside the legacy lab the habitat itself is the radiation shelter.
  shelter.visible = legacyShelter;
  function configure(c: BaseConfig) {
    if (!legacyShelter) return;
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
    const sprite = makeLabel(text, 3);
    sprite.position.set(x, y, z);
    scene.add(sprite);
    return sprite;
  };
  const legacyLab =
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).has("lab");
  label(
    legacyLab ? "HOLD E / CLEAN ARRAY" : "E / SERVICE ARRAY",
    ARRAY_POSITION.x,
    3.6,
    ARRAY_POSITION.z,
  );
  const shelterLabel = label("STORM SHELTER · WALK IN", 6, 3.6, 5);
  shelterLabel.scale.multiplyScalar(1.1);
  shelterLabel.visible = legacyLab;
  if (!legacyLab) shelterLabel.removeFromParent();
  for (const [asset, parent, hide] of [
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
    solarReady,
    get solarInfo() {
      return (
        solarModel?.info ?? {
          loaded: false,
          failed: solarFailed,
          hasCleanDirtyStates: false,
        }
      );
    },
    update(time: number, c: BaseConfig, dust: number) {
      configure(c);
      const light = sunlight(time, c);
      solarModel?.update(light.normal, dust, c.cleanVisualThreshold);
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
