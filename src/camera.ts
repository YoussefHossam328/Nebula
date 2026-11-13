import * as THREE from "three";
import type { Settings } from "./config";
export class FollowCamera {
  private history: { time: number; point: THREE.Vector3 }[] = [];
  private anchor = new THREE.Vector3();
  private initialized = false;
  private shakeLeft = 0;
  constructor(private camera: THREE.PerspectiveCamera) {}
  reset() {
    this.history = [];
    this.initialized = false;
    this.shakeLeft = 0;
  }
  shake(s: Settings) {
    if (s.shakeEnabled) this.shakeLeft = s.shakeDuration;
  }
  update(point: THREE.Vector3, dt: number, time: number, s: Settings) {
    if (
      this.initialized &&
      this.history.length &&
      point.distanceTo(this.history[this.history.length - 1].point) > 5
    )
      this.reset();
    this.history.push({ time, point: point.clone() });
    const at = time - s.followDelay;
    while (this.history.length > 2 && this.history[1].time <= at)
      this.history.shift();
    const a = this.history[0],
      b = this.history[1] ?? a;
    const t =
      b.time > a.time
        ? THREE.MathUtils.clamp((at - a.time) / (b.time - a.time), 0, 1)
        : 0;
    const delayed = a.point.clone().lerp(b.point, t);
    if (!this.initialized) {
      this.anchor.copy(point);
      this.initialized = true;
    } else this.anchor.lerp(delayed, 1 - Math.exp(-s.smoothing * dt));
    const yaw = THREE.MathUtils.degToRad(s.yaw),
      pitch = THREE.MathUtils.degToRad(s.pitch);
    const eye = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    )
      .multiplyScalar(s.distance)
      .add(this.anchor);
    const shake = new THREE.Vector3();
    this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    if (s.shakeEnabled && this.shakeLeft > 0) {
      const strength = (s.shakeStrength * this.shakeLeft) / s.shakeDuration;
      shake
        .set(
          Math.sin(time * s.shakeFrequency * 6.283),
          Math.sin(time * s.shakeFrequency * 8.17),
          0,
        )
        .multiplyScalar(strength);
    }
    this.camera.position.copy(eye).add(shake);
    this.camera.lookAt(this.anchor.clone().add(shake));
  }
}
