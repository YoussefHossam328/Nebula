import RAPIER from "@dimforge/rapier3d-compat";
import { approach, jumpSpeed, type Settings } from "./config";
export const DT = 1 / 60;
export class Character {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  grounded = false;
  crouched = false;
  vx = 0;
  vz = 0;
  facingYaw = 0;
  vy = 0;
  height: number;
  radius: number;
  constructor(
    public world: RAPIER.World,
    s: Settings,
  ) {
    this.height = s.standing;
    this.radius = s.radius;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        0,
        s.standing / 2 + 0.1,
        0,
      ),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(this.height / 2 - s.radius, s.radius),
      this.body,
    );
    this.controller = world.createCharacterController(0.02);
    this.controller.setSlideEnabled(true);
  }
  reset() {
    this.body.setTranslation({ x: 0, y: this.height / 2 + 0.15, z: 0 }, true);
    this.body.setNextKinematicTranslation(this.body.translation());
    this.vx = this.vy = this.vz = 0;
    this.grounded = false;
  }
  tick(
    s: Settings,
    axis: { x: number; z: number },
    run: boolean,
    crouch: boolean,
    jump: boolean,
  ) {
    const desired = crouch ? s.crouching : s.standing;
    const p = this.body.translation();
    if (desired !== this.height || s.radius !== this.radius) {
      const center = { x: p.x, y: p.y + (desired - this.height) / 2, z: p.z };
      const shape = new RAPIER.Capsule(desired / 2 - s.radius, s.radius);
      let blocked = false;
      if (desired > this.height || s.radius > this.radius)
        this.world.intersectionsWithShape(
          { ...center, y: center.y + 0.03 },
          { x: 0, y: 0, z: 0, w: 1 },
          shape,
          () => {
            blocked = true;
            return false;
          },
          undefined,
          undefined,
          this.collider,
          this.body,
        );
      if (!blocked) {
        this.collider.setShape(shape);
        this.body.setTranslation(center, true);
        this.height = desired;
        this.radius = s.radius;
      }
    }
    this.crouched = this.height < s.standing - 0.01;
    const speed = this.crouched ? s.crouchSpeed : run ? s.run : s.walk;
    const moving = Math.hypot(axis.x, axis.z) > 1e-5;
    if (moving) this.facingYaw = Math.atan2(axis.x, axis.z);
    const a =
      (moving ? s.acceleration : s.braking) *
      (this.grounded ? 1 : s.airControl) *
      DT;
    this.vx = approach(this.vx, axis.x * speed, a);
    this.vz = approach(this.vz, axis.z * speed, a);
    if (jump && this.grounded) this.vy = jumpSpeed(s);
    else if (this.grounded && this.vy < 0) this.vy = 0;
    this.vy -= s.gravity * DT;
    this.controller.setMaxSlopeClimbAngle((s.slope * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((s.slope * Math.PI) / 180);
    if (s.step > 0) this.controller.enableAutostep(s.step, 0.15, false);
    else this.controller.disableAutostep();
    if (this.vy <= 0) this.controller.enableSnapToGround(0.15);
    else this.controller.disableSnapToGround();
    this.controller.computeColliderMovement(this.collider, {
      x: this.vx * DT,
      y: this.vy * DT,
      z: this.vz * DT,
    });
    const m = this.controller.computedMovement();
    const now = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: now.x + m.x,
      y: now.y + m.y,
      z: now.z + m.z,
    });
    this.grounded = this.vy <= 0 && this.controller.computedGrounded();
    this.world.timestep = DT;
    this.world.step();
    if (this.body.translation().y < -12) this.reset();
  }
}
