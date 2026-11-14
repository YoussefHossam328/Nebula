import { test, expect, type Page } from "@playwright/test";

const nebula = (page: Page) => page.evaluate(() => (window as any).nebula);

async function startChallenge(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page.evaluate(() => localStorage.removeItem("nebula.mission.v1"));
  await page.getByRole("button", { name: /challenge/i }).first().click();
  for (let i = 0; i < 6; i++) {
    const b = page.locator("#game-overlay:not([hidden]) button").first();
    if ((await b.count()) && (await b.isVisible())) await b.click();
    else break;
  }
  await expect.poll(async () => (await nebula(page)).game).toBe("mission");
}

test("scrubbing the panel restores transmission and counts a cleaning", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await startChallenge(page);
  await page.evaluate(() => (window as any).nebula.actions.teleport(-8, 3));
  await expect(page.locator("#mission-prompt")).toContainText(
    "Open panel service",
  );
  const before = (await nebula(page)).dust;
  await page.keyboard.press("KeyE");
  await expect(page.locator("#clean-game")).toBeVisible();
  // Real pointer drags remove some dust and raise transmission progressively.
  const box = (await page.locator("#clean-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  for (let k = 0; k < 6; k++)
    await page.mouse.move(
      box.x + box.width * (k % 2 ? 0.3 : 0.7),
      box.y + box.height * 0.5,
      { steps: 4 },
    );
  await page.mouse.up();
  await expect
    .poll(async () => (await nebula(page)).cleaning.fraction)
    .toBeGreaterThan(0.01);
  expect((await nebula(page)).dust).toBeGreaterThan(before - 0.001);
  // Esc leaves a partial job: the hatch closes without counting a cleaning.
  await page.keyboard.press("Escape");
  await expect(page.locator("#clean-game")).toBeHidden();
  expect((await nebula(page)).base.cleanCount).toBe(0);
  // Finish the job.
  await page.keyboard.press("KeyE");
  await expect(page.locator("#clean-game")).toBeVisible();
  await page.evaluate(() => (window as any).nebula.actions.autoScrub(8));
  await expect
    .poll(async () => (await nebula(page)).base.cleanCount, { timeout: 10000 })
    .toBe(1);
  await expect(page.locator("#clean-game")).toBeHidden({ timeout: 5000 });
  expect((await nebula(page)).dust).toBeGreaterThan(0.97);
  expect(errors).toEqual([]);
});

test("mission saves locally and can be continued from the menu", async ({
  page,
}) => {
  test.setTimeout(60000);
  await startChallenge(page);
  await page.evaluate(() => (window as any).nebula.actions.teleport(-3, 4));
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Main menu" }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nebula.mission.v1") ?? "null"),
  );
  expect(saved?.version).toBe(1);
  await page.reload();
  await page.waitForFunction(() => (window as any).nebula?.ready);
  const cont = page.getByRole("button", { name: /Continue mission/ });
  await expect(cont).toBeVisible();
  await cont.click();
  await expect.poll(async () => (await nebula(page)).game).toBe("mission");
  const n = await nebula(page);
  expect(n.base.elapsed).toBeGreaterThanOrEqual(saved.sim.elapsed - 1);
  expect(Math.hypot(n.position.x + 3, n.position.z - 4)).toBeLessThan(1);
});

test("closing debug opened from play returns to play", async ({ page }) => {
  await startChallenge(page);
  await page.locator("#game-debug").click();
  await expect.poll(async () => (await nebula(page)).game).toBe("paused");
  await page.locator("#game-debug").click();
  await expect.poll(async () => (await nebula(page)).game).toBe("mission");
  await expect(page.locator("#game-overlay")).toBeHidden();
});

test("touch controls drive movement", async ({ page }) => {
  await page.goto("./?touch");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page.evaluate(() => localStorage.removeItem("nebula.mission.v1"));
  await page.getByRole("button", { name: /challenge/i }).first().click();
  for (let i = 0; i < 6; i++) {
    const b = page.locator("#game-overlay:not([hidden]) button").first();
    if ((await b.count()) && (await b.isVisible())) await b.click();
    else break;
  }
  await expect(page.locator("#touch-stick")).toBeVisible();
  const start = (await nebula(page)).position;
  const box = (await page.locator("#touch-stick").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 4, { steps: 3 });
  await page.waitForTimeout(900);
  await page.mouse.up();
  const end = (await nebula(page)).position;
  expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(0.5);
});
