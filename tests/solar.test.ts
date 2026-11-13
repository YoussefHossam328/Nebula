import { it, expect } from "vitest";
import * as THREE from "three";
import { solarAngles } from "../src/base/solar-model";
import { sunlight } from "../src/base/model";
import { baseDefaults } from "../src/base/config";
it("uses base yaw and panel X tilt to align authored local +Y with the simulation normal", () => {
  for (const hour of [6, 8, 12, 16, 18]) {
    const light = sunlight(0, { ...baseDefaults, startHour: hour });
    const { yaw, tilt } = solarAngles(light.normal);
    const panel = new THREE.Object3D(),
      base = new THREE.Object3D();
    base.add(panel);
    base.rotation.y = yaw;
    panel.rotation.x = tilt;
    const n = new THREE.Vector3(0, 1, 0).applyQuaternion(
      panel.getWorldQuaternion(new THREE.Quaternion()),
    );
    expect(
      n.distanceTo(
        new THREE.Vector3(light.normal.x, light.normal.y, light.normal.z),
      ),
    ).toBeLessThan(1e-7);
  }
});
