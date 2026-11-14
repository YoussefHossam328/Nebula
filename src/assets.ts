import * as THREE from "three";
import type { Settings } from "./config";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
// Paths are relative to public/. Keep collision independent of the model.
export const assets = {
  solarPanel: {
    path: "models/SolarPanel.glb",
    revision: "solar-two-materials-1",
    scale: 1,
    yaw: 0,
    offset: [0, 0, 0],
  },
  shelter: { path: "", scale: 1, yaw: 0, offset: [0, 0, 0] },
  astronaut: {
    path: "models/player.glb",
    revision: "idle-20261113",
    scale: 1,
    yaw: Math.PI,
    offset: [0, 0, 0],
    clips: {
      idle: "Idle",
      // "Action.001" is the clean in-place walk cycle. "walk again" has the same
      // motion but a broken first key (legs/arms pop ~50° at every loop seam);
      // it is only used to measure the authored stride length.
      walk: "Action.001",
      run: "Action.001",
      jump: "Jump",
      crouch: "Crouch",
    },
    strideReference: "walk again",
  },
};
/**
 * Procedural pose offsets for clips the supplied GLB does not author (jump,
 * crouch). Angles are radians about each bone's local X axis; tuned for the
 * Mixamo skeleton in player.glb. The original file is never modified.
 */
export const proceduralPose = {
  crouch: { upLeg: 1.15, leg: -1.75, foot: 0.55, spine: 0.32, drop: 0.36 },
  jump: { upLeg: 0.75, leg: -1.1, arm: 0.45, spine: 0.12 },
  land: { upLeg: 0.6, leg: -0.95, spine: 0.22, drop: 0.16 },
};
/**
 * Stride amplification (rotation about each bone's mean pose) used to derive
 * the long-stride walk and the run from the single authored walk cycle.
 */
export const gait = {
  walk: { legs: 1.35, knees: 1.4, arms: 1.3, spine: 1, lean: 0.04, bob: 1.3 },
  run: { legs: 1.9, knees: 2.1, arms: 2.0, spine: 1.4, lean: 0.24, bob: 2.2 },
};
export type Motion = {
  speed: number;
  vy: number;
  grounded: boolean;
  crouched: boolean;
};
const boneKey = (trackName: string) =>
  trackName.replace(/\.(quaternion|position|scale)$/, "").replace(/^.*mixamorig:?/, "");

/** Build a clip whose rotations swing `gain` times further around their mean. */
function amplify(
  source: THREE.AnimationClip,
  name: string,
  g: (typeof gait)["walk"],
) {
  const clip = source.clone();
  clip.name = name;
  const q = new THREE.Quaternion(),
    mean = new THREE.Quaternion(),
    inv = new THREE.Quaternion(),
    d = new THREE.Quaternion(),
    lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), g.lean);
  const axis = new THREE.Vector3();
  for (const track of clip.tracks) {
    const bone = boneKey(track.name);
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      const gain = /UpLeg$/.test(bone)
        ? g.legs
        : /Leg$/.test(bone)
          ? g.knees
          : /(Arm|ForeArm)$/.test(bone) && !/Shoulder/.test(bone)
            ? g.arms
            : /^Spine/.test(bone) || bone === "Hips"
              ? g.spine
              : 1;
      const v = track.values,
        n = v.length / 4;
      // Sign-aligned component average is a good mean for small swings.
      let mx = 0,
        my = 0,
        mz = 0,
        mw = 0;
      for (let i = 0; i < n; i++) {
        const s =
          v[i * 4] * v[0] + v[i * 4 + 1] * v[1] + v[i * 4 + 2] * v[2] + v[i * 4 + 3] * v[3] < 0
            ? -1
            : 1;
        mx += v[i * 4] * s;
        my += v[i * 4 + 1] * s;
        mz += v[i * 4 + 2] * s;
        mw += v[i * 4 + 3] * s;
      }
      mean.set(mx, my, mz, mw).normalize();
      inv.copy(mean).invert();
      for (let i = 0; i < n; i++) {
        q.fromArray(v, i * 4);
        if (gain !== 1) {
          d.copy(inv).multiply(q);
          if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
          const angle = 2 * Math.acos(Math.min(1, d.w));
          const sn = Math.sqrt(Math.max(0, 1 - d.w * d.w));
          if (sn > 1e-6) {
            axis.set(d.x / sn, d.y / sn, d.z / sn);
            d.setFromAxisAngle(axis, Math.min(Math.PI * 0.9, angle * gain));
          }
          q.copy(mean).multiply(d);
        }
        if (bone === "Spine" && g.lean) q.multiply(lean);
        q.normalize().toArray(v, i * 4);
      }
    } else if (/Hips\.position$/.test(track.name) && g.bob !== 1) {
      const v = track.values,
        n = v.length / 3;
      let my = 0;
      for (let i = 0; i < n; i++) my += v[i * 3 + 1];
      my /= n;
      for (let i = 0; i < n; i++) v[i * 3 + 1] = my + (v[i * 3 + 1] - my) * g.bob;
    }
  }
  return clip;
}

