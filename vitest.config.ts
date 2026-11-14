import { defineConfig } from "vitest/config";
import { rapierAlias, rapierWasm } from "./vite.config.ts";
export default defineConfig({
  plugins: [rapierWasm()],
  resolve: { alias: rapierAlias },
  test: {
    include: ["tests/**/*.test.ts"],
    server: { deps: { inline: [/@dimforge\/rapier3d/] } },
  },
});
