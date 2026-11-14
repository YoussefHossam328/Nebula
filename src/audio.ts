import type { Settings } from "./config";
export const soundFiles = [
  "mars_bg_loop",
  "jump",
  "land",
  "walk_1",
  "walk_2",
  "walk_3",
  "sprint_1",
  "sprint_2",
  "sprint_3",
] as const;
type Sound = (typeof soundFiles)[number];
export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private ambient?: GainNode;
  private effects?: GainNode;
  private buffers = new Map<Sound, AudioBuffer>();
  private loading?: Promise<void>;
  private loop?: AudioBufferSourceNode;
  private distance = 0;
  private variant = 0;
  private lastPosition?: { x: number; z: number };
  private active = new Set<AudioBufferSourceNode>();
  private unlocked = false;
  played = 0;
  /** Called on each synthesized footstep (used for dust puffs). */
  onStep?: (running: boolean) => void;
  private scrubGain?: GainNode;
  private scrubFilter?: BiquadFilterNode;
  failed = 0;
  lastSound = "";
  constructor(private settings: Settings) {
    const unlock = () => {
      this.unlocked = true;
      void this.ensure();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("blur", () => this.suspend());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.suspend();
      else if (this.unlocked) void this.ensure();
    });
    window.addEventListener("focus", () => {
      if (this.unlocked) void this.ensure();
    });
  }
  private suspend() {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {}
    }
    this.active.clear();
    this.distance = 0;
    this.lastPosition = undefined;
    void this.context?.suspend().catch(() => {});
  }
  private async ensure() {
    try {
      if (!this.settings.audioEnabled || document.hidden) return;
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.ambient = this.context.createGain();
        this.effects = this.context.createGain();
        this.ambient.connect(this.master);
        this.effects.connect(this.master);
      }
      if (this.context.state === "suspended") await this.context.resume();
      this.lastSync = "";
      if (!this.loading) {
        // Original synthesized sound design: filtered grains, no external recordings.
        for (const name of soundFiles) {
          const ambient = name === "mars_bg_loop";
          const duration = ambient ? 4 : name === "jump" ? 0.18 : 0.25;
          const buffer = this.context.createBuffer(
            1,
            Math.ceil(this.context.sampleRate * duration),
            this.context.sampleRate,
          );
          const data = buffer.getChannelData(0);
          let low = 0;
          for (let i = 0; i < data.length; i++) {
            const t = i / this.context.sampleRate;
            low += (Math.random() * 2 - 1 - low) * (ambient ? 0.003 : 0.09);
            const envelope = ambient
              ? 0.13
              : Math.sin((Math.PI * t) / duration) * Math.exp(-t * 14);
            data[i] = low * envelope * (ambient ? 1 : 0.7);
          }
          this.buffers.set(name, buffer);
        }
        this.loading = Promise.resolve();
      }
      if (!this.loop && this.buffers.has("mars_bg_loop")) {
        this.loop = this.context.createBufferSource();
        this.loop.buffer = this.buffers.get("mars_bg_loop")!;
        this.loop.loop = true;
        this.loop.connect(this.ambient!);
        this.loop.start();
      }
      this.sync();
    } catch {
      /* Audio permission/device failures never stop the game. */
    }
  }
  private sceneMuted = true;
  private indoors = false;
  private storm = false;
  setScene(muted: boolean, indoors: boolean, storm: boolean) {
    this.sceneMuted = muted;
    this.indoors = indoors;
    this.storm = storm;
  }
  private lastSync = "";
  sync() {
    if (!this.context || !this.master) return;
    const key = [
      this.settings.audioEnabled,
      this.sceneMuted,
      this.settings.masterVolume,
      this.settings.ambientVolume,
      this.settings.effectsVolume,
      this.indoors,
      this.storm,
    ].join();
    // Re-scheduling identical ramps every frame floods the automation timeline.
    if (key === this.lastSync) return;
    this.lastSync = key;
    const t = this.context.currentTime;
    this.master.gain.setTargetAtTime(
      this.settings.audioEnabled && !this.sceneMuted
        ? this.settings.masterVolume
        : 0,
      t,
      0.03,
    );
    this.ambient!.gain.setTargetAtTime(
      this.settings.ambientVolume *
        (this.indoors ? 0.15 : this.storm ? 1 : 0.4),
      t,
      0.2,
    );
    this.effects!.gain.setTargetAtTime(this.settings.effectsVolume, t, 0.03);
  }
  play(name: Sound) {
    if (
      !this.settings.audioEnabled ||
      document.hidden ||
      this.context?.state !== "running"
    )
      return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.effects!);
    source.onended = () => this.active.delete(source);
    this.active.add(source);
    source.start();
    this.played++;
    this.lastSound = name;
  }
  /** Footsteps driven by the animation's foot contacts (preferred). */
  animationSteps = false;
  step(running: boolean) {
    this.play(
      `${running ? "sprint" : "walk"}_${(this.variant++ % 3) + 1}` as Sound,
    );
    this.onStep?.(running);
  }
  update(p: { x: number; z: number }, grounded: boolean, running: boolean) {
    this.sync();
    if (this.animationSteps) {
      this.lastPosition = undefined;
      return;
    }
    if (this.lastPosition) {
      const dist = Math.hypot(
        p.x - this.lastPosition.x,
        p.z - this.lastPosition.z,
      );
      if (dist < 2 && grounded && document.hasFocus()) {
        this.distance += dist;
        const interval = running
          ? this.settings.runStepDistance
          : this.settings.walkStepDistance;
        if (this.distance >= interval) {
          this.distance %= interval;
          this.play(
            `${running ? "sprint" : "walk"}_${(this.variant++ % 3) + 1}` as Sound,
          );
          this.onStep?.(running);
        }
      } else this.distance = 0;
    }
    this.lastPosition = { x: p.x, z: p.z };
  }
  cue() {
    if (!this.context || this.context.state !== "running" || this.sceneMuted)
      return;
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 280;
    gain.gain.setValueAtTime(0, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, this.context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.context.currentTime + 0.35,
    );
    oscillator.connect(gain);
    gain.connect(this.effects!);
    oscillator.start();
    oscillator.stop(this.context.currentTime + 0.4);
  }
  /** Continuous brush-on-glass hiss; intensity 0..1 follows scrub speed. */
  scrub(intensity: number) {
    if (!this.context || this.context.state !== "running" || !this.effects)
      return;
    if (!this.scrubGain) {
      const ctx = this.context;
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buffer.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) {
        b = 0.6 * b + 0.4 * (Math.random() * 2 - 1);
        d[i] = b;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      this.scrubFilter = ctx.createBiquadFilter();
      this.scrubFilter.type = "bandpass";
      this.scrubFilter.Q.value = 0.8;
      this.scrubFilter.frequency.value = 1400;
      this.scrubGain = ctx.createGain();
      this.scrubGain.gain.value = 0;
      src.connect(this.scrubFilter);
      this.scrubFilter.connect(this.scrubGain);
      // Bypass the world bus mute: the service view is a UI interaction.
      const ui = ctx.createGain();
      ui.gain.value = 1;
      this.scrubGain.connect(ui);
      ui.connect(ctx.destination);
      src.start();
    }
    const t = this.context.currentTime;
    const i = Math.max(0, Math.min(1, intensity));
    const vol = this.settings.audioEnabled
      ? this.settings.masterVolume * this.settings.effectsVolume * 0.22 * i
      : 0;
    this.scrubGain.gain.setTargetAtTime(vol, t, 0.04);
    this.scrubFilter!.frequency.setTargetAtTime(900 + 1600 * i, t, 0.05);
  }
  private hissGain?: GainNode;
  private hissPan?: StereoPannerNode;
  /** Escaping-gas hiss for the oxygen plant view; pan -1..1 points at the leak. */
  hiss(intensity: number, pan: number) {
    if (!this.context || this.context.state !== "running") return;
    const ctx = this.context;
    if (!this.hissGain) {
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 3200;
      this.hissGain = ctx.createGain();
      this.hissGain.gain.value = 0;
      this.hissPan = ctx.createStereoPanner();
      src.connect(hp);
      hp.connect(this.hissGain);
      this.hissGain.connect(this.hissPan);
      this.hissPan.connect(ctx.destination);
      src.start();
    }
    const t = ctx.currentTime;
    const i = Math.max(0, Math.min(1, intensity));
    const vol = this.settings.audioEnabled
      ? this.settings.masterVolume * this.settings.effectsVolume * 0.16 * i * i
      : 0;
    this.hissGain.gain.setTargetAtTime(vol, t, 0.06);
    this.hissPan!.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.06);
  }
  private blip(
    f0: number,
    f1: number,
    dur: number,
    vol: number,
    type: OscillatorType = "square",
    delay = 0,
  ) {
    if (!this.context || this.context.state !== "running") return;
    const ctx = this.context;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    const t0 = ctx.currentTime + delay;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(
      (this.settings.audioEnabled ? 1 : 0) *
        this.settings.masterVolume *
        this.settings.effectsVolume *
        vol,
      t0,
    );
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  /** Shears snip / feedback for the harvest view. */
  snip(kind: "clean" | "bruised" | "wasted" | "leaf" | "nick") {
    this.blip(2400, 900, 0.05, 0.08, "square");
    this.blip(1800, 600, 0.04, 0.05, "triangle", 0.03);
    if (kind === "clean") this.blip(880, 1320, 0.16, 0.05, "sine", 0.05);
    if (kind === "wasted" || kind === "nick")
      this.blip(220, 140, 0.22, 0.07, "sawtooth", 0.04);
  }
  /** Tape-sealed confirmation. */
  sealed() {
    this.blip(660, 990, 0.18, 0.06, "triangle");
    this.blip(990, 1320, 0.22, 0.05, "triangle", 0.1);
  }
  private geigerAt = 0;
  /** Radiation counter clicks; rate in clicks per second (Poisson). */
  geiger(rate: number, dt: number) {
    if (!this.context || this.context.state !== "running" || this.sceneMuted)
      return;
    this.geigerAt -= dt * rate;
    while (this.geigerAt <= 0) {
      this.geigerAt += -Math.log(1 - Math.random() * 0.999);
      if (rate > 0.05) this.blip(3200, 1600, 0.008, 0.06, "square", Math.random() * dt);
    }
  }
  /** Two-note confirmation when the array is fully clean. */
  chime() {
    if (!this.context || this.context.state !== "running") return;
    const ctx = this.context;
    const out = ctx.createGain();
    out.gain.value =
      (this.settings.audioEnabled ? 1 : 0) *
      this.settings.masterVolume *
      this.settings.effectsVolume;
    out.connect(ctx.destination);
    [523.25, 783.99, 1046.5].forEach((f, k) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t0 = ctx.currentTime + k * 0.11;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.09, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
      o.connect(g);
      g.connect(out);
      o.start(t0);
      o.stop(t0 + 0.75);
    });
    setTimeout(() => out.disconnect(), 1400);
  }
  preview() {
    this.unlocked = true;
    void this.ensure().then(() => {
      if (!this.context || !this.settings.audioEnabled || document.hidden)
        return;
      const buffer = this.buffers.get("land");
      if (!buffer) return;
      // Audition independently of the paused world bus, at the configured volumes.
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      gain.gain.value =
        this.settings.masterVolume * this.settings.effectsVolume;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.context.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
      this.played++;
      this.lastSound = "land";
    });
  }
  get status() {
    return {
      loaded: this.buffers.size,
      failed: this.failed,
      context: this.context?.state ?? "locked",
      played: this.played,
      lastSound: this.lastSound,
    };
  }
}
