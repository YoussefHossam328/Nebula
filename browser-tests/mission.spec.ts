import { test, expect } from "@playwright/test";
test("menu, training dialogue, fresh challenge, pause and restart routes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await expect(
    page.locator("#game-overlay").getByRole("heading", { name: "NEBULA", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "NEBULA", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Mars" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try it", exact: true }).click();
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyD");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.horizontalSpeed))
    .toBe(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restart challenge", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.game))
    .toBe("mission");
  await expect(page.locator("#mission-Nourishment")).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const elapsed = await page.evaluate(
    () => (window as any).nebula.base.elapsed,
  );
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).nebula.base.elapsed)).toBe(
    elapsed,
  );
  await page.getByRole("button", { name: "Main menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("debug window can activate a visual disaster and restart training", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page
    .getByRole("button", { name: "Start challenge", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Debug / settings", exact: true })
    .click();
  await page.getByText("Mission · events and crops", { exact: true }).click();
  await page.locator('[data-setting="dust"] button').click();
  await page
    .getByRole("button", { name: "Debug / settings", exact: true })
    .click();
  // Closing debug that was opened from play resumes play directly.
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.base.hazard))
    .toBe("dust");
  await expect(page.locator("body")).toHaveClass(/dust-event/);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .getByRole("button", { name: "Restart tutorials", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Mars" }),
  ).toBeVisible();
});
test("loss offers a fresh challenge or tutorials", async ({ page }) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page
    .getByRole("button", { name: "Start challenge", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Debug / settings", exact: true })
    .click();
  await page.getByText("Base · seven-sol scenario", { exact: true }).click();
  await page.getByText("Oxygen · kg / kg per hour", { exact: true }).click();
  const oxygen = page.locator('[data-setting="initialOxygen"] input');
  await oxygen.fill("0");
  await oxygen.press("Tab");
  await page
    .getByRole("button", {
      name: "Apply base settings and restart",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Debug / settings", exact: true })
    .click();
  // Closing debug that was opened from play resumes play directly.
  await expect(page.getByRole("heading", { name: "Run ended" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restart challenge", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restart tutorials", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Mars" }),
  ).toBeVisible();
});
