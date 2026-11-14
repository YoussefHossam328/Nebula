import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d";

/**
 * Real Mars terrain around the base, baked by scripts/bake-terrain.py from the
 * NASA Mars 2020 TRN CTX DTM (20 m/px) and CTX orthomosaic of the Jezero
 * region. Horizontal and vertical distances are both divided by
 * `meta.compression`, so slopes keep their real steepness while kilometres of
 * landscape fit around a walkable base. The pad under the base is levelled.
 */
export interface SiteMeta {
  name: string;
  lat: number;
  lon: number;
  elevation: number;
  size: number;
  realSpacing: number;
  realExtent: number;
  compression: number;
  heights: { file: string; offset: number };
  ortho: { file: string };
  source: { credit: string; dem: string; ortho: string };
}
export interface TerrainData {
  meta: SiteMeta;
  /** Real metres relative to the base site's elevation, row 0 = north. */
  relief: Float32Array;
  ortho?: THREE.Texture;
}

/** Fully flat pad radius (game metres) and outer edge of the blend to real data. */
export const PAD_RADIUS = 24;
export const BLEND_RADIUS = 46;

export async function loadTerrainData(
  base = import.meta.env.BASE_URL + "terrain/",
): Promise<TerrainData | null> {
  try {
    const meta = (await (await fetch(base + "site.json")).json()) as SiteMeta;
    const buf = await (await fetch(base + meta.heights.file)).arrayBuffer();
    const dm = new Uint16Array(buf);
    if (dm.length !== meta.size * meta.size) throw new Error("bad height grid");
    const relief = new Float32Array(dm.length);
    const zero = meta.elevation - meta.heights.offset;
    for (let i = 0; i < dm.length; i++) relief[i] = dm[i] / 10 - zero;
    let ortho: THREE.Texture | undefined;
    try {
      ortho = await new THREE.TextureLoader().loadAsync(base + meta.ortho.file);
    } catch {
      ortho = undefined;
    }
    return { meta, relief, ortho };
  } catch (e) {
    console.warn("Terrain data unavailable; using flat ground.", e);
    return null;
  }
}

/**
 * Game-space height grid with the base pad levelled (pure, testable).
 * `stride` samples every n-th DEM post (2 → 40 m real / 2.5 m game spacing).
 */
export function gameHeights(
  data: Pick<TerrainData, "meta" | "relief">,
  stride = 1,
) {
  const { realSpacing, compression } = data.meta;
  const src = data.meta.size;
  const size = Math.floor((src - 1) / stride) + 1;
  const spacing = (realSpacing * stride) / compression;
  const half = ((size - 1) * spacing) / 2;
  const h = new Float32Array(size * size);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const x = -half + c * spacing,
        z = -half + r * spacing;
      const d = Math.hypot(x, z);
      const t = THREE.MathUtils.smoothstep(d, PAD_RADIUS, BLEND_RADIUS);
      h[r * size + c] =
        (data.relief[r * stride * src + c * stride] / compression) * t;
    }
  return { heights: h, size, spacing, half };
}
export const TERRAIN_STRIDE = 2;

