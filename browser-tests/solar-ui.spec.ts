import { test, expect } from "@playwright/test";
test("loads the authored solar model and keeps its mast upright while the child tracks", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.solar?.loaded);
  const solar = await page.evaluate(() => (window as any).nebula.solar);
  expect(solar.materialCount).toBe(2);
  expect(solar.hasCleanDirtyStates).toBe(true);
  expect(solar.visualState).toBe("dirty");
  await page.locator("#base-start").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.solar.tilt))
    .toBeGreaterThan(0.1);
  expect(
    await page.evaluate(() => (window as any).nebula.solar.yaw),
  ).toBeCloseTo(Math.PI / 2, 2);
});
test("reference preview uses SVG icons with a background-free bottom HUD in each state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("previews/hud-reference.html");
  for (const state of ["day", "night", "warn", "shelter"]) {
    await page.locator("#mb-" + state).click();
    await expect
      .poll(() => page.locator(".survival-dock .ui-icon").count())
      .toBeGreaterThan(2);
    const style = await page.locator(".survival-dock").evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        shadow: s.boxShadow,
        blur: s.backdropFilter,
      };
    });
    expect(style).toEqual({
      background: "rgba(0, 0, 0, 0)",
      shadow: "none",
      blur: "none",
    });
    expect(await page.locator("body").innerText()).not.toMatch(
      /[🔋🫧⚠🛡🚨☀🔬⚙⏸]/u,
    );
  }
  await page.locator("#mb-paused").click();
  await expect(page.locator("#mPause")).toHaveClass(/open/);
  await page.getByRole("button", { name: "Resume Exploration" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/hud-reference-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/hud-reference-desktop.png" });
  expect(errors).toEqual([]);
});
