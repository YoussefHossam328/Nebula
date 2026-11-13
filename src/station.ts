import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { Settings } from "./config";
export const HABITAT = {
  minX: -5,
  maxX: 5,
  minZ: -7,
  maxZ: -1,
  height: 3,
  doorHalfWidth: 1.5,
};
export function insideHabitat(p: { x: number; y: number; z: number }) {
  return (
    p.x > HABITAT.minX + 0.15 &&
    p.x < HABITAT.maxX - 0.15 &&
    p.z > HABITAT.minZ + 0.15 &&
    p.z < HABITAT.maxZ - 0.15 &&
    p.y >= -0.1 &&
    p.y < HABITAT.height
  );
}
export function createStation(scene: THREE.Scene, world: RAPIER.World) {
  const root = new THREE.Group();
  root.name = "Habitat";
  scene.add(root);
  const floor = new THREE.Group();
  floor.name = "Floor";
  const walls = new THREE.Group();
  walls.name = "Walls";
  const roof = new THREE.Group();
  roof.name = "Roof";
  const props = new THREE.Group();
  props.name = "InteriorProps";
  root.add(floor, walls, roof, props);
  function box(
    parent: THREE.Group,
    size: [number, number, number],
    pos: [number, number, number],
    color: number,
    collision = true,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
    );
    mesh.position.set(...pos);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    if (collision)
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          size[0] / 2,
          size[1] / 2,
          size[2] / 2,
        ).setTranslation(...pos),
      );
    return mesh;
  }
  box(floor, [10, 0.12, 6], [0, -0.04, -4], 0x65777a);
  const north = box(walls, [10.2, 3, 0.2], [0, 1.5, -7], 0xc4bca8);
  north.name = "WallNorth";
  box(walls, [0.2, 3, 6], [-5, 1.5, -4], 0xc4bca8).name = "WallWest";
  const east = box(walls, [0.2, 3, 6], [5, 1.5, -4], 0xc4bca8);
  east.name = "WallEast";
  const south = [
    box(walls, [3.5, 3, 0.2], [-3.25, 1.5, -1], 0xc4bca8),
    box(walls, [3.5, 3, 0.2], [3.25, 1.5, -1], 0xc4bca8),
  ];
  box(walls, [3, 0.4, 0.22], [0, 2.8, -1], 0xc47644).name = "DoorFrame";
  box(roof, [10.4, 0.18, 6.4], [0, 3.1, -4], 0x8c8d80);
  roof.children[0].name = "RoofPanel";
  // Interior props leave a straight, open route from the entrance to the control desk.
  const battery = box(props, [1.1, 1.5, 0.8], [-3.5, 0.75, -5.5], 0x364c59);
  battery.name = "BatteryCabinet";
  const led = box(
    props,
    [0.7, 0.12, 0.04],
    [-3.5, 1.2, -5.07],
    0x90d8af,
    false,
  );
  box(props, [2.1, 0.8, 0.8], [0, 0.4, -5.5], 0x455c65).name = "ControlDesk";
  box(props, [1.4, 0.7, 0.08], [0, 1.2, -5.8], 0x1d313c, false).name =
    "ControlScreen";
  box(props, [1.3, 0.4, 2.2], [3.2, 0.2, -4.9], 0x364c59).name = "Bunk";
  box(props, [1.15, 0.12, 2], [3.2, 0.46, -4.9], 0xcbbf9e, false);
  box(props, [0.9, 1.3, 0.7], [-3.5, 0.65, -2.5], 0xa77b53).name =
    "SupplyLocker";
  // A tidy utility apron and paths connect the habitat, solar yard and shelter entrance.
  const paths = new THREE.Group();
  paths.name = "StationPaths";
  scene.add(paths);
  box(paths, [3, 0.05, 3], [0, 0.025, 0.4], 0x776d60, false);
  box(paths, [11, 0.04, 1.2], [-1, 0.02, 2], 0x776d60, false);
  box(paths, [1.2, 0.04, 2], [6, 0.02, 3], 0x776d60, false);
  for (const [x, z] of [
    [-1.4, -0.4],
    [1.4, -0.4],
    [-6, 3.5],
    [6, 2.5],
  ])
    box(paths, [0.1, 0.5, 0.1], [x, 0.25, z], 0xe5bf73, false);
  function cable(points: THREE.Vector3[], color: number) {
    const curve = new THREE.CatmullRomCurve3(points);
    const m = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 16, 0.035, 4, false),
      new THREE.MeshBasicMaterial({ color }),
    );
    paths.add(m);
  }
  cable(
    [
      new THREE.Vector3(-6, 0.06, 2),
      new THREE.Vector3(-6, 0.06, -0.7),
      new THREE.Vector3(-3.5, 0.06, -0.7),
      new THREE.Vector3(-3.5, 0.06, -5),
    ],
    0xe4a257,
  );
  let inside = false;
  return {
    root,
    roof,
    update(
      p: { x: number; y: number; z: number },
      s: Settings,
      charging?: boolean,
    ) {
      inside = insideHabitat(p);
      roof.visible = s.stationRoof && !(s.stationCutaway && inside);
      east.visible = !(s.stationCutaway && inside);
      south.forEach((w) => (w.visible = !(s.stationCutaway && inside)));
      led.material.color.setHex(
        charging === undefined ? 0x7f9d9d : charging ? 0x90d8af : 0xe7a15d,
      );
      return { inside, roofVisible: roof.visible };
    },
  };
}
