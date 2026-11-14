import { chromium } from "@playwright/test";
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 640, height: 400 } });
await p.goto("http://localhost:3000/");
await p.waitForFunction(() => window.nebula?.ready, null, { timeout: 60000 });
await p.evaluate(() => localStorage.clear());
await p.getByRole("button", { name: "Start challenge" }).click();
await p.locator("#world").focus();
await p.evaluate(() => { window.__diag = true; window.nebula.diag.groundFlips = 0; window.nebula.diag.steps = 0; window.nebula.diag.frames.length = 0; });
for (const keys of [["KeyW"],["KeyA"],["KeyS","KeyD"],["KeyW","KeyA"],["KeyD"]]) {
  for (const k of keys) await p.keyboard.down(k);
  await p.waitForTimeout(1500);
  for (const k of keys) await p.keyboard.up(k);
}
const d = await p.evaluate(() => window.nebula.diag);
console.log("flips", d.groundFlips, "steps", d.steps, "frames", d.frames.length);
const f = d.frames; let jerks = 0, ys = [];
for (let i = 2; i < f.length; i++) {
  const v1 = Math.hypot(f[i][1]-f[i-1][1], f[i][3]-f[i-1][3]) / f[i][0];
  const v0 = Math.hypot(f[i-1][1]-f[i-2][1], f[i-1][3]-f[i-2][3]) / f[i-1][0];
  if (v0 > 1 && Math.abs(v1 - v0) / v0 > 0.35) jerks++;
  ys.push(f[i][2]);
}
const dts = f.map(x => x[0]); dts.sort((a,b)=>a-b);
console.log("speed jerks", jerks, "y range", Math.min(...ys).toFixed(3), Math.max(...ys).toFixed(3), "dt median", dts[dts.length>>1].toFixed(4), "dt p95", dts[Math.floor(dts.length*0.95)].toFixed(4));
console.log("grounded false frames", f.filter(x => !x[7]).length);
await b.close();
