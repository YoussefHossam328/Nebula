import { defineConfig } from "@playwright/test";
export default defineConfig({
  workers: 1,
  testDir: "./browser-tests",
  use: {
    baseURL: "http://127.0.0.1:4173/Nebula/",
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173/Nebula/",
    reuseExistingServer: !process.env.CI,
  },
});
