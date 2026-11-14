/**
 * Oxygen plant service view. Punctures are invisible until found: listen for
 * the hiss (it pans left/right and grows louder as the nozzle nears a leak),
 * then hold to spray leak-detector solution. Foam bubbles reveal a leak; press
 * on it and circle around to wind sealing tape (two full turns). The maker
 * switch lives here too. Owns no simulation state.
 */
import { serviceShell } from "./service-view";

type Pt = { x: number; y: number };
type Leak = { x: number; y: number; found: number; sealed: boolean; wrap: number; seed: number };
const VW = 1000,
  VH = 600;

// Pipe network in view units: tank → electrolysis unit → manifold → habitat.
const PIPES: Pt[][] = [
  [
    { x: 250, y: 180 },
    { x: 380, y: 180 },
    { x: 380, y: 240 },
    { x: 420, y: 240 },
  ],
  [
    { x: 250, y: 400 },
    { x: 330, y: 400 },
    { x: 330, y: 460 },
    { x: 640, y: 460 },
    { x: 640, y: 380 },
  ],
  [
    { x: 640, y: 250 },
    { x: 760, y: 250 },
    { x: 760, y: 140 },
    { x: 960, y: 140 },
  ],
  [
    { x: 760, y: 250 },
    { x: 760, y: 420 },
    { x: 960, y: 420 },
  ],
];
function pointOnPipes(u: number) {
  const segs: [Pt, Pt, number][] = [];
  let total = 0;
  for (const p of PIPES)
    for (let i = 1; i < p.length; i++) {
      const l = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
      segs.push([p[i - 1], p[i], l]);
      total += l;
    }
  let d = u * total;
  for (const [a, b, l] of segs) {
    if (d <= l) return { x: a.x + ((b.x - a.x) * d) / l, y: a.y + ((b.y - a.y) * d) / l };
    d -= l;
  }
  return { ...PIPES[0][0] };
}

