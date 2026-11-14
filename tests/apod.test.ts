import { test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dateForSol, isPlaceholder } from "../src/apod";

test("detects the APOD API's post-migration placeholder response", () => {
  expect(
    isPlaceholder({
      title: "NASA Science",
      url: "https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png",
      explanation: "Discover the cosmos! Each day a different image...",
    }),
  ).toBe(true);
  expect(
    isPlaceholder({
      title: "NGC 6960: The Witch's Broom Nebula",
      url: "https://apod.nasa.gov/apod/image/2510/WitchBroom_Meyers_1080.jpg",
      explanation: "Ten thousand years ago...",
    }),
  ).toBe(false);
});

test("each sol maps to a distinct past date ending yesterday at the final sol", () => {
  const today = new Date(Date.UTC(2026, 10, 14));
  const dates = [1, 2, 3, 4, 5, 6, 7].map((s) => dateForSol(s, 7, today));
  expect(new Set(dates).size).toBe(7);
  expect(dates[6]).toBe("2026-11-13");
  expect(dates[0]).toBe("2026-11-07");
});

test("baked fallback entries are complete real APOD records with local images", () => {
  const a = JSON.parse(readFileSync("public/apod/archive.json", "utf8"));
  expect(a.entries.length).toBeGreaterThanOrEqual(7);
  for (const e of a.entries) {
    expect(e.title.length).toBeGreaterThan(3);
    expect(e.explanation.length).toBeGreaterThan(80);
    expect(e.source).toMatch(/^https:\/\/science\.nasa\.gov\/image-article\/apod-/);
    expect(e.copyright).toBe(false);
    expect(existsSync("public/apod/" + e.image)).toBe(true);
  }
});
