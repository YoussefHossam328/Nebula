import { test, expect } from "@playwright/test";
test("launches seven-sol scenario with tracked generation and physical telemetry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page.locator("#base-start").click();
  await page.locator("canvas").focus();
  await page.waitForFunction(() => (window as any).nebula.base?.elapsed > 200);
  await expect(page.locator("#base-clock")).toContainText("Sol 1 / 7");
  await expect(page.locator("#base-dose-text")).toContainText("mGy");
  expect(await page.evaluate(() => (window as any).nebula.base.tracking)).toBe(
    true,
  );
  await page.locator("#base-pause").click();
  await page.waitForFunction(
    () => (window as any).nebula.base.state === "paused",
  );
  const time = await page.evaluate(() => (window as any).nebula.base.elapsed);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as any).nebula.base.elapsed)).toBe(
    time,
  );
  await page.locator("#base-pause").click();
  await page.locator("#base-restart").click();
  await expect(page.locator("#base-clock")).toContainText("Sol 1 / 7");
  await page.locator("#base-exit").click();
  await expect(page.locator("#base-start")).toBeVisible();
  expect(errors).toEqual([]);
});
test("walks to array, cancels a hold, cleans while held, and preserves exposure on reset", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page.locator("#base-start").click();
  await page.locator("canvas").focus();
  test.setTimeout(45000);
  // Walk west around the oxygen unit, then northwest toward the array.
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyA");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.position.x), {
      timeout: 15000,
    })
    .toBeLessThan(-4.2);
  await page.keyboard.up("KeyW");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const p = (window as any).nebula.position;
          return Math.hypot(p.x + 6, p.z - 2);
        }),
      { timeout: 10000 },
    )
    .toBeLessThan(2.2);
  await page.keyboard.up("KeyA");
  await page.keyboard.down("KeyE");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.base.cleanProgress))
    .toBeGreaterThan(0.3);
  await page.keyboard.up("KeyE");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.base.cleanProgress))
    .toBe(0);
  await page.keyboard.down("KeyE");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.base.cleanCount), {
      timeout: 10000,
    })
    .toBeGreaterThan(0);
  await page.keyboard.up("KeyE");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.solar.visualState))
    .toBe("clean");
  const dose = await page.evaluate(() => (window as any).nebula.base.dose);
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.position.x))
    .toBeCloseTo(0, 5);
  expect(
    await page.evaluate(() => (window as any).nebula.base.dose),
  ).toBeGreaterThanOrEqual(dose);
  await page.screenshot({ path: "test-results/seven-sol-scenario.png" });
});
test("shelter entry requires walking through its open side", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page.locator("#base-start").click();
  await page.locator("canvas").focus();
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyS");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.position.x), {
      timeout: 15000,
    })
    .toBeGreaterThan(5.5);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyS");
  const outsideStress = await page.evaluate(
    () => (window as any).nebula.base.stress,
  );
  await page.keyboard.down("KeyA");
  await page.keyboard.down("KeyS");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.base.sheltered), {
      timeout: 15000,
    })
    .toBe(true);
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyS");
  await expect(page.locator("#base-location")).toContainText(
    "Inside storm shelter",
  );
  const received = await page.evaluate(() => (window as any).nebula.base.dose);
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.base.stress))
    .toBeLessThan(outsideStress);
  expect(
    await page.evaluate(() => (window as any).nebula.base.dose),
  ).toBeGreaterThanOrEqual(received);
  await expect(page.locator("#base-stress-block")).toContainText("fictional");
});
