import { it, expect } from "vitest";
import { smoothHeading } from "../src/turning";
it("smoothly crosses intermediate angles and converges without selecting another heading", () => {
  const first = smoothHeading(0, Math.PI / 2, 12, 1 / 60);
  expect(first).toBeGreaterThan(0);
  expect(first).toBeLessThan(Math.PI / 2);
  let current = first;
  for (let i = 0; i < 120; i++)
    current = smoothHeading(current, Math.PI / 2, 12, 1 / 60);
  expect(current).toBeCloseTo(Math.PI / 2, 8);
});
it("uses shortest arc across signed pi and is independent of render rate", () => {
  const a = smoothHeading(3.13, -3.13, 12, 1 / 60);
  expect(Math.abs(a - 3.13)).toBeLessThan(0.03);
  for (const fps of [30, 60, 120]) {
    let angle = 0;
    for (let i = 0; i < fps; i++)
      angle = smoothHeading(angle, 1.2, 12, 1 / fps);
    expect(angle).toBeCloseTo(smoothHeading(0, 1.2, 12, 1), 8);
  }
});
