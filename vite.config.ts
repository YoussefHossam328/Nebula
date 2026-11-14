import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { manusGameTuning } from "./scripts/manus-tuning/vite.mjs";

// Rapier's official non-compat build imports its .wasm as an ES module. This
// plugin swaps that one import for a small loader that streams the binary as a
// separate, cacheable file instead of the compat build's 4 MB base64 string.
export function rapierWasm(): Plugin {
  const shim = fileURLToPath(
    new URL("./src/vendor/rapier-wasm.js", import.meta.url),
  );
  return {
    name: "nebula-rapier-wasm",
    enforce: "pre",
    resolveId(source, importer) {
      if (
        importer &&
        /@dimforge[\\/]rapier3d[\\/]/.test(importer) &&
        /^\.\/rapier_wasm3d(\.js)?$/.test(source)
      )
        return shim;
      return null;
    },
  };
}

export const rapierAlias = [
  {
    find: /^@dimforge\/rapier3d$/,
    replacement: fileURLToPath(
      new URL("./node_modules/@dimforge/rapier3d/rapier.js", import.meta.url),
    ),
  },
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", ["HOST", "PORT"]);
  const port = Number(env.PORT ?? process.env.PORT ?? 5173);
  return {
    // Relative base works for Manus hosting, GitHub Pages sub-paths and file previews.
    base: "./",
    plugins: [rapierWasm(), manusGameTuning()],
    resolve: { alias: rapierAlias },
    optimizeDeps: { exclude: ["@dimforge/rapier3d"] },
    server: {
      host: env.HOST ?? process.env.HOST ?? "0.0.0.0",
      port,
      strictPort: true,
      allowedHosts: true,
    },
    build: {
      target: "es2022",
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules/three/")) return "three";
            if (id.includes("@dimforge/rapier3d") || id.includes("rapier-wasm"))
              return "rapier";
            if (id.includes("node_modules/lil-gui")) return "debug-ui";
            return undefined;
          },
        },
      },
    },
  };
});
