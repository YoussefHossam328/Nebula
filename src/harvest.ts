/**
 * Greenhouse harvest minigame. Swipe the shears across a ripe tomato truss to
 * snip it. Cut on the upper stalk (above the knuckle) for a clean cut; cutting
 * near the fruit bruises it, cutting unripe trusses wastes them, and nicking
 * the main stem sets the plant back. Trimming yellow leaves is optional and
 * gives the replanted bed a head start. Owns no simulation state.
 */
import { serviceShell } from "./service-view";

type Pt = { x: number; y: number };
type Truss = {
  a: Pt; // branch point on the main stem
  k: Pt; // knuckle (abscission point)
  c: Pt; // cluster centre
  ripe: boolean;
  fruits: { dx: number; dy: number; r: number }[];
  cut: "" | "clean" | "bruised" | "wasted";
  sway: number;
};
type Leaf = { at: Pt; tip: Pt; dead: boolean; trimmed: boolean };
type Plant = { x: number; top: Pt; stem: Pt[]; trusses: Truss[]; leaves: Leaf[]; nicked: boolean };
type Falling = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  ripe: boolean;
  bruised: boolean;
  fruits: Truss["fruits"];
  rest: boolean;
};
type Leaf2 = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number };

export type HarvestResult = {
  /** fraction of a full meal delivered, 0..1 */
  yield: number;
  /** regrowth head start for the replanted bed, 0..1 */
  headStart: number;
  ripeCut: number;
  ripeTotal: number;
};

