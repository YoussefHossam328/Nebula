import * as THREE from "three";
import { assets } from "../assets";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function solarAngles(normal: { x: number; y: number; z: number }) {
  return {
    yaw: Math.atan2(normal.x, normal.z),
    tilt: Math.acos(THREE.MathUtils.clamp(normal.y, -1, 1)),
  };
}
export async function loadSolarModel(
  parent: THREE.Group,
  position: { x: number; z: number },
) {
  const gltf = await new GLTFLoader().loadAsync(
    import.meta.env.BASE_URL +
      assets.solarPanel.path +
      "?v=" +
      encodeURIComponent(assets.solarPanel.revision),
  );
  const base = gltf.scene.getObjectByName("SolarBase");
  const panel = gltf.scene.getObjectByName("Panel");
  if (!base || !(panel instanceof THREE.Mesh))
    throw Error("Solar model is missing SolarBase or Panel nodes");
  const holder = new THREE.Group();
  holder.name = "TrackingSolarArray";
  holder.position.set(
    position.x + assets.solarPanel.offset[0],
    assets.solarPanel.offset[1],
    position.z + assets.solarPanel.offset[2],
  );
  holder.rotation.y = assets.solarPanel.yaw;
  // Preserve authored pivot relationships; fit the panel hinge to the existing 1.8 m prototype mast.
  const scale = (1.8 / panel.position.y) * assets.solarPanel.scale;
  if (!Number.isFinite(scale) || scale <= 0)
    throw Error("Invalid solar panel hinge height");
  holder.scale.setScalar(scale);
  holder.add(gltf.scene);
  gltf.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  const materials = (await gltf.parser.getDependencies(
    "material",
  )) as THREE.Material[];
  const clean = materials.find((m) => /clean/i.test(m.name)),
    dirty = materials.find((m) => /dirty/i.test(m.name));
  const hasStates = Boolean(clean && dirty && clean !== dirty);
  const stateMeshes: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) stateMeshes.push(o);
  });
  const meta = gltf.parser.json;
  parent.add(holder);
  let state = "exported texture",
    yaw = 0,
    tilt = 0;
  return {
    holder,
    update(
      normal: { x: number; y: number; z: number },
      transmission: number,
      cleanThreshold = 0.98,
    ) {
      const localNormal = new THREE.Vector3(
        normal.x,
        normal.y,
        normal.z,
      ).applyQuaternion(
        holder.getWorldQuaternion(new THREE.Quaternion()).invert(),
      );
      const angles = solarAngles(localNormal);
      yaw = angles.yaw;
      tilt = angles.tilt;
      base.rotation.set(0, yaw, 0);
      panel.rotation.set(tilt, 0, 0);
      if (hasStates) {
        state = transmission >= cleanThreshold ? "clean" : "dirty";
        stateMeshes.forEach((mesh) => {
          mesh.material = (state === "clean" ? clean : dirty)!;
        });
      }
    },
    get info() {
      const worldNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(
        panel.getWorldQuaternion(new THREE.Quaternion()),
      );
      return {
        loaded: true,
        yaw,
        tilt,
        worldNormal: worldNormal.toArray(),
        materialCount: materials.length,
        materialNames: materials.map((m) => m.name),
        imageNames: (meta.images ?? []).map(
          (i: { name?: string }) => i.name ?? "unnamed",
        ),
        hasCleanDirtyStates: hasStates,
        visualState: state,
        scale,
        missingCleanVariant: !hasStates,
      };
    },
  };
}
