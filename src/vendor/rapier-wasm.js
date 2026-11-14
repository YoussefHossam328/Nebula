// Replaces @dimforge/rapier3d/rapier_wasm3d.js (see vite.config.ts).
// Fetches the physics binary as its own file so it is cached, compressed by the
// host and never inflated into JavaScript. Progress is reported to the loader.
import * as bg from "@dimforge/rapier3d/rapier_wasm3d_bg.js";
import wasmUrl from "@dimforge/rapier3d/rapier_wasm3d_bg.wasm?url";

const EXPECTED_BYTES = 3082103;

function report(fraction) {
  try {
    globalThis.__nebulaProgress?.("physics", Math.max(0, Math.min(1, fraction)));
  } catch {
    /* progress is cosmetic */
  }
}

async function download() {
  if (import.meta.env.MODE === "test") {
    // Vitest / Node: read the package file directly.
    const { readFile } = await import("node:fs/promises");
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    return readFile(require.resolve("@dimforge/rapier3d/rapier_wasm3d_bg.wasm"));
  }
  const response = await fetch(wasmUrl);
  if (!response.ok) throw new Error(`Physics engine download failed (${response.status})`);
  if (!response.body || typeof response.body.getReader !== "function") {
    const bytes = await response.arrayBuffer();
    report(1);
    return bytes;
  }
  const header = Number(response.headers.get("content-length")) || 0;
  const total = header > 1_000_000 ? Math.max(header, EXPECTED_BYTES * 0.3) : EXPECTED_BYTES;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    report(Math.min(0.98, received / Math.max(total, received)));
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  report(1);
  return bytes;
}

const { instance } = await WebAssembly.instantiate(await download(), {
  "./rapier_wasm3d_bg.js": bg,
});
bg.__wbg_set_wasm(instance.exports);

export * from "@dimforge/rapier3d/rapier_wasm3d_bg.js";
