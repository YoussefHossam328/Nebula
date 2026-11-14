import * as THREE from "three";

/**
 * Atmosphere and particle effects. Purely cosmetic: nothing here feeds the
 * simulation. All shaders guard their domains (no NaN-producing math).
 */
const DAY_ZENITH = new THREE.Color(0xb97a58);
const DAY_HORIZON = new THREE.Color(0xe3b48a);
const NIGHT_ZENITH = new THREE.Color(0x070a16);
const NIGHT_HORIZON = new THREE.Color(0x1b2033);
const STORM_TINT = new THREE.Color(0xc4834f);

function softDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createFX(scene: THREE.Scene) {
  const dot = softDot();

  // ---------- Sky dome ----------
  const skyUniforms = {
    sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    zenith: { value: DAY_ZENITH.clone() },
    horizon: { value: DAY_HORIZON.clone() },
    night: { value: 0 },
    storm: { value: 0 },
    time: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 sunDir; uniform vec3 zenith; uniform vec3 horizon;
        uniform float night; uniform float storm; uniform float time;
        varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main() {
          float len = max(length(vDir), 1e-4);
          vec3 d = vDir / len;
          float h = clamp(d.y, -1.0, 1.0);
          float up = clamp(h * 1.6, 0.0, 1.0);
          vec3 col = mix(horizon, zenith, pow(up, 0.75));
          // Below the horizon blend into a dusty ground haze.
          col = mix(col, horizon * 0.82, clamp(-h * 4.0, 0.0, 1.0));
          float sl = max(length(sunDir), 1e-4);
          vec3 s = sunDir / sl;
          float mu = clamp(dot(d, s), -1.0, 1.0);
          float sunUp = clamp(s.y * 3.0 + 0.4, 0.0, 1.0);
          // Mars sunsets: forward scattering makes a blue halo around the Sun.
          float halo = pow(max(mu, 0.0), 18.0);
          float lowSun = 1.0 - clamp(s.y * 2.2, 0.0, 1.0);
          vec3 blue = vec3(0.55, 0.70, 0.85);
          col = mix(col, blue, halo * (0.25 + 0.55 * lowSun) * sunUp * (1.0 - storm * 0.7));
          col += vec3(1.0, 0.86, 0.66) * pow(max(mu, 0.0), 6.0) * 0.12 * sunUp;
          float disc = smoothstep(0.9993, 0.99975, mu) * sunUp;
          col = mix(col, vec3(1.0, 0.97, 0.9), disc * (1.0 - storm * 0.85));
          // Stars at night, twinkling slightly.
          if (night > 0.01 && h > 0.0) {
            vec3 cell = floor(d * 220.0);
            float r = hash(cell);
            float star = step(0.9965, r) * (0.55 + 0.45 * sin(time * 2.0 + r * 60.0));
            col += vec3(0.9, 0.92, 1.0) * star * night * clamp(h * 3.0, 0.0, 1.0) * (1.0 - storm);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // ---------- Ambient dust motes and storm dust ----------
  const MOTES = 700;
  const moteBox = 26;
  const motePos = new Float32Array(MOTES * 3);
  const moteSeed = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * moteBox;
    motePos[i * 3 + 1] = Math.random() * 6;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * moteBox;
    moteSeed[i] = Math.random();
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xf1c79a,
    size: 0.09,
    map: dot,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  scene.add(motes);

  // ---------- Burst particles (footstep puffs, landing, sparkles) ----------
  const MAX = 260;
  const pPos = new Float32Array(MAX * 3);
  const pCol = new Float32Array(MAX * 3);
  const pSize = new Float32Array(MAX);
  const pAlpha = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const maxLife = new Float32Array(MAX);
  const grow = new Float32Array(MAX);
  const drag = new Float32Array(MAX);
  const gravity = new Float32Array(MAX);
  const baseAlpha = new Float32Array(MAX);
  let cursor = 0;
  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  burstGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  burstGeo.setAttribute("size", new THREE.BufferAttribute(pSize, 1));
  burstGeo.setAttribute("alpha", new THREE.BufferAttribute(pAlpha, 1));
  const burstMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: dot }, scale: { value: 600 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float size; attribute float alpha; attribute vec3 color;
      uniform float scale; varying float vAlpha; varying vec3 vColor;
      void main() {
        vAlpha = alpha; vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / max(-mv.z, 0.1);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; varying float vAlpha; varying vec3 vColor;
      void main() {
        vec4 t = texture2D(map, gl_PointCoord);
        float a = t.a * clamp(vAlpha, 0.0, 1.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }`,
  });
  const bursts = new THREE.Points(burstGeo, burstMat);
  bursts.frustumCulled = false;
  bursts.renderOrder = 3;
  scene.add(bursts);

  function emit(
    p: { x: number; y: number; z: number },
    count: number,
    o: {
      color: number;
      speed: number;
      up: number;
      size: number;
      life: number;
      alpha?: number;
      spread?: number;
      gravity?: number;
      drag?: number;
      grow?: number;
    },
  ) {
    const color = new THREE.Color(o.color);
    for (let n = 0; n < count; n++) {
      const i = cursor;
      cursor = (cursor + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (o.spread ?? 0.15);
      pPos[i * 3] = p.x + Math.cos(a) * r;
      pPos[i * 3 + 1] = p.y + Math.random() * 0.05;
      pPos[i * 3 + 2] = p.z + Math.sin(a) * r;
      const sp = o.speed * (0.4 + Math.random() * 0.8);
      vel[i * 3] = Math.cos(a) * sp;
      vel[i * 3 + 1] = o.up * (0.5 + Math.random());
      vel[i * 3 + 2] = Math.sin(a) * sp;
      const shade = 0.85 + Math.random() * 0.25;
      pCol[i * 3] = color.r * shade;
      pCol[i * 3 + 1] = color.g * shade;
      pCol[i * 3 + 2] = color.b * shade;
      pSize[i] = o.size * (0.7 + Math.random() * 0.6);
      maxLife[i] = life[i] = o.life * (0.7 + Math.random() * 0.6);
      baseAlpha[i] = o.alpha ?? 0.6;
      gravity[i] = o.gravity ?? -0.4;
      drag[i] = o.drag ?? 2.2;
      grow[i] = o.grow ?? 1.4;
    }
  }

  // Low glow disc under the player for interaction feedback (shown by caller).
  let wind = 0;
  const state = { storm: 0, night: 0, radiation: 0 };

  return {
    state,
    footstep(p: { x: number; y: number; z: number }, running: boolean) {
      emit(p, running ? 5 : 3, {
        color: 0xc98a5f,
        speed: running ? 0.9 : 0.55,
        up: 0.35,
        size: running ? 0.32 : 0.24,
        life: 0.9,
        alpha: 0.45,
      });
    },
    land(p: { x: number; y: number; z: number }, strength: number) {
      emit(p, Math.round(10 + 14 * strength), {
        color: 0xc68660,
        speed: 1.4 + strength * 1.2,
        up: 0.45,
        size: 0.42,
        life: 1.2,
        alpha: 0.55,
        spread: 0.3,
      });
    },
    jump(p: { x: number; y: number; z: number }) {
      emit(p, 7, {
        color: 0xc98a5f,
        speed: 0.9,
        up: 0.2,
        size: 0.3,
        life: 0.8,
        alpha: 0.45,
      });
    },
    sparkle(p: { x: number; y: number; z: number }) {
      emit(p, 46, {
        color: 0xcff7ff,
        speed: 1.6,
        up: 2.2,
        size: 0.16,
        life: 1.4,
        alpha: 1,
        spread: 1.4,
        gravity: -1.6,
        drag: 1.2,
        grow: -0.4,
      });
      emit(p, 24, {
        color: 0xe9b787,
        speed: 1.8,
        up: 0.8,
        size: 0.5,
        life: 1.6,
        alpha: 0.5,
        spread: 1.2,
      });
    },
    /**
     * @param sunDir world direction towards the Sun
     * @param day 0..1 daylight factor; storm/radiation 0..1 targets
     */
    update(
      dt: number,
      elapsed: number,
      camera: THREE.Camera,
      focus: THREE.Vector3,
      env: {
        sunDir: { x: number; y: number; z: number };
        day: number;
        storm: number;
        fog: THREE.Fog;
      },
    ) {
      const k = 1 - Math.exp(-dt * 1.5);
      state.storm += (env.storm - state.storm) * k;
      state.night += (1 - env.day - state.night) * k;
      skyUniforms.sunDir.value.set(env.sunDir.x, env.sunDir.y, env.sunDir.z);
      if (skyUniforms.sunDir.value.lengthSq() < 1e-6)
        skyUniforms.sunDir.value.set(0, 1, 0);
      skyUniforms.night.value = state.night;
      skyUniforms.storm.value = state.storm;
      skyUniforms.time.value = elapsed;
      const z = skyUniforms.zenith.value
        .copy(DAY_ZENITH)
        .lerp(NIGHT_ZENITH, state.night)
        .lerp(STORM_TINT, state.storm * 0.75 * (1 - state.night * 0.6));
      const h = skyUniforms.horizon.value
        .copy(DAY_HORIZON)
        .lerp(NIGHT_HORIZON, state.night)
        .lerp(STORM_TINT, state.storm * 0.85 * (1 - state.night * 0.6));
      void z;
      env.fog.color.copy(h).multiplyScalar(0.92);
      env.fog.near = THREE.MathUtils.lerp(40, 6, state.storm);
      env.fog.far = THREE.MathUtils.lerp(160, 30, state.storm);
      sky.position.copy(camera.position);

      // Motes follow the focus point and wrap around it.
      wind += dt * (0.25 + state.storm * 5.5);
      const visible = Math.round(
        THREE.MathUtils.lerp(180, MOTES, Math.min(1, state.storm * 1.2)),
      );
      moteGeo.setDrawRange(0, visible);
      moteMat.size = 0.07 + state.storm * 0.08;
      moteMat.opacity = (0.28 + state.storm * 0.45) * (1 - state.night * 0.55);
      const windX = 0.35 + state.storm * 6.5;
      const windZ = 0.12 + state.storm * 1.8;
      const half = moteBox / 2;
      for (let i = 0; i < visible; i++) {
        const s = moteSeed[i];
        motePos[i * 3] += (windX * (0.6 + s * 0.8)) * dt;
        motePos[i * 3 + 1] += Math.sin(wind * 0.6 + s * 40) * 0.12 * dt;
        motePos[i * 3 + 2] += (windZ + Math.cos(wind * 0.4 + s * 20) * 0.2) * dt;
        let x = motePos[i * 3] - focus.x,
          zz = motePos[i * 3 + 2] - focus.z;
        if (x > half) x -= moteBox;
        else if (x < -half) x += moteBox;
        if (zz > half) zz -= moteBox;
        else if (zz < -half) zz += moteBox;
        motePos[i * 3] = focus.x + x;
        motePos[i * 3 + 2] = focus.z + zz;
        if (motePos[i * 3 + 1] < 0.05) motePos[i * 3 + 1] = 5.5;
        if (motePos[i * 3 + 1] > 6) motePos[i * 3 + 1] = 0.1;
      }
      moteGeo.attributes.position.needsUpdate = true;

      // Integrate burst particles.
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) {
          pAlpha[i] = 0;
          continue;
        }
        life[i] -= dt;
        const t = 1 - Math.max(0, life[i]) / maxLife[i];
        const d = Math.exp(-drag[i] * dt);
        vel[i * 3] *= d;
        vel[i * 3 + 2] *= d;
        vel[i * 3 + 1] = vel[i * 3 + 1] * d + gravity[i] * dt;
        pPos[i * 3] += vel[i * 3] * dt;
        pPos[i * 3 + 1] = Math.max(0.02, pPos[i * 3 + 1] + vel[i * 3 + 1] * dt);
        pPos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        pSize[i] = Math.max(0.01, pSize[i] * (1 + grow[i] * dt));
        pAlpha[i] = baseAlpha[i] * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (1 - t);
      }
      burstGeo.attributes.position.needsUpdate = true;
      burstGeo.attributes.size.needsUpdate = true;
      burstGeo.attributes.alpha.needsUpdate = true;
      burstGeo.attributes.color.needsUpdate = true;
    },
    resize(height: number, pixelRatio: number) {
      burstMat.uniforms.scale.value = height * pixelRatio * 0.5;
    },
  };
}
export type FX = ReturnType<typeof createFX>;
