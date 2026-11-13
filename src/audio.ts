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
      if (!this.loading)
        this.loading = Promise.all(
          soundFiles.map(async (name) => {
            try {
              const response = await fetch(
                import.meta.env.BASE_URL + `audio/${name}.wav`,
              );
              if (!response.ok) throw Error("Audio file unavailable");
              const b = await this.context!.decodeAudioData(
                await response.arrayBuffer(),
              );
              this.buffers.set(name, b);
            } catch {
              this.failed++;
            }
          }),
        ).then(() => {});
      await this.loading;
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
  sync() {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    this.master.gain.setTargetAtTime(
      this.settings.audioEnabled ? this.settings.masterVolume : 0,
      t,
      0.03,
    );
    this.ambient!.gain.setTargetAtTime(this.settings.ambientVolume, t, 0.03);
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
  preview() {
    this.unlocked = true;
    void this.ensure().then(() => this.play("land"));
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
