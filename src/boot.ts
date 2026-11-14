// Tiny entry: shows real loading progress while the game code, physics WASM
// and models stream in, then reveals the game. Offers Retry on failure.
const boot = document.getElementById("boot")!;
const bar = document.getElementById("boot-fill")!;
const label = document.getElementById("boot-status")!;
const retry = document.getElementById("boot-retry") as HTMLButtonElement;
const parts: Record<string, number> = { code: 0, physics: 0, scene: 0 };
const weights: Record<string, number> = { code: 0.15, physics: 0.5, scene: 0.35 };
const names: Record<string, string> = {
  code: "Loading game code",
  physics: "Downloading physics engine",
  scene: "Building the base",
};
let stage = "code";
function render() {
  const total = Object.keys(parts).reduce((n, k) => n + parts[k] * weights[k], 0);
  bar.style.width = `${Math.round(Math.min(1, total) * 100)}%`;
  label.textContent = `${names[stage] ?? "Loading"} · ${Math.round(total * 100)}%`;
}
window.__nebulaProgress = (s, f) => {
  if (s === "physics" || s === "scene") parts.code = 1;
  if (s === "scene") parts.physics = 1;
  stage = s;
  parts[s] = Math.max(parts[s] ?? 0, f);
  render();
};
window.__nebulaReady = () => {
  parts.code = parts.physics = parts.scene = 1;
  render();
  // Keep the visual fade, but retire the loader heading and controls immediately.
  boot.setAttribute("aria-hidden", "true");
  boot.inert = true;
  boot.classList.add("done");
  setTimeout(() => boot.remove(), 700);
};
retry.onclick = () => location.reload();
render();
import("./main").catch((e) => {
  console.error(e);
  label.textContent = "Could not load the game. Check your connection and retry.";
  boot.classList.add("failed");
  retry.hidden = false;
});
declare global {
  interface Window {
    __nebulaProgress?: (stage: string, fraction: number) => void;
    __nebulaReady?: () => void;
  }
}
export {};
