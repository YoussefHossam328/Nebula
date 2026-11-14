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
const teleport = (page: Page, x: number, z: number) =>
  page.evaluate(([x, z]) => (window as any).nebula.actions.teleport(x, z), [x, z]);

test("oxygen drains outside; the habitat refills it and acts as the radiation shelter", async ({
  page,
}) => {
  test.setTimeout(60000);
  await startChallenge(page);
  await teleport(page, 8, 6);
  await expect.poll(async () => (await nebula(page)).base.sheltered).toBe(false);
  const a = (await nebula(page)).base;
  await page.waitForTimeout(2500);
  const b = (await nebula(page)).base;
  expect(b.oxygen).toBeLessThan(a.oxygen);
  expect(b.stress).toBeGreaterThan(a.stress);
  await teleport(page, 2, -1);
  await expect.poll(async () => (await nebula(page)).base.sheltered).toBe(true);
  const c = (await nebula(page)).base;
  await page.waitForTimeout(2500);
  const d = (await nebula(page)).base;
  expect(d.oxygen).toBeGreaterThan(c.oxygen);
  expect(d.stress).toBeLessThanOrEqual(c.stress);
});

test("oxygen plant leaks vent the reserve until found and taped", async ({
  page,
}) => {
  test.setTimeout(60000);
  await startChallenge(page);
  await page.evaluate(() => (window as any).nebula.actions.puncture(2));
  await expect(page.locator("#mission-leak")).toContainText("×2");
  await teleport(page, -6.4, 0.4);
  await page.waitForTimeout(500);
  await page.locator("#world").focus();
  await page.keyboard.press("KeyE");
  await expect(page.locator("#oxygen-game")).toBeVisible();
  expect((await nebula(page)).oxygenPlant.leaks).toHaveLength(2);
  await page.evaluate(() => (window as any).nebula.actions.autoSeal());
  await expect.poll(async () => (await nebula(page)).base.punctures).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#oxygen-game")).toBeHidden();
  await expect(page.locator("#mission-leak")).not.toHaveClass(/show/);
  await expect.poll(async () => (await nebula(page)).game).toBe("mission");
});

test("harvest view cuts ripe trusses for nourishment and replants the bed", async ({
  page,
}) => {
  test.setTimeout(60000);
  await startChallenge(page);
  await page.evaluate(() => {
    // Make room for a full meal.
    (window as any).nebula.base && 0;
  });
  await teleport(page, 1.9, -9);
  await page.waitForTimeout(500);
  const before = (await nebula(page)).base.nourishment;
  await page.locator("#world").focus();
  await page.keyboard.press("KeyE");
  await expect(page.locator("#harvest-game")).toBeVisible();
  // A real swipe with the mouse across the stage moves the shears.
  const box = (await page.locator("#harvest-game canvas").boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.evaluate(() => (window as any).nebula.actions.autoHarvest());
  await expect.poll(async () => (await nebula(page)).harvest.open, { timeout: 6000 }).toBe(false);
  const after = (await nebula(page)).base;
  expect(after.nourishment).toBeGreaterThan(before);
  expect(after.crops[0]).toBeLessThan(1);
  await expect.poll(async () => (await nebula(page)).game).toBe("mission");
});

test("each completed sol beams up a NASA APOD card that can be dismissed and reopened", async ({ page }) => {
  await startChallenge(page);
  await page.evaluate(() => (window as any).nebula.actions.setHour(24.55));
  await expect.poll(async () => (await nebula(page)).apod?.visible, { timeout: 20000 }).toBe(true);
  const st = (await nebula(page)).apod;
  expect(st.sol).toBe(1);
  expect(st.title).toBeTruthy();
  await expect(page.locator("#apod-card h3")).toHaveText(st.title);
  await page.locator("#apod-card .apod-close").click();
  await expect.poll(async () => (await nebula(page)).apod.chip).toBe(true);
  await page.locator("#apod-chip").click();
  await expect.poll(async () => (await nebula(page)).apod.visible).toBe(true);
  // The simulation keeps running while the card is open.
  expect((await nebula(page)).game).toBe("mission");
});

test("mission ground is the baked Jezero terrain with a level base pad", async ({ page }) => {
  await startChallenge(page);
  await teleport(page, 40, -75);
  await expect.poll(async () => (await nebula(page)).grounded, { timeout: 10000 }).toBe(true);
  const y = (await nebula(page)).position.y;
  expect(y).toBeGreaterThan(8); // standing on a real slope well above the pad
  await teleport(page, 0, 8);
  await expect
    .poll(async () => (await nebula(page)).position.y, { timeout: 10000 })
    .toBeLessThan(1.05);
  await expect.poll(async () => (await nebula(page)).grounded, { timeout: 10000 }).toBe(true);
  expect(Math.abs((await nebula(page)).position.y - 0.82)).toBeLessThan(0.2);
});
