import { test, expect } from "@playwright/test";
test("optional training toggles unit, pauses, restarts and exits", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page.locator("#training-start").click();
  await expect(page.locator("#training-status")).toContainText("running");
  await page.locator("canvas").focus();
  await page.keyboard.down("KeyA");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const p = (window as any).nebula.position;
          return Math.hypot(p.x + 2, p.z - 2);
        }),
      { timeout: 15000 },
    )
    .toBeLessThan(1.8);
  await page.keyboard.up("KeyA");
  await page.keyboard.press("KeyE");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.resources.on))
    .toBe(true);
  await page.locator("#training-pause").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.resources.state))
    .toBe("paused");
  const b = await page.evaluate(() => (window as any).nebula.resources.battery);
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => (window as any).nebula.resources.battery),
  ).toBe(b);
  await page.locator("#training-pause").click();
  await expect(page.locator("#training-status")).toContainText("running");
  await page.locator("#training-restart").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.resources.on))
    .toBe(false);
  await page.locator("#training-exit").click();
  await expect(page.locator("#training-status")).toContainText("Sandbox");
  await expect(page.locator(".source")).toContainText(
    "Simulated training data",
  );
});
test("editing pauses, applying restarts and depletion gives retry feedback", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page.locator("#training-start").click();
  await page.locator(".training summary").click();
  await expect(page.locator("#training-status")).toContainText("paused");
  await page.locator('input[name="duration"]').fill("2");
  await page.locator('input[name="oxygen"]').fill("0.1");
  await page.getByRole("button", { name: "Apply and restart" }).click();
  await expect(page.locator("#training-status")).toContainText(
    "Try another balance.",
  );
  await page.locator('input[name="duration"]').fill("0.2");
  await page.locator('input[name="oxygen"]').fill("35");
  await page.getByRole("button", { name: "Apply and restart" }).click();
  await expect(page.locator("#training-status")).toContainText(
    "Training complete!",
  );
  await page.locator(".training summary").click();
  await page.screenshot({ path: "test-results/resource-training.png" });
});