export async function astronaut() {
  const root = new THREE.Group();
  root.name = "Player";
  const fallback = new THREE.Group();
  root.add(fallback);
  const material = new THREE.MeshStandardMaterial({
    color: 0xe7d7ba,
    roughness: 0.8,
  });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.25, 0.65, 3, 6),
    material,
  );
  body.position.y = 0.8;
  fallback.add(body);
  const helmet = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.29, 1),
    material,
  );
  helmet.position.y = 1.35;
  fallback.add(helmet);
  let mixer: THREE.AnimationMixer | undefined,
    modelFrame: THREE.Group | undefined,
    walk: THREE.AnimationAction | undefined,
    run: THREE.AnimationAction | undefined,
    idle: THREE.AnimationAction | undefined;
  let missingAuthoredClips: string[] = [];
  const bones: Record<string, THREE.Bone | undefined> = {};
  const rest = new Map<THREE.Bone, THREE.Quaternion>();
  let crouchW = 0,
    jumpW = 0,
    landW = 0,
    locoW = 0,
    runW = 0,
    procedural = false;
  const qTmp = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  let loaded = false,
    clipNames: string[] = [],
    state = "idle",
    normalization = 1,
    rawHeight = 0,
    rootMotionTracks = 0,
    // Ground speed (m/s, at model scale 1) at which the authored walk's feet don't slide.
    naturalSpeed = 0.85,
    cycle = 1.6,
    lastPhase = 0;
  let stepPhases: number[] = [];
  let onStep: ((running: boolean) => void) | undefined;
  try {
    const gltf = await new GLTFLoader().loadAsync(
      import.meta.env.BASE_URL +
        assets.astronaut.path +
        "?v=" +
        encodeURIComponent(assets.astronaut.revision),
    );
    clipNames = gltf.animations.map((a) => a.name);
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model, true);
    rawHeight = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(rawHeight) || rawHeight <= 0)
      throw Error("Invalid player bounds");
    normalization = 1.6 / rawHeight;
    const centered = new THREE.Group();
    centered.add(model);
    centered.position.set(
      -(bounds.min.x + bounds.max.x) / 2,
      -bounds.min.y,
      -(bounds.min.z + bounds.max.z) / 2,
    );
    modelFrame = new THREE.Group();
    modelFrame.add(centered);
    root.add(modelFrame);
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    mixer = new THREE.AnimationMixer(model);
    const find = (n: string) => gltf.animations.find((a) => a.name === n);
    const stripRootMotion = (clip: THREE.AnimationClip) => {
      for (const track of clip.tracks) {
        if (/Hips\.position$/.test(track.name)) {
          rootMotionTracks++;
          const node = model.getObjectByName(track.name.slice(0, -9));
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = node?.position.x ?? track.values[0];
            track.values[i + 2] = node?.position.z ?? track.values[2];
          }
        }
      }
      return clip;
    };
    // Authored stride: horizontal hips travel per cycle in the root-motion take.
    const ref = find(assets.astronaut.strideReference);
    const hips = model.getObjectByName("mixamorig:Hips") ?? model.getObjectByName("mixamorigHips");
    if (ref && hips) {
      const t = ref.tracks.find((k) => /Hips\.position$/.test(k.name));
      if (t && t.values.length >= 6) {
        const v = t.values,
          n = v.length / 3;
        const dist = Math.hypot(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 2] - v[2]);
        const ws = new THREE.Vector3();
        (hips.parent ?? model).getWorldScale(ws);
        const metres = dist * ws.y * normalization;
        if (metres > 0.2 && metres < 5 && ref.duration > 0.2)
          naturalSpeed = metres / ref.duration;
      }
    }
    const source = find(assets.astronaut.clips.walk) ?? find(assets.astronaut.strideReference);
    if (source) {
      const base = stripRootMotion(source.clone());
      cycle = base.duration;
      walk = mixer.clipAction(amplify(base, "Walk (long stride)", gait.walk));
      run = mixer.clipAction(amplify(base, "Run (derived)", gait.run));
      // Foot-contact phases: when either foot is furthest forward (heel strike).
      const probe = mixer.clipAction(base);
      probe.play();
      const lf = model.getObjectByName("mixamorig:LeftFoot") ?? model.getObjectByName("mixamorigLeftFoot");
      const rf = model.getObjectByName("mixamorig:RightFoot") ?? model.getObjectByName("mixamorigRightFoot");
      if (lf && rf) {
        const N = 64,
          dx: number[] = [],
          dz: number[] = [];
        const a = new THREE.Vector3(),
          b = new THREE.Vector3();
        for (let k = 0; k < N; k++) {
          mixer.setTime((k / N) * base.duration);
          model.updateMatrixWorld(true);
          lf.getWorldPosition(a);
          rf.getWorldPosition(b);
          model.worldToLocal(a);
          model.worldToLocal(b);
          dx.push(a.x - b.x);
          dz.push(a.z - b.z);
        }
        const range = (v: number[]) => Math.max(...v) - Math.min(...v);
        const d = range(dz) >= range(dx) ? dz : dx;
        const iMax = d.indexOf(Math.max(...d)),
          iMin = d.indexOf(Math.min(...d));
        stepPhases = [iMax / N, iMin / N].sort((p, q) => p - q);
      }
      probe.stop();
      mixer.uncacheAction(base);
      mixer.setTime(0);
    }
    const authoredIdle = find(assets.astronaut.clips.idle);
    if (authoredIdle) idle = mixer.clipAction(stripRootMotion(authoredIdle.clone()));
    else if (source) {
      const restTracks = source.clone().tracks.map((track) => {
        const t = track.clone();
        const values = Array.from(
          t.InterpolantFactoryMethodLinear().evaluate(Math.min(0.2, source.duration)),
        );
        t.times = new Float32Array([0, 1]);
        t.values = new Float32Array([...values, ...values]);
        return t;
      });
      idle = mixer.clipAction(new THREE.AnimationClip("Fallback standing pose", 1, restTracks));
    }
    for (const [key, name] of Object.entries(assets.astronaut.clips))
      if (!find(name)) missingAuthoredClips.push(key);
    // All three loop together; weights are blended continuously by speed.
    for (const a of [idle, walk, run]) {
      if (!a) continue;
      a.play();
      a.setEffectiveWeight(a === idle ? 1 : 0);
    }
    for (const name of [
      "Spine",
      "Spine1",
      "LeftUpLeg",
      "RightUpLeg",
      "LeftLeg",
      "RightLeg",
      "LeftFoot",
      "RightFoot",
      "LeftArm",
      "RightArm",
    ]) {
      const b =
        model.getObjectByName("mixamorig:" + name) ??
        model.getObjectByName("mixamorig" + name);
      if (b instanceof THREE.Bone) {
        bones[name] = b;
        rest.set(b, b.quaternion.clone());
      }
    }
    procedural =
      Boolean(bones.LeftUpLeg && bones.LeftLeg && bones.RightUpLeg) &&
      (missingAuthoredClips.includes("jump") ||
        missingAuthoredClips.includes("crouch"));
    fallback.visible = false;
    loaded = true;
  } catch (e) {
    modelFrame?.removeFromParent();
    mixer = undefined;
    console.warn("Player model unavailable; keeping placeholder.", e);
  }
  /**
   * Knee direction check: + means the knee sits on the toe side of the
   * hip→foot line on the facing side (a normal, forward-bending knee); − means it bends backwards.
   */
  function kneeProbe() {
    const out: Record<string, number> = {};
    for (const side of ["Left", "Right"]) {
      const hip = bones[side + "UpLeg"],
        knee = bones[side + "Leg"],
        foot = bones[side + "Foot"];
      if (!hip || !knee || !foot) continue;
      const h = hip.getWorldPosition(new THREE.Vector3()),
        k = knee.getWorldPosition(new THREE.Vector3()),
        f = foot.getWorldPosition(new THREE.Vector3());
      // The character faces its root's +Z (facingYaw = atan2(x, z)).
      const fwd = root.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
      out[side] = k.sub(h.add(f).multiplyScalar(0.5)).dot(fwd);
    }
    return out;
  }
  const dominant = () =>
    locoW < 0.5 ? idle : runW > 0.5 ? run : walk;
  return {
    root,
    get info() {
      return {
        loaded,
        clipNames,
        state,
        activeClip: dominant()?.getClip().name ?? null,
        rawHeight,
        normalization,
        missingAuthoredClips,
        proceduralPoses: procedural
          ? missingAuthoredClips.filter((k) => k === "jump" || k === "crouch")
          : [],
        pose: { crouch: crouchW, jump: jumpW, land: landW },
        rootMotionRemoved: rootMotionTracks > 0,
        knee: kneeProbe(),
        gait: {
          naturalSpeed,
          cycle,
          stepPhases,
          locomotion: locoW,
          run: runW,
          timeScale: walk?.getEffectiveTimeScale() ?? 0,
        },
      };
    },
    /** True when footsteps can follow the animation's foot contacts. */
    get stepsFromAnimation() {
      return stepPhases.length > 0 && Boolean(walk);
    },
    set onStep(fn: ((running: boolean) => void) | undefined) {
      onStep = fn;
    },
    /** Brief knee-bend on touchdown, scaled 0..1 by impact speed. */
    landed(strength: number) {
      landW = Math.max(landW, 0.35 + 0.65 * strength);
    },
    update(dt: number, nextState: string, s: Settings, motion?: Motion) {
      state = nextState;
      const speed = motion?.speed ?? 0;
      const grounded = motion?.grounded ?? true;
      if (modelFrame) {
        modelFrame.scale.setScalar(
          normalization * assets.astronaut.scale * s.modelScale,
        );
        modelFrame.rotation.y = THREE.MathUtils.degToRad(s.modelYaw);
        modelFrame.position.fromArray(assets.astronaut.offset);
        modelFrame.position.y += s.modelOffsetY;
      }
      // Continuous blend: idle ↔ walk by speed, walk ↔ run between walk and run speeds.
      const blendK = 1 - Math.exp(-dt / Math.max(0.02, s.animationBlend * 0.6));
      const wantLoco = THREE.MathUtils.smoothstep(speed, 0.08, 0.7);
      const wantRun = motion?.crouched
        ? 0
        : THREE.MathUtils.smoothstep(speed, s.walk + 0.1, Math.max(s.walk + 0.2, s.run - 0.4));
      locoW += (wantLoco - locoW) * blendK;
      runW += (wantRun - runW) * blendK;
      if (idle) idle.setEffectiveWeight(1 - locoW);
      if (walk) walk.setEffectiveWeight(locoW * (1 - runW));
      if (run) run.setEffectiveWeight(locoW * runW);
      // Cadence matched to ground speed: stride length × steps per second.
      const scaleM = Math.max(0.2, s.modelScale);
      const strideW = naturalSpeed * scaleM * gait.walk.legs;
      const strideR = naturalSpeed * scaleM * gait.run.legs;
      const natural = strideW + (strideR - strideW) * runW;
      const rate = (s.walkAnimationRate + (s.runAnimationRate - s.walkAnimationRate) * runW) *
        (motion?.crouched ? 0.85 : 1);
      const ts = THREE.MathUtils.clamp(
        (Math.max(speed, 0.35) / Math.max(0.05, natural)) * rate,
        0.35,
        4,
      );
      if (walk && run) {
        walk.setEffectiveTimeScale(ts);
        run.setEffectiveTimeScale(ts);
      }
      if (procedural) for (const [b, q] of rest) b.quaternion.copy(q);
      mixer?.update(dt);
      // Keep walk and run phase-locked so blending never scissors the legs.
      if (walk && run) run.time = walk.time;
      if (walk && stepPhases.length) {
        const phase = (walk.time % cycle) / cycle;
        if (grounded && locoW > 0.5 && speed > 0.15) {
          for (const p of stepPhases) {
            const crossed =
              phase >= lastPhase
                ? p > lastPhase && p <= phase
                : p > lastPhase || p <= phase;
            if (crossed) onStep?.(runW > 0.5);
          }
        }
        lastPhase = phase;
      }
      if (!procedural || !modelFrame) return;
      const wantCrouch =
        missingAuthoredClips.includes("crouch") && nextState === "crouch"
          ? 1
          : 0;
      const wantJump =
        missingAuthoredClips.includes("jump") && motion && !motion.grounded
          ? 1
          : 0;
      const k = 1 - Math.exp(-dt * 12);
      crouchW += (wantCrouch - crouchW) * k;
      jumpW += (wantJump - jumpW) * (1 - Math.exp(-dt * (wantJump ? 14 : 9)));
      landW = Math.max(0, landW - dt * 3.2);
      const P = proceduralPose;
      // Tuck harder while rising, extend legs as the fall continues.
      const rise = motion ? THREE.MathUtils.clamp(motion.vy / 3, -1, 1) : 0;
      const j = jumpW * (0.7 + 0.3 * rise);
      const l = landW * (1 - crouchW);
      const legBend = (upLeg: number, leg: number) => {
        for (const side of ["Left", "Right"]) {
          bones[side + "UpLeg"]?.quaternion.multiply(qTmp.setFromAxisAngle(X, upLeg));
          bones[side + "Leg"]?.quaternion.multiply(qTmp.setFromAxisAngle(X, leg));
        }
      };
      legBend(
        P.crouch.upLeg * crouchW + P.jump.upLeg * j + P.land.upLeg * l,
        P.crouch.leg * crouchW + P.jump.leg * j + P.land.leg * l,
      );
      for (const side of ["Left", "Right"])
        bones[side + "Foot"]?.quaternion.multiply(
          qTmp.setFromAxisAngle(X, P.crouch.foot * crouchW),
        );
      bones.Spine?.quaternion.multiply(
        qTmp.setFromAxisAngle(
          X,
          P.crouch.spine * crouchW + P.jump.spine * j + P.land.spine * l,
        ),
      );
      bones.LeftArm?.quaternion.multiply(qTmp.setFromAxisAngle(Z, -P.jump.arm * jumpW));
      bones.RightArm?.quaternion.multiply(qTmp.setFromAxisAngle(Z, P.jump.arm * jumpW));
      modelFrame.position.y -=
        (P.crouch.drop * crouchW + P.land.drop * l) * s.modelScale;
    },
  };
}
