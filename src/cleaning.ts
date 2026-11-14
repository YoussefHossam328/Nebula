/**
 * Solar array service minigame. The player drags a brush across the panel;
 * dust is removed in proportion to brush *motion* (scrubbing), so caked spots
 * need several back-and-forth passes. Removed dust mass drives the simulated
 * transmission recovery through the callbacks; this module owns no physics.
 */
const GW = 120,
  GH = 80;

type Callbacks = {
  /** 0..1 fraction of initial dust removed so far */
  progress(fraction: number): void;
  /** called once when the panel is fully clean */
  complete(): void;
  /** user closed the service view (complete or not) */
  close(): void;
  /** brush scrub intensity 0..1, for audio */
  scrub(intensity: number): void;
};

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function cleaningGame(cb: Callbacks) {
  const root = document.createElement("section");
  root.id = "clean-game";
  root.hidden = true;
  root.setAttribute("aria-label", "Solar array service");
  root.innerHTML = `
    <div class="clean-card">
      <div class="clean-head">
        <div>
          <span class="clean-eyebrow">SOLAR ARRAY · SERVICE HATCH</span>
          <h2>Scrub the panel</h2>
        </div>
        <button id="clean-close" type="button" aria-label="Close service view">Done <kbd>Esc</kbd></button>
      </div>
      <div class="clean-stage">
        <canvas id="clean-canvas" aria-label="Dusty solar panel. Drag to scrub."></canvas>
        <div class="clean-toast" id="clean-toast" hidden>Panel clean</div>
      </div>
      <div class="clean-foot">
        <div class="clean-meter">
          <span>Cleanliness</span>
          <div class="clean-bar"><i id="clean-fill"></i></div>
          <b id="clean-pct">0%</b>
        </div>
        <p id="clean-tip">Hold the mouse button (or touch) and scrub back and forth. Caked spots need several passes.</p>
        <p id="clean-trans" class="clean-trans"></p>
      </div>
    </div>`;
  document.body.append(root);
  const canvas = root.querySelector<HTMLCanvasElement>("#clean-canvas")!;
  const ctx = canvas.getContext("2d")!;
  const fill = root.querySelector<HTMLElement>("#clean-fill")!;
  const pct = root.querySelector<HTMLElement>("#clean-pct")!;
  const toast = root.querySelector<HTMLElement>("#clean-toast")!;
  const trans = root.querySelector<HTMLElement>("#clean-trans")!;

  const dirt = new Float32Array(GW * GH);
  const tint = new Float32Array(GW * GH); // 0 = fine dust, 1 = caked
  let initialMass = 1,
    removed = 0,
    done = false,
    open = false,
    raf = 0,
    lastT = 0;
  const dirtCanvas = document.createElement("canvas");
  dirtCanvas.width = GW;
  dirtCanvas.height = GH;
  const dctx = dirtCanvas.getContext("2d")!;
  const img = dctx.createImageData(GW, GH);
  let grain: HTMLCanvasElement | undefined;
  let panelCache: HTMLCanvasElement | undefined;
  let layout = { x: 0, y: 0, w: 1, h: 1, dpr: 1 };
  let transmissionFrom = 0,
    transmissionTo = 1;

  // Brush state
  const brush = { x: -999, y: -999, px: -999, py: -999, down: false, angle: 0, wobble: 0, energy: 0 };
  type Fleck = { x: number; y: number; vx: number; vy: number; life: number; size: number; caked: boolean };
  const flecks: Fleck[] = [];
  let glint = -1;

  function generate(dirtiness: number, seed: number) {
    const r = rng(seed);
    // Value-noise base layer for a natural fine-dust film.
    const coarse = 12;
    const cw = Math.ceil(GW / coarse) + 2,
      ch = Math.ceil(GH / coarse) + 2;
    const n = Array.from({ length: cw * ch }, () => r());
    const sample = (x: number, y: number) => {
      const gx = x / coarse,
        gy = y / coarse;
      const ix = Math.floor(gx),
        iy = Math.floor(gy);
      const fx = gx - ix,
        fy = gy - iy;
      const sx = fx * fx * (3 - 2 * fx),
        sy = fy * fy * (3 - 2 * fy);
      const a = n[iy * cw + ix],
        b = n[iy * cw + ix + 1],
        c = n[(iy + 1) * cw + ix],
        d = n[(iy + 1) * cw + ix + 1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    const film = 0.25 + 0.55 * dirtiness;
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        // Dust collects more towards the lower edge of a tilted panel.
        const settle = 0.75 + 0.5 * (y / GH);
        dirt[i] = film * settle * (0.55 + 0.9 * sample(x, y));
        tint[i] = 0;
      }
    // Wind streaks.
    const streaks = 3 + Math.round(4 * dirtiness);
    for (let s = 0; s < streaks; s++) {
      const y0 = r() * GH,
        slope = (r() - 0.5) * 0.3,
        width = 2 + r() * 4,
        amt = 0.25 + r() * 0.35;
      for (let x = 0; x < GW; x++) {
        const yc = y0 + slope * x;
        for (let y = Math.max(0, Math.floor(yc - width * 2)); y < Math.min(GH, yc + width * 2); y++) {
          const d = (y - yc) / width;
          dirt[y * GW + x] += amt * Math.exp(-d * d) * (0.6 + 0.4 * Math.sin(x * 0.21 + s));
        }
      }
    }
    // Caked spots: dense, darker, need repeated passes.
    const spots = 5 + Math.round(9 * dirtiness);
    for (let s = 0; s < spots; s++) {
      const cx = 6 + r() * (GW - 12),
        cy = 6 + r() * (GH - 12),
        rad = 3 + r() * 7,
        depth = 1.4 + r() * 1.8;
      const lobes = 3 + Math.floor(r() * 3);
      const off = Array.from({ length: lobes }, () => [(r() - 0.5) * rad, (r() - 0.5) * rad, 0.5 + r() * 0.6]);
      for (let y = Math.max(0, Math.floor(cy - rad * 2)); y < Math.min(GH, cy + rad * 2); y++)
        for (let x = Math.max(0, Math.floor(cx - rad * 2)); x < Math.min(GW, cx + rad * 2); x++) {
          let v = 0;
          for (const [ox, oy, k] of off) {
            const dx = (x - cx - ox) / (rad * k),
              dy = (y - cy - oy) / (rad * k);
            v = Math.max(v, 1 - (dx * dx + dy * dy));
          }
          if (v <= 0) continue;
          const i = y * GW + x;
          const add = depth * Math.pow(v, 0.6);
          dirt[i] += add;
          tint[i] = Math.max(tint[i], Math.min(1, v * 1.4));
        }
    }
    initialMass = 0;
    for (let i = 0; i < dirt.length; i++) initialMass += dirt[i];
    removed = 0;
  }

  function makeGrain(w: number, h: number) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    const id = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 150 + Math.random() * 105;
      id.data[i * 4] = v;
      id.data[i * 4 + 1] = v * 0.86;
      id.data[i * 4 + 2] = v * 0.72;
      id.data[i * 4 + 3] = Math.random() < 0.25 ? 120 : 40;
    }
    g.putImageData(id, 0, 0);
    return c;
  }

  function drawPanel(w: number, h: number) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    const frame = Math.max(8, w * 0.018);
    // Aluminium frame
    const fg = g.createLinearGradient(0, 0, 0, h);
    fg.addColorStop(0, "#d9d4c8");
    fg.addColorStop(0.5, "#a7a194");
    fg.addColorStop(1, "#7d776c");
    g.fillStyle = fg;
    g.beginPath();
    g.roundRect(0, 0, w, h, frame * 0.8);
    g.fill();
    // Glass / cells
    const ix = frame,
      iy = frame,
      iw = w - frame * 2,
      ih = h - frame * 2;
    g.fillStyle = "#0c1a33";
    g.fillRect(ix, iy, iw, ih);
    const cols = 6,
      rows = 4,
      gap = Math.max(2, w * 0.004);
    const cw = (iw - gap * (cols + 1)) / cols,
      chh = (ih - gap * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++)
      for (let q = 0; q < cols; q++) {
        const x = ix + gap + q * (cw + gap),
          y = iy + gap + r * (chh + gap);
        const cg = g.createLinearGradient(x, y, x + cw, y + chh);
        cg.addColorStop(0, "#23477d");
        cg.addColorStop(0.55, "#183463");
        cg.addColorStop(1, "#122a52");
        g.fillStyle = cg;
        g.fillRect(x, y, cw, chh);
        // Cell fingers
        g.strokeStyle = "rgba(160, 190, 230, 0.16)";
        g.lineWidth = 1;
        for (let k = 1; k < 10; k++) {
          const yy = y + (chh * k) / 10;
          g.beginPath();
          g.moveTo(x + 2, yy);
          g.lineTo(x + cw - 2, yy);
          g.stroke();
        }
        // Bus bars
        g.strokeStyle = "rgba(205, 215, 230, 0.45)";
        g.lineWidth = Math.max(1, w * 0.002);
        for (const k of [0.33, 0.66]) {
          g.beginPath();
          g.moveTo(x + cw * k, y + 2);
          g.lineTo(x + cw * k, y + chh - 2);
          g.stroke();
        }
      }
    // Sky reflection on the glass
    const rg = g.createLinearGradient(ix, iy, ix + iw, iy + ih);
    rg.addColorStop(0, "rgba(255, 220, 190, 0.20)");
    rg.addColorStop(0.35, "rgba(255, 220, 190, 0.04)");
    rg.addColorStop(0.6, "rgba(160, 200, 255, 0.08)");
    rg.addColorStop(1, "rgba(255, 255, 255, 0.0)");
    g.fillStyle = rg;
    g.fillRect(ix, iy, iw, ih);
    // Frame screws
    g.fillStyle = "#5d574e";
    for (const [sx, sy] of [
      [frame / 2, frame / 2],
      [w - frame / 2, frame / 2],
      [frame / 2, h - frame / 2],
      [w - frame / 2, h - frame / 2],
    ]) {
      g.beginPath();
      g.arc(sx, sy, frame * 0.22, 0, Math.PI * 2);
      g.fill();
    }
    return { canvas: c, inner: { x: ix, y: iy, w: iw, h: ih } };
  }
  let inner = { x: 0, y: 0, w: 1, h: 1 };

  function resize() {
    const stage = canvas.parentElement!;
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    // Panel keeps a 3:2 aspect and fits with a margin.
    const margin = 0.06;
    let w = canvas.width * (1 - margin * 2),
      h = (w * 2) / 3;
    if (h > canvas.height * (1 - margin * 2)) {
      h = canvas.height * (1 - margin * 2);
      w = (h * 3) / 2;
    }
    layout = {
      x: (canvas.width - w) / 2,
      y: (canvas.height - h) / 2,
      w,
      h,
      dpr,
    };
    const p = drawPanel(Math.round(w), Math.round(h));
    panelCache = p.canvas;
    inner = p.inner;
    grain = makeGrain(Math.round(inner.w), Math.round(inner.h));
  }

  function toGrid(px: number, py: number) {
    return {
      gx: ((px - layout.x - inner.x) / inner.w) * GW,
      gy: ((py - layout.y - inner.y) / inner.h) * GH,
    };
  }

  function scrubSegment(ax: number, ay: number, bx: number, by: number) {
    const a = toGrid(ax, ay),
      b = toGrid(bx, by);
    const dist = Math.hypot(b.gx - a.gx, b.gy - a.gy);
    if (dist < 0.01) return 0;
    const radius = 7.5;
    const steps = Math.max(1, Math.ceil(dist / 1.5));
    // Removal per grid cell travelled; caked dust resists more.
    const power = 0.055;
    let total = 0;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const cx = a.gx + (b.gx - a.gx) * t,
        cy = a.gy + (b.gy - a.gy) * t;
      const stepLen = dist / steps;
      for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(GH - 1, cy + radius); y++)
        for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(GW - 1, cx + radius); x++) {
          const dx = x - cx,
            dy = y - cy;
          const f = 1 - (dx * dx + dy * dy) / (radius * radius);
          if (f <= 0) continue;
          const i = y * GW + x;
          if (dirt[i] <= 0) continue;
          const resist = 1 + tint[i] * 2.2;
          const take = Math.min(dirt[i], (power * stepLen * f * f) / resist + (dirt[i] < 0.04 ? dirt[i] : 0));
          dirt[i] -= take;
          total += take;
        }
    }
    removed += total;
    return total;
  }

  function spawnFlecks(x: number, y: number, amount: number, vx: number, vy: number) {
    const n = Math.min(10, Math.round(amount * 2.2));
    for (let k = 0; k < n; k++) {
      flecks.push({
        x: x + (Math.random() - 0.5) * 40 * layout.dpr,
        y: y + (Math.random() - 0.5) * 30 * layout.dpr,
        vx: vx * 0.3 + (Math.random() - 0.5) * 220 * layout.dpr,
        vy: vy * 0.3 + (Math.random() - 0.7) * 200 * layout.dpr,
        life: 0.5 + Math.random() * 0.6,
        size: (1.5 + Math.random() * 3.5) * layout.dpr,
        caked: Math.random() < 0.3,
      });
    }
    if (flecks.length > 260) flecks.splice(0, flecks.length - 260);
  }

  function fraction() {
    return initialMass > 0 ? Math.min(1, removed / initialMass) : 1;
  }

  function renderDirt() {
    const d = img.data;
    for (let i = 0; i < GW * GH; i++) {
      const v = dirt[i];
      const a = 1 - Math.exp(-2.3 * v);
      const t = tint[i] * Math.min(1, v / 0.9);
      // fine dust: warm ochre; caked: darker rust
      d[i * 4] = 205 - 70 * t;
      d[i * 4 + 1] = 146 - 62 * t;
      d[i * 4 + 2] = 98 - 52 * t;
      d[i * 4 + 3] = Math.min(255, a * 255);
    }
    dctx.putImageData(img, 0, 0);
  }

  function frame(now: number) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // Ground shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 40 * layout.dpr;
    ctx.shadowOffsetY = 18 * layout.dpr;
    if (panelCache) ctx.drawImage(panelCache, layout.x, layout.y);
    ctx.restore();
    // Dirt layer, softened by bilinear upscaling, with grain texture on top.
    renderDirt();
    const ix = layout.x + inner.x,
      iy = layout.y + inner.y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, inner.w, inner.h);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(dirtCanvas, ix, iy, inner.w, inner.h);
    if (grain) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = 0.5;
      ctx.drawImage(grain, ix, iy);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    // Completion glint sweeping across the glass.
    if (glint >= 0) {
      glint += dt * 1.1;
      const gx = ix + (glint * 1.6 - 0.3) * inner.w;
      const gg = ctx.createLinearGradient(gx - inner.w * 0.15, iy, gx + inner.w * 0.15, iy + inner.h);
      gg.addColorStop(0, "rgba(255,255,255,0)");
      gg.addColorStop(0.5, "rgba(255,255,255,0.32)");
      gg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(ix, iy, inner.w, inner.h);
      if (glint > 1) glint = -1;
    }
    ctx.restore();

    // Flecks of dust thrown by the brush.
    for (let k = flecks.length - 1; k >= 0; k--) {
      const f = flecks[k];
      f.life -= dt;
      if (f.life <= 0) {
        flecks.splice(k, 1);
        continue;
      }
      f.vy += 520 * layout.dpr * dt;
      f.vx *= Math.exp(-3 * dt);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.caked ? "#7e4a2c" : "#d39a6a";
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Brush: a sponge pad that tilts with motion and squashes when pressed.
    brush.energy *= Math.exp(-6 * dt);
    cb.scrub(brush.down ? Math.min(1, brush.energy) : 0);
    if (brush.x > -900) {
      ctx.save();
      ctx.translate(brush.x, brush.y);
      ctx.rotate(brush.angle * 0.35 + Math.sin(brush.wobble) * 0.05);
      const s = layout.dpr * (brush.down ? 0.94 : 1);
      const bw = 92 * s,
        bh = 54 * s;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.roundRect(-bw / 2 + 6 * s, -bh / 2 + 10 * s, bw, bh, 12 * s);
      ctx.fill();
      ctx.fillStyle = "#e3d6bd";
      ctx.beginPath();
      ctx.roundRect(-bw / 2, -bh / 2, bw, bh * 0.55, [12 * s, 12 * s, 3 * s, 3 * s]);
      ctx.fill();
      ctx.fillStyle = brush.down ? "#2f8f88" : "#3aa79f";
      ctx.beginPath();
      ctx.roundRect(-bw / 2, -bh / 2 + bh * 0.5, bw, bh * 0.5, [3 * s, 3 * s, 12 * s, 12 * s]);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      for (let k = -3; k <= 3; k++) ctx.fillRect(k * 12 * s - 2 * s, bh * 0.08, 4 * s, bh * 0.36);
      ctx.fillStyle = "#e88a3c";
      ctx.fillRect(-bw / 2 + 10 * s, -bh / 2 + 9 * s, 26 * s, 6 * s);
      ctx.restore();
    }

    const f = fraction();
    const shown = done ? 1 : Math.min(0.999, f / 0.97);
    fill.style.width = (shown * 100).toFixed(1) + "%";
    pct.textContent = Math.floor(shown * 100) + "%";
    const t = transmissionFrom + (transmissionTo - transmissionFrom) * shown;
    trans.textContent = `Sunlight reaching cells ≈ ${Math.round(t * 100)}% (was ${Math.round(transmissionFrom * 100)}%)`;
    if (!done) cb.progress(Math.min(1, f / 0.97));
    if (!done && f >= 0.97) {
      done = true;
      for (let i = 0; i < dirt.length; i++) dirt[i] = 0;
      glint = 0;
      toast.hidden = false;
      root.classList.add("is-done");
      cb.complete();
      setTimeout(() => {
        if (open && done) close();
      }, 1600);
    }
  }

  const pos = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * layout.dpr, y: (e.clientY - r.top) * layout.dpr };
  };
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    brush.down = true;
    brush.x = brush.px = p.x;
    brush.y = brush.py = p.y;
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = pos(e);
    const vx = p.x - brush.x,
      vy = p.y - brush.y;
    brush.px = brush.x;
    brush.py = brush.y;
    brush.x = p.x;
    brush.y = p.y;
    if (Math.hypot(vx, vy) > 0.5) brush.angle += (Math.atan2(vy, vx) * 0.0 + Math.max(-1, Math.min(1, vx / (30 * layout.dpr))) - brush.angle) * 0.3;
    if (!brush.down || done) return;
    brush.wobble += Math.hypot(vx, vy) * 0.05;
    const got = scrubSegment(brush.px, brush.py, brush.x, brush.y);
    brush.energy = Math.min(1.4, brush.energy + Math.hypot(vx, vy) / (90 * layout.dpr));
    if (got > 0.02) spawnFlecks(brush.x, brush.y, got, vx * 10, vy * 10);
  });
  const up = (e: PointerEvent) => {
    brush.down = false;
    if (e.pointerType !== "mouse") brush.x = brush.y = -999;
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse" && !brush.down) brush.x = brush.y = -999;
  });
  root.querySelector<HTMLButtonElement>("#clean-close")!.onclick = () => close();
  window.addEventListener("resize", () => {
    if (open) resize();
  });

  function close() {
    if (!open) return;
    open = false;
    cancelAnimationFrame(raf);
    root.hidden = true;
    brush.down = false;
    cb.scrub(0);
    cb.close();
  }

  return {
    get open() {
      return open;
    },
    get fraction() {
      return fraction();
    },
    /**
     * @param dirtiness 0 (barely dusty) .. 1 (at the dust floor)
     * @param from current transmission, to: transmission after a full clean
     */
    show(dirtiness: number, from: number, to: number, seed = Date.now()) {
      transmissionFrom = from;
      transmissionTo = to;
      done = false;
      glint = -1;
      flecks.length = 0;
      toast.hidden = true;
      root.classList.remove("is-done");
      generate(Math.max(0, Math.min(1, dirtiness)), seed);
      root.hidden = false;
      open = true;
      resize();
      lastT = performance.now();
      raf = requestAnimationFrame(frame);
    },
    close,
    /** Test/automation hook: scrub a full serpentine pass. */
    autoScrub(passes = 1) {
      const r = canvas.getBoundingClientRect();
      for (let p = 0; p < passes; p++)
        for (let row = 0; row <= 10; row++) {
          const y = layout.y + inner.y + (inner.h * row) / 10;
          for (let k = 0; k < 12; k++) {
            const ax = layout.x + inner.x + (k % 2 ? inner.w : 0),
              bx = layout.x + inner.x + (k % 2 ? 0 : inner.w);
            scrubSegment(ax, y, bx, y);
          }
        }
      void r;
    },
  };
}
export type CleaningGame = ReturnType<typeof cleaningGame>;
