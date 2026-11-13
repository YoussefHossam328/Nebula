import { test, expect } from "@playwright/test";
test("loads supplied player, maps locomotion without root travel and decodes all provided sounds", async ({
  page,
}) => {
  test.setTimeout(45000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  expect(await page.evaluate(() => (window as any).nebula.model.loaded)).toBe(
    true,
  );
  expect(
    await page.evaluate(() => (window as any).nebula.model.clipNames),
  ).toHaveLength(2);
  await page.keyboard.down("KeyD");
  await page.waitForFunction(
    () => (window as any).nebula.model.state === "walk",
  );
  await page.waitForFunction(() => (window as any).nebula.audio.loaded === 9);
  await page.waitForFunction(() => (window as any).nebula.audio.played > 0);
  await page.keyboard.up("KeyD");
  expect(await page.evaluate(() => (window as any).nebula.audio.failed)).toBe(
    0,
  );
  expect(
    await page.evaluate(() => (window as any).nebula.model.rootMotionRemoved),
  ).toBe(true);
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.horizontalSpeed))
    .toBe(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.model.state))
    .toBe("idle");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.audio.played))
    .toBeGreaterThan(0);
  // A new heading should be approached through intermediate rendered angles.
  const angle = await page.evaluate(() => (window as any).nebula.visualYaw);
  await page.keyboard.down("KeyS");
  await page.waitForFunction(
    (before) => Math.abs((window as any).nebula.visualYaw - before) > 0.01,
    angle,
  );
  await page.keyboard.up("KeyS");
  await page.waitForTimeout(100);
  const stopped = await page.evaluate(() => (window as any).nebula.visualYaw);
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(() => (window as any).nebula.visualYaw),
  ).toBeCloseTo(stopped, 8);
  await page.waitForFunction(() => (window as any).nebula.grounded);
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.audio.lastSound))
    .toBe("jump");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.audio.lastSound), {
      timeout: 8000,
    })
    .toBe("land");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/player-model.png" });
});
