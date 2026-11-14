export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  /** Virtual joystick vector from touch controls (x right, z forward). */
  analog = { x: 0, z: 0 };
  constructor(canvas: HTMLCanvasElement) {
    const codes = [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "ShiftLeft",
      "ShiftRight",
      "KeyC",
      "KeyE",
      "KeyR",
    ];
    window.addEventListener("keydown", (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement ||
        (e.target instanceof Element &&
          Boolean(e.target.closest(".training, .lil-gui")))
      )
        return;
      if (!codes.includes(e.code)) return;
      e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => this.clear());
    canvas.addEventListener("pointerdown", () => canvas.focus());
  }
  down(...codes: string[]) {
    return codes.some((c) => this.keys.has(c));
  }
  take(code: string) {
    const p = this.pressed.has(code);
    this.pressed.delete(code);
    return p;
  }
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.analog = { x: 0, z: 0 };
  }
  axes() {
    let x =
      Number(this.down("KeyD", "ArrowRight")) -
      Number(this.down("KeyA", "ArrowLeft")) +
      this.analog.x;
    let z =
      Number(this.down("KeyW", "ArrowUp")) -
      Number(this.down("KeyS", "ArrowDown")) +
      this.analog.z;
    const l = Math.hypot(x, z);
    if (l > 1) {
      x /= l;
      z /= l;
    }
    return { x, z };
  }
}