function rng(seed: number) {
  let s = seed >>> 0 || 7;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
function segX(p1: Pt, p2: Pt, q1: Pt, q2: Pt) {
  const d = (p2.x - p1.x) * (q2.y - q1.y) - (p2.y - p1.y) * (q2.x - q1.x);
  if (Math.abs(d) < 1e-9) return -1;
  const t = ((q1.x - p1.x) * (q2.y - q1.y) - (q1.y - p1.y) * (q2.x - q1.x)) / d;
  const u = ((q1.x - p1.x) * (p2.y - p1.y) - (q1.y - p1.y) * (p2.x - p1.x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : -1;
}

const VW = 1000,
  VH = 600,
  FLOOR = 560;

export function harvestGame(cb: {
  complete(r: HarvestResult): void;
  close(r: HarvestResult): void;
  snip(kind: "clean" | "bruised" | "wasted" | "leaf" | "nick"): void;
}) {
  const ui = serviceShell({
    id: "harvest-game",
    label: "Greenhouse harvest",
    eyebrow: "GREENHOUSE · CROP BED",
    title: "Harvest the ripe trusses",
    stageClass: "service-stage-greenhouse",
    canvasLabel: "Tomato plants. Swipe across a ripe truss stalk to cut it.",
    meter: "Harvested",
    tip: "Hold and swipe across a <b>red</b> truss stalk, above the knuckle, for a clean cut. Leave green trusses, avoid the main stem. Trim yellow leaves for a faster regrow.",
  });
  const { canvas, ctx } = ui;
  let plants: Plant[] = [];
  let falling: Falling[] = [];
  let leafBits: Leaf2[] = [];
  let pops: { text: string; x: number; y: number; life: number; color: string }[] = [];
  const trail: { x: number; y: number; t: number }[] = [];
  let open = false,
    done = false,
    raf = 0,
    lastT = 0,
    time = 0,
    dpr = 1,
    scale = 1,
    ox = 0,
    oy = 0;
  const pointer = { x: -999, y: -999, down: false, snap: 0, angle: -0.5 };
  let nicks = 0,
    tidy = 0;

  function build(seed: number) {
    const r = rng(seed);
    plants = [];
    const n = 5;
    const greenSlots = new Set<number>();
    greenSlots.add(Math.floor(r() * n));
    if (r() < 0.6) greenSlots.add(Math.floor(r() * n));
    for (let i = 0; i < n; i++) {
      const x = 140 + i * 180 + (r() - 0.5) * 30;
      const lean = (r() - 0.5) * 60;
      const top = { x: x + lean, y: 70 + r() * 40 };
      const stem: Pt[] = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        stem.push({
          x: x + lean * t * t + Math.sin(t * 5 + i) * 6,
          y: 470 + (top.y - 470) * t,
        });
      }
      const at = (t: number) => {
        const f = t * 12,
          k = Math.min(11, Math.floor(f)),
          u = f - k;
        return {
          x: stem[k].x + (stem[k + 1].x - stem[k].x) * u,
          y: stem[k].y + (stem[k + 1].y - stem[k].y) * u,
        };
      };
      const trusses: Truss[] = [];
      const count = r() < 0.5 ? 2 : 1;
      for (let j = 0; j < count; j++) {
        const tt = count === 2 ? (j === 0 ? 0.32 : 0.62) : 0.4 + r() * 0.2;
        const a = at(tt);
        const side = (j + i) % 2 ? 1 : -1;
        const k = { x: a.x + side * (38 + r() * 14), y: a.y + 14 + r() * 8 };
        const c = { x: k.x + side * (16 + r() * 8), y: k.y + 46 + r() * 14 };
        const fruits = Array.from({ length: 3 + Math.floor(r() * 3) }, (_, q) => ({
          dx: (q % 3 - 1) * 15 + (r() - 0.5) * 6,
          dy: Math.floor(q / 3) * 22 + (r() - 0.5) * 6,
          r: 12 + r() * 5,
        }));
        trusses.push({
          a,
          k,
          c,
          ripe: !(greenSlots.has(i) && j === 0),
          fruits,
          cut: "",
          sway: r() * 6,
        });
      }
      const leaves: Leaf[] = [];
      for (let q = 0; q < 6; q++) {
        const t = 0.15 + q * 0.13;
        const base = at(t);
        const side = q % 2 ? 1 : -1;
        leaves.push({
          at: base,
          tip: { x: base.x + side * (55 + r() * 25), y: base.y - 12 - r() * 20 },
          dead: false,
          trimmed: false,
        });
      }
      plants.push({ x, top, stem, trusses, leaves, nicked: false });
    }
    // Two or three yellowing lower leaves.
    const deadCount = 2 + Math.floor(r() * 2);
    for (let d = 0; d < deadCount; d++) {
      const p = plants[Math.floor(r() * plants.length)];
      const l = p.leaves[Math.floor(r() * 2)];
      l.dead = true;
    }
    falling = [];
    leafBits = [];
    pops = [];
    nicks = 0;
    tidy = 0;
  }

  const allTrusses = () => plants.flatMap((p) => p.trusses);
  function result(): HarvestResult {
    const ts = allTrusses();
    const ripe = ts.filter((t) => t.ripe);
    const cut = ripe.filter((t) => t.cut);
    const wasted = ts.filter((t) => t.cut === "wasted").length;
    const quality = cut.length
      ? cut.reduce((s, t) => s + (t.cut === "clean" ? 1 : 0.55), 0) / ripe.length
      : 0;
    const totalDead = plants.reduce((s, p) => s + p.leaves.filter((l) => l.dead).length, 0);
    return {
      yield: Math.max(0, Math.min(1, quality - 0.12 * wasted - 0.08 * nicks)),
      headStart: Math.max(0, (totalDead ? (0.18 * tidy) / totalDead : 0) - 0.08 * nicks),
      ripeCut: cut.length,
      ripeTotal: ripe.length,
    };
  }

  function pop(text: string, x: number, y: number, color: string) {
    pops.push({ text, x, y, life: 1.1, color });
  }

  function swipe(p1: Pt, p2: Pt) {
    let cutSomething = false;
    for (const plant of plants) {
      for (const t of plant.trusses) {
        if (t.cut) continue;
        const sx = Math.sin(time * 1.3 + t.sway) * 2;
        const a = t.a,
          k = { x: t.k.x + sx, y: t.k.y },
          c = { x: t.c.x + sx * 1.6, y: t.c.y };
        const upper = segX(p1, p2, a, k);
        const lower = segX(p1, p2, k, { x: c.x, y: c.y - 14 });
        if (upper < 0 && lower < 0) continue;
        const kind: Truss["cut"] = !t.ripe ? "wasted" : upper >= 0 ? "clean" : "bruised";
        t.cut = kind;
        cutSomething = true;
        falling.push({
          x: c.x,
          y: c.y,
          vx: (p2.x - p1.x) * 0.6 + (Math.random() - 0.5) * 40,
          vy: -60 - Math.random() * 40,
          rot: 0,
          vr: (Math.random() - 0.5) * 4,
          ripe: t.ripe,
          bruised: kind === "bruised",
          fruits: t.fruits,
          rest: false,
        });
        pop(
          kind === "clean" ? "CLEAN CUT" : kind === "bruised" ? "BRUISED" : "UNRIPE · WASTED",
          k.x,
          k.y - 18,
          kind === "clean" ? "#c9ffe9" : kind === "bruised" ? "#ffd59a" : "#ff9c8a",
        );
        cb.snip(kind);
      }
      for (const l of plant.leaves) {
        if (!l.dead || l.trimmed) continue;
        const mid = { x: (l.at.x + l.tip.x) / 2, y: (l.at.y + l.tip.y) / 2 };
        if (segX(p1, p2, l.at, mid) < 0 && segX(p1, p2, mid, l.tip) < 0) continue;
        l.trimmed = true;
        tidy++;
        cutSomething = true;
        leafBits.push({ x: mid.x, y: mid.y, vx: (p2.x - p1.x) * 0.4, vy: -40, rot: 0, vr: (Math.random() - 0.5) * 5, life: 2.2 });
        pop("TRIMMED", mid.x, mid.y - 16, "#f3e7a0");
        cb.snip("leaf");
      }
      // Main stem: only penalise a deliberate fast slash, once per plant.
      if (!plant.nicked && Math.hypot(p2.x - p1.x, p2.y - p1.y) > 14) {
        for (let q = 1; q < plant.stem.length - 2; q++)
          if (segX(p1, p2, plant.stem[q], plant.stem[q + 1]) >= 0) {
            plant.nicked = true;
            nicks++;
            pop("STEM NICKED", plant.stem[q].x, plant.stem[q].y, "#ff9c8a");
            cb.snip("nick");
            break;
          }
      }
    }
    if (cutSomething) pointer.snap = 1;
  }

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

  function drawTomato(x: number, y: number, r: number, ripe: boolean, bruised: boolean) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    if (ripe) {
      g.addColorStop(0, bruised ? "#e98a62" : "#ff8a6a");
      g.addColorStop(0.5, bruised ? "#a8432c" : "#d83a28");
      g.addColorStop(1, bruised ? "#6b2a1c" : "#8e1f16");
    } else {
      g.addColorStop(0, "#c9e88e");
      g.addColorStop(0.55, "#7fae4a");
      g.addColorStop(1, "#4a6f2a");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (bruised) {
      ctx.fillStyle = "rgba(60, 20, 10, 0.45)";
      ctx.beginPath();
      ctx.ellipse(x + r * 0.3, y + r * 0.2, r * 0.35, r * 0.22, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3f6d2c";
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.25, y - r * 0.82 + Math.sin(a) * r * 0.12, r * 0.28, r * 0.09, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function drawCluster(cx: number, cy: number, fruits: Truss["fruits"], ripe: boolean, bruised: boolean) {
    ctx.strokeStyle = "#5d8a3c";
    ctx.lineWidth = 3;
    for (const f of fruits) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14);
      ctx.lineTo(cx + f.dx, cy + f.dy - f.r * 0.8);
      ctx.stroke();
    }
    for (const f of [...fruits].sort((a, b) => a.dy - b.dy))
      drawTomato(cx + f.dx, cy + f.dy, f.r, ripe, bruised);
  }
  function drawLeaf(l: Leaf, sway: number) {
    if (l.trimmed) return;
    const tip = { x: l.tip.x + sway, y: l.tip.y };
    const mx = (l.at.x + tip.x) / 2,
      my = (l.at.y + tip.y) / 2;
    const nx = -(tip.y - l.at.y) * 0.28,
      ny = (tip.x - l.at.x) * 0.28;
    const g = ctx.createLinearGradient(l.at.x, l.at.y, tip.x, tip.y);
    if (l.dead) {
      g.addColorStop(0, "#b49b3a");
      g.addColorStop(1, "#e3cf6a");
    } else {
      g.addColorStop(0, "#3d7a3a");
      g.addColorStop(1, "#78b55a");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(l.at.x, l.at.y);
    ctx.quadraticCurveTo(mx + nx, my + ny, tip.x, tip.y);
    ctx.quadraticCurveTo(mx - nx, my - ny, l.at.x, l.at.y);
    ctx.fill();
    ctx.strokeStyle = l.dead ? "rgba(120,90,30,0.7)" : "rgba(30,70,30,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(l.at.x, l.at.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
  }

  function frame(now: number) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    time += dt;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    // Grow-light bar and its glow.
    const lg = ctx.createLinearGradient(0, 0, 0, 200);
    lg.addColorStop(0, "rgba(255, 140, 220, 0.30)");
    lg.addColorStop(1, "rgba(255, 140, 220, 0)");
    ctx.fillStyle = lg;
    ctx.fillRect(40, 18, VW - 80, 200);
    ctx.fillStyle = "#2e2a34";
    ctx.fillRect(40, 14, VW - 80, 16);
    for (let x = 60; x < VW - 60; x += 22) {
      ctx.fillStyle = (x / 22) % 3 < 1 ? "#7fb8ff" : "#ff6fb4";
      ctx.fillRect(x, 26, 10, 4);
    }
    // Support strings.
    ctx.strokeStyle = "rgba(230, 220, 200, 0.35)";
    ctx.lineWidth = 1.2;
    for (const p of plants) {
      ctx.beginPath();
      ctx.moveTo(p.top.x, 30);
      ctx.lineTo(p.top.x, p.top.y);
      ctx.stroke();
    }

    // Crate behind the tray floor.
    ctx.fillStyle = "#5a3b26";
    ctx.fillRect(60, 520, VW - 120, 70);
    ctx.fillStyle = "#6e4a30";
    for (let y = 528; y < 590; y += 20) ctx.fillRect(60, y, VW - 120, 9);

    // Plants.
    for (const p of plants) {
      const sway = Math.sin(time * 1.1 + p.x) * 2.5;
      ctx.strokeStyle = p.nicked ? "#6f6a3a" : "#4f7f36";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      p.stem.forEach((s, k) => {
        const sx = s.x + sway * (k / 12);
        if (k) ctx.lineTo(sx, s.y);
        else ctx.moveTo(sx, s.y);
      });
      ctx.stroke();
      if (p.nicked) {
        const m = p.stem[6];
        ctx.strokeStyle = "#c9b27a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(m.x - 6, m.y - 4);
        ctx.lineTo(m.x + 6, m.y + 4);
        ctx.stroke();
      }
      for (const l of p.leaves) drawLeaf(l, sway);
      for (const t of p.trusses) {
        if (t.cut) {
          // Stub of the cut stalk.
          ctx.strokeStyle = "#5d8a3c";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(t.a.x, t.a.y);
          ctx.lineTo(t.a.x + (t.k.x - t.a.x) * 0.5, t.a.y + (t.k.y - t.a.y) * 0.5);
          ctx.stroke();
          continue;
        }
        const sx = Math.sin(time * 1.3 + t.sway) * 2;
        ctx.strokeStyle = "#5d8a3c";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(t.a.x, t.a.y);
        ctx.lineTo(t.k.x + sx, t.k.y);
        ctx.lineTo(t.c.x + sx * 1.6, t.c.y - 14);
        ctx.stroke();
        // Knuckle marker: the ideal cut is just above it.
        ctx.fillStyle = "#86b255";
        ctx.beginPath();
        ctx.arc(t.k.x + sx, t.k.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        if (t.ripe) {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = `rgba(200, 255, 230, ${0.35 + 0.25 * Math.sin(time * 4 + t.sway)})`;
          ctx.lineWidth = 1.5;
          const mx = (t.a.x + t.k.x + sx) / 2,
            my = (t.a.y + t.k.y) / 2;
          ctx.beginPath();
          ctx.arc(mx, my, 13, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        drawCluster(t.c.x + sx * 1.6, t.c.y, t.fruits, t.ripe, false);
      }
    }

    // Tray in front of the stems.
    const tg = ctx.createLinearGradient(0, 462, 0, 520);
    tg.addColorStop(0, "#c9c4b8");
    tg.addColorStop(1, "#8b867b");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.roundRect(70, 462, VW - 140, 58, 8);
    ctx.fill();
    ctx.fillStyle = "#3b3128";
    ctx.fillRect(84, 468, VW - 168, 10);

    // Falling and resting produce.
    for (const f of falling) {
      if (!f.rest) {
        f.vy += 900 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += f.vr * dt;
        f.vx *= Math.exp(-1.5 * dt);
        if (f.y > FLOOR) {
          f.y = FLOOR;
          if (Math.abs(f.vy) < 120) {
            f.rest = true;
            f.vy = 0;
          } else f.vy *= -0.3;
          f.vr *= 0.5;
        }
        f.x = Math.max(110, Math.min(VW - 110, f.x));
      }
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      drawCluster(0, -10, f.fruits, f.ripe, f.bruised);
      ctx.restore();
    }
    // Crate front lip.
    ctx.fillStyle = "#7a5236";
    ctx.fillRect(60, 572, VW - 120, 22);
    ctx.fillStyle = "rgba(255,220,180,0.15)";
    ctx.fillRect(60, 572, VW - 120, 3);

    for (let k = leafBits.length - 1; k >= 0; k--) {
      const b = leafBits[k];
      b.life -= dt;
      if (b.life <= 0) {
        leafBits.splice(k, 1);
        continue;
      }
      b.vy += 300 * dt;
      b.vx *= Math.exp(-2 * dt);
      b.x += b.vx * dt + Math.sin(time * 6 + k) * 20 * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.life);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = "#d8c25e";
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Blade trail.
    const now2 = performance.now();
    while (trail.length && now2 - trail[0].t > 160) trail.shift();
    if (trail.length > 1) {
      ctx.lineCap = "round";
      for (let k = 1; k < trail.length; k++) {
        const a = 1 - (now2 - trail[k].t) / 160;
        ctx.strokeStyle = `rgba(230, 250, 255, ${0.55 * a})`;
        ctx.lineWidth = 2 + 5 * a;
        ctx.beginPath();
        ctx.moveTo(trail[k - 1].x, trail[k - 1].y);
        ctx.lineTo(trail[k].x, trail[k].y);
        ctx.stroke();
      }
    }

    // Floating feedback text.
    ctx.textAlign = "center";
    ctx.font = "700 15px Inter, system-ui, sans-serif";
    for (let k = pops.length - 1; k >= 0; k--) {
      const p = pops[k];
      p.life -= dt;
      p.y -= 34 * dt;
      if (p.life <= 0) {
        pops.splice(k, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, p.life * 1.6);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillText(p.text, p.x + 1, p.y + 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    // Shears cursor.
    pointer.snap = Math.max(0, pointer.snap - dt * 5);
    if (pointer.x > -900) {
      const openA = 0.42 * (1 - pointer.snap) * (pointer.down ? 0.75 : 1);
      ctx.save();
      ctx.translate(pointer.x, pointer.y);
      ctx.rotate(pointer.angle);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.rotate(side * openA);
        ctx.fillStyle = "#dfe6ea";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(46, side * -3);
        ctx.lineTo(4, side * 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = side < 0 ? "#e88a3c" : "#3aa79f";
        ctx.beginPath();
        ctx.ellipse(-22, side * 8, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const r = result();
    ui.meter(r.ripeTotal ? r.ripeCut / r.ripeTotal : 1);
    const ts = allTrusses();
    ui.status(
      `Clean ${ts.filter((t) => t.cut === "clean").length} · bruised ${ts.filter((t) => t.cut === "bruised").length} · wasted ${ts.filter((t) => t.cut === "wasted").length} · stem nicks ${nicks} · leaves trimmed ${tidy} → meal ${Math.round(r.yield * 100)}%`,
    );
    if (!done && r.ripeTotal && r.ripeCut >= r.ripeTotal) {
      done = true;
      ui.root.classList.add("is-done");
      ui.showToast(r.yield > 0.9 ? "Perfect harvest" : "Harvest in");
      cb.complete(r);
      setTimeout(() => {
        if (open && done) close();
      }, 1700);
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = toView(e);
    pointer.down = true;
    pointer.x = p.x;
    pointer.y = p.y;
    trail.length = 0;
    trail.push({ ...p, t: performance.now() });
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = toView(e);
    const prev = { x: pointer.x, y: pointer.y };
    if (pointer.x > -900 && Math.hypot(p.x - prev.x, p.y - prev.y) > 1)
      pointer.angle += (Math.atan2(p.y - prev.y, p.x - prev.x) - pointer.angle) * 0.25;
    pointer.x = p.x;
    pointer.y = p.y;
    if (!pointer.down || done) return;
    trail.push({ ...p, t: performance.now() });
    if (prev.x > -900) swipe(prev, p);
  });
  const up = (e: PointerEvent) => {
    pointer.down = false;
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
    cb.close(result());
  }
  return {
    get open() {
      return open;
    },
    get progress() {
      return result();
    },
    show(seed = Date.now()) {
      build(seed);
      done = false;
      time = 0;
      ui.reset();
      ui.root.hidden = false;
      open = true;
      resize();
      lastT = performance.now();
      raf = requestAnimationFrame(frame);
    },
    close,
    /** Test/automation hook: cleanly cut every ripe truss. */
    autoHarvest() {
      for (const t of allTrusses())
        if (t.ripe && !t.cut) {
          const m = { x: (t.a.x + t.k.x) / 2, y: (t.a.y + t.k.y) / 2 };
          const dx = t.k.y - t.a.y,
            dy = -(t.k.x - t.a.x);
          const l = Math.hypot(dx, dy) || 1;
          swipe(
            { x: m.x - (dx / l) * 10, y: m.y - (dy / l) * 10 },
            { x: m.x + (dx / l) * 10, y: m.y + (dy / l) * 10 },
          );
        }
    },
  };
}
export type HarvestGame = ReturnType<typeof harvestGame>;
