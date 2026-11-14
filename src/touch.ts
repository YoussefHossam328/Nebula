import type { Input } from "./input";

/**
 * On-screen controls for touch devices. Buttons emit the same key codes as the
 * keyboard (via synthetic events) so tutorials and interactions stay identical.
 */
export function touchControls(input: Input) {
  const root = document.createElement("section");
  root.id = "touch-controls";
  root.setAttribute("aria-label", "Touch controls");
  root.innerHTML = `
    <div class="touch-stick" id="touch-stick"><div class="touch-knob" id="touch-knob"></div></div>
    <div class="touch-buttons">
      <button type="button" data-code="KeyE" class="touch-use">USE</button>
      <button type="button" data-code="Space" class="touch-jump">JUMP</button>
      <button type="button" data-code="KeyC" data-toggle="1" class="touch-crouch">CROUCH</button>
      <button type="button" data-code="ShiftLeft" data-toggle="1" class="touch-run">RUN</button>
    </div>`;
  document.body.append(root);
  const key = (type: "keydown" | "keyup", code: string) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));

  const enable = () => document.body.classList.add("touch");
  if (window.matchMedia?.("(pointer: coarse)").matches) enable();
  window.addEventListener("touchstart", enable, { passive: true, once: true });
  if (new URLSearchParams(location.search).has("touch")) enable();

  for (const b of root.querySelectorAll<HTMLButtonElement>("button")) {
    const code = b.dataset.code!;
    const toggle = Boolean(b.dataset.toggle);
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (toggle) {
        const on = !b.classList.contains("on");
        b.classList.toggle("on", on);
        key(on ? "keydown" : "keyup", code);
      } else {
        b.classList.add("on");
        b.setPointerCapture(e.pointerId);
        key("keydown", code);
      }
    });
    const release = () => {
      if (toggle) return;
      b.classList.remove("on");
      key("keyup", code);
    };
    b.addEventListener("pointerup", release);
    b.addEventListener("pointercancel", release);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  const stick = root.querySelector<HTMLElement>("#touch-stick")!;
  const knob = root.querySelector<HTMLElement>("#touch-knob")!;
  let pointer = -1;
  let cx = 0,
    cy = 0;
  const radius = () => stick.clientWidth * 0.4;
  function move(e: PointerEvent) {
    const r = radius();
    let dx = e.clientX - cx,
      dy = e.clientY - cy;
    const l = Math.hypot(dx, dy);
    if (l > r) {
      dx *= r / l;
      dy *= r / l;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / r,
      ny = dy / r;
    const mag = Math.hypot(nx, ny);
    // Small dead zone; full deflection maps to keyboard-equivalent magnitude.
    input.analog =
      mag < 0.12 ? { x: 0, z: 0 } : { x: nx, z: -ny };
  }
  stick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    stick.classList.add("on");
    move(e);
  });
  stick.addEventListener("pointermove", (e) => {
    if (e.pointerId === pointer) move(e);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    stick.classList.remove("on");
    knob.style.transform = "";
    input.analog = { x: 0, z: 0 };
  };
  stick.addEventListener("pointerup", end);
  stick.addEventListener("pointercancel", end);

  return {
    /** Hide during menus/minigames; release any held toggles when hidden. */
    update(visible: boolean, prompt: string) {
      if (root.hidden === !visible) {
        root.querySelector<HTMLElement>(".touch-use")!.classList.toggle(
          "ready",
          /^(Hold )?E ·/.test(prompt),
        );
        return;
      }
      root.hidden = !visible;
      if (!visible) {
        input.analog = { x: 0, z: 0 };
        knob.style.transform = "";
        for (const b of root.querySelectorAll<HTMLButtonElement>("button.on")) {
          b.classList.remove("on");
          key("keyup", b.dataset.code!);
        }
      }
    },
  };
}
