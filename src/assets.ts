import * as THREE from "three";
import type { Settings } from "./config";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
// Paths are relative to public/. Keep collision independent of the model.
export const assets = {
  solarPanel: { path: "", scale: 1, yaw: 0, offset: [0, 0, 0] },
  shelter: { path: "", scale: 1, yaw: 0, offset: [0, 0, 0] },
  astronaut: {
    path: "models/player.glb",
    scale: 1,
    yaw: Math.PI,
    offset: [0, 0, 0],
    clips: {
      idle: "Idle",
      walk: "walk again",
      run: "walk again",
      jump: "Jump",
      crouch: "Crouch",
    },
  },
};
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
    current: THREE.AnimationAction | undefined,
    walk: THREE.AnimationAction | undefined,
    idle: THREE.AnimationAction | undefined;
  const stateActions: Partial<Record<string, THREE.AnimationAction>> = {};
  let missingAuthoredClips: string[] = [];
  let loaded = false,
    clipNames: string[] = [],
    state = "idle",
    normalization = 1,
    rawHeight = 0,
    rootMotionTracks = 0;
  try {
    const gltf = await new GLTFLoader().loadAsync(
      import.meta.env.BASE_URL + assets.astronaut.path,
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
    const source = gltf.animations.find(
      (a) => a.name === assets.astronaut.clips.walk,
    );
    if (source) {
      const clip = source.clone();
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
      const restTracks = clip.tracks.map((track) => {
        const t = track.clone();
        const values = Array.from(
          t
            .InterpolantFactoryMethodLinear()
            .evaluate(Math.min(0.2, source.duration)),
        );
        t.times = new Float32Array([0, 1]);
        t.values = new Float32Array([...values, ...values]);
        return t;
      });
      idle = mixer.clipAction(
        new THREE.AnimationClip("Fallback standing pose", 1, restTracks),
      );
      walk = mixer.clipAction(clip);
      idle.play();
      current = idle;
    }
    for (const [key, name] of Object.entries(assets.astronaut.clips)) {
      const authored = gltf.animations.find((c) => c.name === name);
      if (!authored) {
        missingAuthoredClips.push(key);
        continue;
      }
      if (
        (key === "walk" || key === "run") &&
        name === assets.astronaut.clips.walk
      ) {
        stateActions[key] = walk;
        continue;
      }
      const clip = authored.clone();
      for (const track of clip.tracks) {
        if (/Hips\.position$/.test(track.name)) {
          const bone = model.getObjectByName(track.name.slice(0, -9));
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = bone?.position.x ?? track.values[0];
            track.values[i + 2] = bone?.position.z ?? track.values[2];
          }
        }
      }
      const action = mixer.clipAction(clip);
      if (key === "jump") {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      stateActions[key] = action;
    }
    if (stateActions.idle) {
      idle?.stop();
      idle = stateActions.idle;
      idle.play();
      current = idle;
    }
    fallback.visible = false;
    loaded = true;
  } catch (e) {
    modelFrame?.removeFromParent();
    mixer = undefined;
    console.warn("Player model unavailable; keeping placeholder.", e);
  }
  return {
    root,
    get info() {
      return {
        loaded,
        clipNames,
        state,
        activeClip: current?.getClip().name ?? null,
        rawHeight,
        normalization,
        missingAuthoredClips,
        rootMotionRemoved: rootMotionTracks > 0,
      };
    },
    update(dt: number, nextState: string, s: Settings) {
      state = nextState;
      if (modelFrame) {
        modelFrame.scale.setScalar(
          normalization * assets.astronaut.scale * s.modelScale,
        );
        modelFrame.rotation.y = THREE.MathUtils.degToRad(s.modelYaw);
        modelFrame.position.fromArray(assets.astronaut.offset);
        modelFrame.position.y += s.modelOffsetY;
      }
      const next =
        stateActions[nextState] ??
        (nextState === "walk" || nextState === "run" ? walk : idle);
      if (next && next !== current) {
        current?.fadeOut(s.animationBlend);
        next.reset().setEffectiveWeight(1).fadeIn(s.animationBlend).play();
        current = next;
      }
      if (nextState === "walk" || nextState === "run")
        next?.setEffectiveTimeScale(
          nextState === "run" ? s.runAnimationRate : s.walkAnimationRate,
        );
      mixer?.update(dt);
    },
  };
}
