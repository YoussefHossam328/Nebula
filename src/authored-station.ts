import * as T from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Settings } from "./config";
export function createAuthoredStation(scene: T.Scene, world: RAPIER.World) {
  const root = new T.Group();
  root.name = "Authored Mars Base";
  scene.add(root);
  const decor = new T.Group();
  root.add(decor);
  function box(
    name: string,
    size: [number, number, number],
    p: [number, number, number],
    color: number,
    collision = false,
  ) {
    const m = new T.Mesh(
      new T.BoxGeometry(...size),
      new T.MeshStandardMaterial({ color, roughness: 0.7 }),
    );
    m.name = name;
    m.position.set(...p);
    m.castShadow = m.receiveShadow = true;
    decor.add(m);
    if (collision)
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          size[0] / 2,
          size[1] / 2,
          size[2] / 2,
        ).setTranslation(...p),
      );
    return m;
  }
  function sign(text: string, x: number, z: number, color = "#a8e3d0") {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#142d33";
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = color;
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 78);
    const m = new T.Mesh(
      new T.PlaneGeometry(2.5, 0.625),
      new T.MeshBasicMaterial({
        map: new T.CanvasTexture(c),
        side: T.DoubleSide,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.065, z);
    decor.add(m);
  }
  sign("NEBULA / HABITAT", 2, 0);
  sign("OXYGEN / E", -7, -1.8);
  sign("CROPS / E", 2, -8.6);
  for (const [x, z] of [
    [2, -1],
    [-7, -1],
    [2, -9.6],
  ]) {
    const floor = new T.Mesh(
      new T.CylinderGeometry(2.95, 2.95, 0.04, 48),
      new T.MeshStandardMaterial({ color: 0x536d71, roughness: 0.9 }),
    );
    floor.position.set(x, 0.02, z);
    root.add(floor);
  }
  box("Utility corridor floor", [9, 0.04, 1.7], [-2.5, 0.02, -1], 0x536d71);
  box("Farm corridor floor", [1.7, 0.04, 8.6], [2, 0.02, -5.3], 0x536d71);
  box("Entry walkway", [1.7, 0.04, 2], [2, 0.02, 2.6], 0x8b8170);
  // Furnish the room perimeter and preserve the central routes to both corridors.
  box("Command desk", [1.8, 0.8, 0.7], [3.5, 0.4, -2.3], 0x42616c, true);
  box("Telemetry display", [1.3, 0.65, 0.07], [3.5, 1.25, -2.55], 0x193e4c);
  for (let i = 0; i < 3; i++)
    box(
      "Display telemetry",
      [0.8 - i * 0.15, 0.035, 0.012],
      [3.5, 1.45 - i * 0.16, -2.5],
      0x91d9b8,
    );
  box("Bunk frame", [1, 0.4, 2], [0.2, 0.2, -2.9], 0x40545e, true);
  box("Bunk cushion", [0.9, 0.15, 1.8], [0.2, 0.48, -2.9], 0xc5b698);
  box("Equipment locker", [0.65, 1.4, 0.65], [3.9, 0.7, -0.3], 0xb18154, true);
  for (let i = 0; i < 3; i++)
    box(
      "Supply crates",
      [0.6, 0.45, 0.6],
      [-8.8, 0.225 + i * 0.45, -1],
      i % 2 ? 0x9f7750 : 0x596e71,
      true,
    );
  box(
    "Greenhouse nutrient reservoir",
    [0.8, 0.7, 0.7],
    [0.5, 0.35, -11.3],
    0x688b8b,
    true,
  );
  box("Grow light gantry", [3.3, 0.12, 0.4], [1.9, 2.1, -10], 0xbee9ce);
  const led = box(
    "Oxygen status light",
    [0.45, 0.1, 0.08],
    [-6.4, 1.3, 0.14],
    0x9ce5b2,
  );
  const panelCanvas = document.createElement("canvas");
  panelCanvas.width = panelCanvas.height = 128;
  const panelContext = panelCanvas.getContext("2d")!;
  panelContext.fillStyle = "#eee9db";
  panelContext.fillRect(0, 0, 128, 128);
  panelContext.strokeStyle = "#a6aaa4";
  panelContext.lineWidth = 2;
  panelContext.strokeRect(2, 2, 124, 124);
  panelContext.fillStyle = "#8e9996";
  for (const x of [8, 120])
    for (const y of [8, 120]) {
      panelContext.beginPath();
      panelContext.arc(x, y, 1.5, 0, Math.PI * 2);
      panelContext.fill();
    }
  const panelTexture = new T.CanvasTexture(panelCanvas);
  panelTexture.wrapS = panelTexture.wrapT = T.RepeatWrapping;
  panelTexture.colorSpace = T.SRGBColorSpace;
  let loaded = false,
    failed = false,
    wallMeshes: T.Mesh[] = [];
  const ready = new GLTFLoader()
    .loadAsync(import.meta.env.BASE_URL + "models/Base.glb")
    .then((g) => {
      const source = g.scene;
      source.getObjectByName("bak")?.removeFromParent();
      // The export contains a reference astronaut; the live game owns its own player.
      source.getObjectByName("Main")?.removeFromParent();
      source.getObjectByName("door")?.removeFromParent();
      source.scale.set(0.75, 1, 0.75);
      source.position.set(2, 0, -1);
      source.updateMatrixWorld(true);
      source.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        o.castShadow = o.receiveShadow = true;
        if (o.name === "bak" || o.name === "base") {
          // Separate triangles into floor/walls, and open an exterior doorway on the south arc.
          const geo = o.geometry.index
            ? o.geometry.toNonIndexed()
            : o.geometry.clone();
          const pos = geo.getAttribute("position");
          const floors: number[] = [],
            walls: number[] = [];

          for (let i = 0; i < pos.count; i += 3) {
            const v = [0, 1, 2].map((j) =>
              new T.Vector3()
                .fromBufferAttribute(pos, i + j)
                .applyMatrix4(o.matrixWorld),
            );
            const ymin = Math.min(...v.map((p) => p.y)),
              ymax = Math.max(...v.map((p) => p.y));
            const x = v.reduce((s, p) => s + p.x, 0) / 3,
              z = v.reduce((s, p) => s + p.z, 0) / 3;
            if (
              ymax - ymin > 0.3 &&
              (z > 1.45 || (z < -3.4 && z > -7.3)) &&
              Math.abs(x - 2) < 1.25
            )
              continue;
            const dst = ymax - ymin < 0.1 ? floors : walls;
            v.forEach((p) => dst.push(...p.toArray()));
          }
          for (const [verts, color, name] of [
            [floors, 0x647a7d, "Base floor"],
            [walls, 0xc3c5b4, "Base wall"],
          ] as const) {
            const geometry = new T.BufferGeometry();
            geometry.setAttribute(
              "position",
              new T.Float32BufferAttribute(verts, 3),
            );
            geometry.computeVertexNormals();
            const uvs: number[] = [];
            for (let i = 0; i < verts.length; i += 9) {
              const va = new T.Vector3().fromArray(verts, i),
                vb = new T.Vector3().fromArray(verts, i + 3),
                vc = new T.Vector3().fromArray(verts, i + 6);
              const n = vb.sub(va).cross(vc.sub(va)).normalize();
              for (let j = 0; j < 3; j++) {
                const k = i + j * 3;
                uvs.push(
                  (Math.abs(n.x) > Math.abs(n.z) ? verts[k + 2] : verts[k]) *
                    0.6,
                  (name === "Base wall" ? verts[k + 1] : verts[k + 2]) * 0.6,
                );
              }
            }
            geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
            const mesh = new T.Mesh(
              geometry,
              new T.MeshStandardMaterial({
                color,
                side: T.DoubleSide,
                roughness: 0.85,
                map: name === "Base wall" ? panelTexture : null,
              }),
            );
            mesh.name = name;
            mesh.castShadow = mesh.receiveShadow = true;
            root.add(mesh);
            if (name === "Base wall") wallMeshes.push(mesh);
            // Only one side of the duplicated shell needs collision.
            if (o.name === "base")
              world.createCollider(
                RAPIER.ColliderDesc.trimesh(
                  new Float32Array(verts),
                  Uint32Array.from({ length: verts.length / 3 }, (_, i) => i),
                ),
              );
          }
          o.visible = false;
          geo.dispose();
        } else {
          o.material = new T.MeshStandardMaterial({
            color: o.name === "o2" ? 0xc6d5cf : 0x496c7b,
            roughness: 0.7,
            metalness: 0.15,
          });
          const b = new T.Box3().setFromObject(o),
            sz = b.getSize(new T.Vector3()),
            ct = b.getCenter(new T.Vector3());
          world.createCollider(
            RAPIER.ColliderDesc.cuboid(
              sz.x / 2,
              sz.y / 2,
              sz.z / 2,
            ).setTranslation(ct.x, ct.y, ct.z),
          );
        }
      });
      root.add(source);
      loaded = true;
    })
    .catch((e) => {
      failed = true;
      console.error("Base GLB failed to load", e);
    });
  return {
    root,
    ready,
    update(
      p: { x: number; y: number; z: number },
      s: Settings,
      charging?: boolean,
    ) {
      const inside =
        p.y < 2.7 &&
        (Math.hypot(p.x - 2, p.z + 1) < 3 ||
          Math.hypot(p.x + 7, p.z + 1) < 3 ||
          Math.hypot(p.x - 2, p.z + 10) < 3);
      // Model is authored without a roof; fade front-facing walls for an unobstructed cutaway.
      wallMeshes.forEach((m) => {
        const mat = m.material as T.MeshStandardMaterial;
        mat.transparent = s.stationCutaway && inside;
        mat.opacity = mat.transparent ? 0.24 : 1;
        mat.depthWrite = !mat.transparent;
      });
      led.material.color.setHex(charging ? 0x9ce5b2 : 0x668075);
      return {
        inside,
        roofVisible: false,
        loaded,
        failed,
        layout: "three-room",
        farm: { x: 1.9, z: -10 },
        oxygen: { x: -6.4, z: -0.3 },
      };
    },
  };
}
