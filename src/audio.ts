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
  sync() {
    if (!this.context || !this.master) return;
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
  update(p: { x: number; z: number }, grounded: boolean, running: boolean) {
    this.sync();
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
