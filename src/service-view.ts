/**
 * Shared shell for hands-on service views (harvest, oxygen plant). Mirrors the
 * solar cleaning card so all three minigames feel like one family.
 */
export function serviceShell(o: {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  stageClass: string;
  canvasLabel: string;
  meter: string;
  tip: string;
  actions?: string;
}) {
  const root = document.createElement("section");
  root.id = o.id;
  root.className = "service-game";
  root.hidden = true;
  root.setAttribute("aria-label", o.label);
  root.innerHTML = `
    <div class="clean-card">
      <div class="clean-head">
        <div>
          <span class="clean-eyebrow">${o.eyebrow}</span>
          <h2>${o.title}</h2>
        </div>
        <div class="service-actions">${o.actions ?? ""}<button class="service-close" type="button" aria-label="Close service view">Done <kbd>Esc</kbd></button></div>
      </div>
      <div class="clean-stage ${o.stageClass}">
        <canvas class="service-canvas" aria-label="${o.canvasLabel}"></canvas>
        <div class="clean-toast" hidden></div>
      </div>
      <div class="clean-foot">
        <div class="clean-meter">
          <span>${o.meter}</span>
          <div class="clean-bar"><i></i></div>
          <b>0%</b>
        </div>
        <p class="service-tip">${o.tip}</p>
        <p class="clean-trans service-status"></p>
      </div>
    </div>`;
  document.body.append(root);
  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const fill = root.querySelector<HTMLElement>(".clean-bar i")!;
  const pct = root.querySelector<HTMLElement>(".clean-meter b")!;
  const toast = root.querySelector<HTMLElement>(".clean-toast")!;
  const status = root.querySelector<HTMLElement>(".service-status")!;
  const tip = root.querySelector<HTMLElement>(".service-tip")!;
  const closeButton = root.querySelector<HTMLButtonElement>(".service-close")!;
  let lastPct = "",
    lastStatus = "";
  return {
    root,
    canvas,
    ctx: canvas.getContext("2d")!,
    toast,
    tip,
    closeButton,
    /** Cached DOM writes: avoid style recalculation every animation frame. */
    meter(fraction: number) {
      const v = Math.max(0, Math.min(1, fraction));
      const t = Math.floor(v * 100) + "%";
      if (t === lastPct) return;
      lastPct = t;
      fill.style.width = (v * 100).toFixed(1) + "%";
      pct.textContent = t;
    },
    status(text: string) {
      if (text === lastStatus) return;
      lastStatus = text;
      status.textContent = text;
    },
    showToast(text: string) {
      toast.textContent = text;
      toast.hidden = false;
    },
    reset() {
      lastPct = lastStatus = "";
      toast.hidden = true;
      root.classList.remove("is-done");
    },
    /** Size the canvas backing store to its box; returns device pixel ratio. */
    fit() {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      return dpr;
    },
  };
}
export type ServiceShell = ReturnType<typeof serviceShell>;
