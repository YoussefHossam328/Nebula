import { test, expect } from "@playwright/test";
test("renders physics sandbox and keyboard movement, jump, crouch, reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?lab");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page.waitForFunction(() => (window as any).nebula.grounded);
  const before = await page.evaluate(() => (window as any).nebula.position);
  await page.keyboard.down("KeyW");
  await expect
    .poll(
      async () => {
        const p = await page.evaluate(() => (window as any).nebula.position);
        return Math.hypot(p.x - before.x, p.z - before.z);
      },
      { timeout: 10000 },
    )
    .toBeGreaterThan(0.6);
  await page.keyboard.up("KeyW");
  const after = await page.evaluate(() => (window as any).nebula.position);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(
    0.5,
  );
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(300);
  await page.keyboard.down("KeyC");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.crouched))
    .toBe(true);
  await page.keyboard.up("KeyC");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).nebula.grounded && !(window as any).nebula.crouched,
      ),
    )
    .toBe(true);
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.grounded))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.grounded), {
      timeout: 20000, // headless software rendering can run at ~4 FPS
    })
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.locator("canvas").evaluate((c) => c.clientWidth))
    .toBe(390);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/mobile-sandbox.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/desktop-sandbox.png" });
});
