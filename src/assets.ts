import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
// Paths are relative to public/. Keep collision independent of the model.
export const assets = {
  astronaut: {
    path: "",
    scale: 1,
    yaw: 0,
    offset: [0, 0, 0],
    clips: {
      idle: "Idle",
      walk: "Walk",
      run: "Run",
      jump: "Jump",
      crouch: "Crouch",
    },
  },
};
export async function astronaut() {
  const root = new THREE.Group();
  let mixer: THREE.AnimationMixer | undefined;
  let current: THREE.AnimationAction | undefined;
  const actions: Record<string, THREE.AnimationAction> = {};
  const suit = new THREE.MeshStandardMaterial({
    color: 0xe7d7ba,
    roughness: 0.8,
  });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.25, 0.65, 3, 6),
    suit,
  );
  body.position.y = 0.8;
  root.add(body);
  const helmet = new THREE.Mesh(new THREE.IcosahedronGeometry(0.29, 1), suit);
  helmet.position.y = 1.35;
  root.add(helmet);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.19, 0.15),
    new THREE.MeshStandardMaterial({
      color: 0x283b43,
      metalness: 0.4,
      roughness: 0.2,
    }),
  );
  visor.position.set(0, 1.36, 0.24);
  root.add(visor);
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.5, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xc77846 }),
  );
  pack.position.set(0, 0.85, -0.28);
  root.add(pack);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  if (assets.astronaut.path) {
    try {
      const gltf = await new GLTFLoader().loadAsync(
        import.meta.env.BASE_URL + assets.astronaut.path,
      );
      root.clear();
      const model = gltf.scene;
      model.scale.setScalar(assets.astronaut.scale);
      model.rotation.y = assets.astronaut.yaw;
      model.position.fromArray(assets.astronaut.offset);
      root.add(model);
      mixer = new THREE.AnimationMixer(model);
      for (const [key, name] of Object.entries(assets.astronaut.clips)) {
        const clip = THREE.AnimationClip.findByName(gltf.animations, name);
        if (clip) actions[key] = mixer.clipAction(clip);
      }
    } catch (e) {
      console.warn("Model unavailable; keeping placeholder.", e);
    }
  }
  return {
    root,
    update(dt: number, state: string) {
      const next = actions[state];
      if (next && next !== current) {
        current?.fadeOut(0.15);
        next.reset().fadeIn(0.15).play();
        current = next;
      }
      mixer?.update(dt);
    },
  };
}
