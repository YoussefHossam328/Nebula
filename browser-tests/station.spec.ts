import { test, expect } from "@playwright/test";
test("walks into a colliding prototype habitat and cuts away roof, then restores on exit", async ({
  page,
}) => {
  test.setTimeout(45000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  expect(
    await page.evaluate(() => (window as any).nebula.station.roofVisible),
  ).toBe(true);
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyD");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.station.inside), {
      timeout: 15000,
    })
    .toBe(true);
  await page.keyboard.up("KeyW");
  await page.keyboard.up("KeyD");
  expect(
    await page.evaluate(() => (window as any).nebula.station.roofVisible),
  ).toBe(false);
  await page.screenshot({ path: "test-results/habitat-cutaway.png" });
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.station.roofVisible))
    .toBe(true);
  expect(errors).toEqual([]);
});
test("facing stays fixed during stopping and settings explain themselves", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(300);
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(100);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyS");
  await page.waitForTimeout(100);
  const angle = await page.evaluate(() => (window as any).nebula.facingYaw);
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.horizontalSpeed))
    .toBe(0);
  expect(await page.evaluate(() => (window as any).nebula.facingYaw)).toBe(
    angle,
  );
  await page.locator(".lil-gui.lil-root > .lil-title").click();
  await page.getByText("Movement", { exact: true }).click();
  const walk = page.locator('[data-setting="walk"]');
  await expect(walk.locator(".setting-help")).toContainText(
    "metres per second",
  );
  expect(
    await walk.locator("input").first().getAttribute("aria-describedby"),
  ).toBeTruthy();
  await expect(
    page.locator(".lil-controller:not(.has-setting-help)"),
  ).toHaveCount(0);
});