export function oxygenPlantGame(cb: {
  state(): { fraction: number; on: boolean; powered: boolean; netKgH: number };
  toggle(): boolean;
  sealed(): void;
  close(): void;
  /** spray / tape noise 0..1 */
  work(intensity: number): void;
  /** leak hiss loudness 0..1 and stereo pan -1..1 */
  hiss(intensity: number, pan: number): void;
}) {
  const ui = serviceShell({
    id: "oxygen-game",
    label: "Oxygen plant service",
    eyebrow: "OXYGEN PLANT · PRESSURE LINES",
    title: "Find and seal the leaks",
    stageClass: "service-stage-plant",
    canvasLabel: "Oxygen plant pipework. Hold to spray leak detector; circle a bubbling leak to tape it.",
    meter: "Sealed",
    tip: "Listen: the hiss pans toward a leak and gets louder. <b>Hold</b> to spray detector — leaks foam up. Then press on the foam and <b>circle</b> around it to wind tape (two turns).",
    actions: `<button class="service-switch" type="button" id="o2-switch">Maker ON</button>`,
  });
  const { canvas, ctx } = ui;
  const switchButton = ui.root.querySelector<HTMLButtonElement>("#o2-switch")!;
  let leaks: Leak[] = [];
  let mist: { x: number; y: number; vx: number; vy: number; life: number; r: number }[] = [];
  let bubbles: { x: number; y: number; r: number; life: number; vx: number; vy: number }[] = [];
  let open = false,
    raf = 0,
    lastT = 0,
    time = 0,
    dpr = 1,
    scale = 1,
    ox = 0,
    oy = 0,
    initial = 0,
    allSealedShown = false;
  const pointer = { x: -999, y: -999, down: false, taping: -1, lastAngle: 0, work: 0 };

  function syncSwitch() {
    const s = cb.state();
    switchButton.textContent = s.on ? (s.powered ? "Maker ON" : "Maker ON · no power") : "Maker OFF";
    switchButton.classList.toggle("off", !s.on);
    switchButton.setAttribute("aria-pressed", String(s.on));
  }
  switchButton.onclick = () => {
    cb.toggle();
    syncSwitch();
  };

  function resize() {
    dpr = ui.fit();
    scale = Math.min(canvas.width / VW, canvas.height / VH);
    ox = (canvas.width - VW * scale) / 2;
    oy = (canvas.height - VH * scale) / 2;
  }
  const toView = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * dpr - ox) / scale,
      y: ((e.clientY - r.top) * dpr - oy) / scale,
    };
  };

  function drawPipe(p: Pt[]) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1b1f22";
    ctx.lineWidth = 24;
    ctx.beginPath();
    p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
    ctx.strokeStyle = "#8d9aa1";
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y - 4) : ctx.moveTo(q.x, q.y - 4)));
    ctx.stroke();
    // Flange rings at the joints.
    ctx.fillStyle = "#5f6b72";
    for (const q of p.slice(1, -1)) {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now: number) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    time += dt;
    const st = cb.state();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    // Storage tank.
    const tg = ctx.createLinearGradient(80, 0, 250, 0);
    tg.addColorStop(0, "#5c6e78");
    tg.addColorStop(0.35, "#c9d6dc");
    tg.addColorStop(1, "#4b5a62");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.roundRect(80, 100, 175, 380, 80);
    ctx.fill();
    ctx.fillStyle = "#2b3439";
    ctx.font = "700 18px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("O₂", 167, 300);
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillText("STORAGE", 167, 320);

    for (const p of PIPES) drawPipe(p);

    // Electrolysis unit.
    ctx.fillStyle = "#39444a";
    ctx.beginPath();
    ctx.roundRect(420, 210, 230, 180, 14);
    ctx.fill();
    ctx.fillStyle = "#2a3236";
    ctx.fillRect(440, 230, 190, 90);
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = st.on && st.powered ? `rgba(120, 230, 210, ${0.35 + 0.35 * Math.sin(time * 3 + k)})` : "#3f4a50";
      ctx.fillRect(452 + k * 25, 240, 14, 70);
    }
    ctx.fillStyle = st.on && st.powered ? "#9ce5b2" : "#a8574a";
    ctx.beginPath();
    ctx.arc(612, 360, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9d6dc";
    ctx.font = "600 12px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("CO₂ → O₂ PROCESSOR", 440, 345);
    ctx.fillText(st.on ? (st.powered ? "RUNNING" : "NO POWER") : "OFF", 440, 365);

    // Habitat feed label.
    ctx.fillStyle = "rgba(220, 235, 240, 0.7)";
    ctx.textAlign = "right";
    ctx.fillText("TO HABITAT →", 960, 120);
    ctx.fillText("TO HABITAT →", 960, 400);

    // Pressure gauge with needle jitter while leaking.
    const openCount = leaks.filter((l) => !l.sealed).length;
    const gx = 860,
      gy = 520;
    ctx.fillStyle = "#1c2124";
    ctx.beginPath();
    ctx.arc(gx, gy, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e9e4d8";
    ctx.beginPath();
    ctx.arc(gx, gy, 50, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * (0.75 + 1.5 * (k / 10));
      ctx.strokeStyle = k < 2 ? "#c0392b" : "#333";
      ctx.lineWidth = k % 5 ? 1.5 : 3;
      ctx.beginPath();
      ctx.moveTo(gx + Math.cos(a) * 40, gy + Math.sin(a) * 40);
      ctx.lineTo(gx + Math.cos(a) * 48, gy + Math.sin(a) * 48);
      ctx.stroke();
    }
    const jitter = openCount ? Math.sin(time * 23) * 0.03 + Math.sin(time * 7.3) * 0.02 : 0;
    const na = Math.PI * (0.75 + 1.5 * Math.max(0, Math.min(1, st.fraction + jitter)));
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.cos(na) * 42, gy + Math.sin(na) * 42);
    ctx.stroke();
    ctx.fillStyle = "#333";
    ctx.font = "700 10px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RESERVE", gx, gy + 24);

    // Leaks: escaping vapour shimmer (barely visible), foam once found, tape when sealing.
    let hissI = 0,
      hissPan = 0,
      best = Infinity;
    for (const l of leaks) {
      if (l.sealed) {
        drawTape(l, 1);
        continue;
      }
      const d = Math.hypot(pointer.x - l.x, pointer.y - l.y);
      const loud = pointer.x > -900 ? Math.exp(-d / 220) : 0.25;
      hissI += loud;
      if (d < best) {
        best = d;
        hissPan = Math.max(-1, Math.min(1, (l.x - pointer.x) / 260));
      }
      // Faint heat-shimmer hint.
      ctx.strokeStyle = `rgba(220, 240, 255, ${0.05 + 0.04 * Math.sin(time * 9 + l.seed)})`;
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const w = 6 + k * 6 + ((time * 20 + l.seed) % 10);
        ctx.arc(l.x, l.y - 6, w, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      if (l.found > 0.25 && Math.random() < dt * 22 * l.found)
        bubbles.push({
          x: l.x + (Math.random() - 0.5) * 18,
          y: l.y + (Math.random() - 0.5) * 10,
          r: 2 + Math.random() * 5,
          life: 1.2 + Math.random(),
          vx: (Math.random() - 0.5) * 18,
          vy: -10 - Math.random() * 18,
        });
      if (l.wrap > 0) drawTape(l, l.wrap / (Math.PI * 4));
      if (l.found > 0.6) {
        ctx.strokeStyle = `rgba(255, 210, 120, ${0.5 + 0.3 * Math.sin(time * 5)})`;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(l.x, l.y, 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    cb.hiss(Math.min(1, hissI), hissPan);

    // Spray mist.
    if (pointer.down && pointer.taping < 0 && pointer.x > -900) {
      for (let k = 0; k < 4; k++)
        mist.push({
          x: pointer.x + 6,
          y: pointer.y + 26,
          vx: (Math.random() - 0.5) * 120,
          vy: 80 + Math.random() * 90,
          life: 0.45 + Math.random() * 0.3,
          r: 3 + Math.random() * 5,
        });
      for (const l of leaks)
        if (!l.sealed && Math.hypot(pointer.x - l.x, pointer.y + 40 - l.y) < 62)
          l.found = Math.min(1, l.found + dt * 1.4);
    }
    for (let k = mist.length - 1; k >= 0; k--) {
      const m = mist[k];
      m.life -= dt;
      if (m.life <= 0) {
        mist.splice(k, 1);
        continue;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.r += 18 * dt;
      ctx.fillStyle = `rgba(210, 235, 245, ${0.22 * m.life})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (mist.length > 300) mist.splice(0, mist.length - 300);
    for (let k = bubbles.length - 1; k >= 0; k--) {
      const b = bubbles[k];
      b.life -= dt;
      if (b.life <= 0) {
        bubbles.splice(k, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.r += 2 * dt;
      ctx.strokeStyle = `rgba(240, 250, 255, ${Math.min(0.9, b.life)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.5 * Math.min(1, b.life)})`;
      ctx.fillRect(b.x - b.r * 0.4, b.y - b.r * 0.5, 1.6, 1.6);
    }
    if (bubbles.length > 400) bubbles.splice(0, bubbles.length - 400);

    // Tool cursor: spray bottle, or tape roll when taping.
    pointer.work *= Math.exp(-6 * dt);
    cb.work(pointer.down ? Math.min(1, 0.35 + pointer.work) : 0);
    if (pointer.x > -900) {
      ctx.save();
      ctx.translate(pointer.x, pointer.y);
      if (pointer.taping >= 0) {
        ctx.fillStyle = "#c9c2b0";
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#6c655a";
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#3aa79f";
        ctx.beginPath();
        ctx.roundRect(-12, -40, 24, 38, 6);
        ctx.fill();
        ctx.fillStyle = "#e3d6bd";
        ctx.fillRect(-6, -2, 12, 14);
        ctx.fillStyle = "#e88a3c";
        ctx.fillRect(-4, 12, 8, 10);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(-8, -34, 4, 26);
      }
      ctx.restore();
    }

    const total = leaks.length;
    const sealed = leaks.filter((l) => l.sealed).length;
    ui.meter(total ? sealed / total : 1);
    ui.status(
      total === 0
        ? `No punctures detected · reserve ${Math.round(st.fraction * 100)}% · net ${st.netKgH >= 0 ? "+" : ""}${st.netKgH.toFixed(3)} kg/h`
        : `${total - sealed} open leak${total - sealed === 1 ? "" : "s"} · ${leaks.filter((l) => !l.sealed && l.found > 0.6).length} located · reserve ${Math.round(st.fraction * 100)}% · net ${st.netKgH >= 0 ? "+" : ""}${st.netKgH.toFixed(3)} kg/h`,
    );
    if (total && sealed === total && !allSealedShown) {
      allSealedShown = true;
      ui.root.classList.add("is-done");
      ui.showToast("Pressure holding");
    }
    if (Math.floor(time * 4) !== Math.floor((time - dt) * 4)) syncSwitch();
  }

  function drawTape(l: Leak, f: number) {
    const turns = Math.min(1, f);
    ctx.strokeStyle = "#c9c2b0";
    ctx.lineWidth = 6 + 10 * turns;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, turns * 2));
    ctx.stroke();
    if (turns > 0.5) {
      ctx.strokeStyle = "rgba(90, 80, 70, 0.35)";
      ctx.lineWidth = 1.5;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(l.x + k * 5 - 4, l.y - 18);
        ctx.lineTo(l.x + k * 5 + 4, l.y + 18);
        ctx.stroke();
      }
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = toView(e);
    pointer.down = true;
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.taping = leaks.findIndex(
      (l) => !l.sealed && l.found > 0.6 && Math.hypot(p.x - l.x, p.y - l.y) < 60,
    );
    if (pointer.taping >= 0) {
      const l = leaks[pointer.taping];
      pointer.lastAngle = Math.atan2(p.y - l.y, p.x - l.x);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = toView(e);
    const moved = Math.hypot(p.x - pointer.x, p.y - pointer.y);
    pointer.x = p.x;
    pointer.y = p.y;
    if (!pointer.down) return;
    pointer.work = Math.min(1, pointer.work + moved / 120);
    if (pointer.taping < 0) return;
    const l = leaks[pointer.taping];
    const d = Math.hypot(p.x - l.x, p.y - l.y);
    const a = Math.atan2(p.y - l.y, p.x - l.x);
    let da = a - pointer.lastAngle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    pointer.lastAngle = a;
    if (d > 8 && d < 110) l.wrap += Math.abs(da);
    if (l.wrap >= Math.PI * 4 && !l.sealed) {
      l.sealed = true;
      pointer.taping = -1;
      cb.sealed();
    }
  });
  const up = (e: PointerEvent) => {
    pointer.down = false;
    pointer.taping = -1;
    if (e.pointerType !== "mouse") pointer.x = pointer.y = -999;
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  ui.closeButton.onclick = () => close();
  window.addEventListener("resize", () => {
    if (open) resize();
  });

  function close() {
    if (!open) return;
    open = false;
    cancelAnimationFrame(raf);
    ui.root.hidden = true;
    pointer.down = false;
    pointer.taping = -1;
    cb.work(0);
    cb.hiss(0, 0);
    cb.close();
  }
  return {
    get open() {
      return open;
    },
    get leaks() {
      return leaks.map((l) => ({ found: l.found, sealed: l.sealed, wrap: l.wrap }));
    },
    show(punctures: number, seed = Date.now()) {
      let s = seed >>> 0 || 3;
      const r = () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) % 100000) / 100000;
      };
      leaks = [];
      for (let i = 0; i < punctures; i++) {
        // Spread leaks out along the network.
        const u = (i + 0.15 + r() * 0.7) / Math.max(1, punctures);
        const p = pointOnPipes(u);
        leaks.push({ ...p, found: 0, sealed: false, wrap: 0, seed: r() * 10 });
      }
      initial = punctures;
      void initial;
      mist = [];
      bubbles = [];
      allSealedShown = false;
      time = 0;
      ui.reset();
      ui.root.hidden = false;
      open = true;
      resize();
      syncSwitch();
      lastT = performance.now();
      raf = requestAnimationFrame(frame);
    },
    close,
    /** Test/automation hook: reveal and seal every leak. */
    autoSeal() {
      for (const l of leaks)
        if (!l.sealed) {
          l.found = 1;
          l.wrap = Math.PI * 4;
          l.sealed = true;
          cb.sealed();
        }
    },
  };
}
export type OxygenPlantGame = ReturnType<typeof oxygenPlantGame>;