export function createTerrain(
  scene: THREE.Scene,
  world: RAPIER.World,
  data: TerrainData,
) {
  const { heights, size, spacing, half } = gameHeights(data, TERRAIN_STRIDE);
  const at = (r: number, c: number) =>
    heights[
      THREE.MathUtils.clamp(r, 0, size - 1) * size +
        THREE.MathUtils.clamp(c, 0, size - 1)
    ];
  /** Bilinear height at a game-space position. */
  function heightAt(x: number, z: number) {
    const fc = (x + half) / spacing,
      fr = (z + half) / spacing;
    const c = Math.floor(fc),
      r = Math.floor(fr),
      u = fc - c,
      v = fr - r;
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(at(r, c), at(r, c + 1), u),
      THREE.MathUtils.lerp(at(r + 1, c), at(r + 1, c + 1), u),
      v,
    );
  }

  // Render mesh: row r → +z (south), column c → +x (east).
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(size * size * 3),
    uv = new Float32Array(size * size * 2);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      pos.set([-half + c * spacing, heights[i], -half + r * spacing], i * 3);
      uv.set([c / (size - 1), 1 - r / (size - 1)], i * 2);
    }
  const index: number[] = [];
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++) {
      const a = r * size + c,
        b = a + 1,
        d = a + size,
        e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  geo.setIndex(index);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  // Steeper slopes read as darker, rockier ground.
  const n = geo.getAttribute("normal") as THREE.BufferAttribute;
  const col = new Float32Array(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    const steep = THREE.MathUtils.smoothstep(1 - n.getY(i), 0.04, 0.35);
    col.set([1 - 0.16 * steep, 1 - 0.22 * steep, 1 - 0.26 * steep], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();

  const detail = detailTexture();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9805b,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
  });
  if (data.ortho) {
    data.ortho.colorSpace = THREE.NoColorSpace; // brightness data, not colour
    data.ortho.anisotropy = 4;
    mat.map = data.ortho;
  }
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detail };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vGround;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xz;",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vGround;\nuniform sampler2D detailMap;",
      )
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
          float lum = texture2D(map, vMapUv).r;
          diffuseColor.rgb *= mix(0.6, 1.28, lum);
        #endif
        float det = texture2D(detailMap, vGround * 0.31).r * 0.6
          + texture2D(detailMap, vGround * 0.047).r * 0.4;
        diffuseColor.rgb *= mix(0.84, 1.12, det);`,
      );
  };
  mat.customProgramCacheKey = () => "nebula-terrain";
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "MarsTerrain";
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Collider: the exact render triangles, so feet and visuals always agree.
  world.createCollider(
    // FIX_INTERNAL_EDGES stops the character snagging on shared triangle edges.
    RAPIER.ColliderDesc.trimesh(
      pos,
      new Uint32Array(index),
      RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
    ),
  );
  // Keep explorers on the mapped area.
  const wall = half - 2;
  for (const [x, z, hx, hz] of [
    [wall, 0, 0.5, half],
    [-wall, 0, 0.5, half],
    [0, wall, half, 0.5],
    [0, -wall, half, 0.5],
  ])
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, 40, hz).setTranslation(x, 20, z),
    );

  scatterRocks(scene, heightAt, half);
  return { mesh, heightAt, half, meta: data.meta };
}

/** Tileable value-noise texture for close-range ground grain. */
function detailTexture() {
  const N = 128,
    data = new Uint8Array(N * N * 4);
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grid = (g: number) => {
    const v = Array.from({ length: g * g }, rnd);
    return (x: number, y: number) => {
      const fx = (x / N) * g,
        fy = (y / N) * g;
      const x0 = Math.floor(fx),
        y0 = Math.floor(fy),
        u = fx - x0,
        w = fy - y0;
      const s = (a: number, b: number) => v[((b % g) * g + (a % g)) % (g * g)];
      const sm = (t: number) => t * t * (3 - 2 * t);
      return THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(s(x0, y0), s(x0 + 1, y0), sm(u)),
        THREE.MathUtils.lerp(s(x0, y0 + 1), s(x0 + 1, y0 + 1), sm(u)),
        sm(w),
      );
    };
  };
  const o1 = grid(8),
    o2 = grid(16),
    o3 = grid(32);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = o1(x, y) * 0.5 + o2(x, y) * 0.3 + o3(x, y) * 0.2;
      const b = Math.round(v * 255);
      data.set([b, b, b, 255], (y * N + x) * 4);
    }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

function scatterRocks(
  scene: THREE.Scene,
  heightAt: (x: number, z: number) => number,
  half: number,
) {
  let seed = 74;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9c5138,
    roughness: 1,
    flatShading: true,
  });
  const count = 520;
  const rocks = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    e = new THREE.Euler(),
    p = new THREE.Vector3(),
    sc = new THREE.Vector3();
  let placed = 0;
  for (let k = 0; placed < count && k < count * 4; k++) {
    // Denser further out; the base's own yard stays mostly clear.
    const r = 11 + Math.pow(rand(), 0.7) * (half - 14);
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (Math.abs(x) > half - 3 || Math.abs(z) > half - 3) continue;
    // Keep paths between station props free.
    if (r < 18 && rand() < 0.75) continue;
    const big = rand() < 0.06 && r > 30;
    const s = big ? 0.8 + rand() * 1.6 : 0.12 + rand() * 0.38;
    p.set(x, heightAt(x, z) + s * 0.18, z);
    e.set(rand() * 3, rand() * 3, rand() * 3);
    sc.set(s * (0.8 + rand() * 0.5), s * (0.45 + rand() * 0.3), s);
    rocks.setMatrixAt(placed++, m.compose(p, q.setFromEuler(e), sc));
  }
  rocks.count = placed;
  rocks.receiveShadow = true;
  rocks.castShadow = false; // pebbles: shadow pass cost outweighs the look
  rocks.name = "Rocks";
  scene.add(rocks);
}
