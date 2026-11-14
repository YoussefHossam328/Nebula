import { test, expect } from "@playwright/test";
test("walks the supplied base to oxygen and powered crop beds", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.waitForFunction(() => (window as any).nebula?.ready);
  await page
    .getByRole("button", { name: "Start challenge", exact: true })
    .click();
  await page.evaluate(() => {
    const s = (window as any).nebula.settings;
    s.yaw = 0;
    s.walk = 2;
    s.resolution = 0.5;
    s.shadows = false;
    dispatchEvent(new Event("resize"));
  });
  async function move(axis: "x" | "z", target: number) {
    const position = await page.evaluate(() => (window as any).nebula.position);
    const sign = position[axis] < target ? 1 : -1;
    const key =
      axis === "x"
        ? sign === 1
          ? "KeyD"
          : "KeyA"
        : sign === 1
          ? "KeyS"
          : "KeyW";
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(
        ({ axis, target, sign }) =>
          sign * ((window as any).nebula.position[axis] - target) >= 0,
        { axis, target, sign },
        { timeout: 15000 },
      );
    } finally {
      await page.keyboard.up(key);
    }
    await page.waitForTimeout(250);
  }
  await move("z", 2.5);
  await move("x", 2);
  await move("z", -1);
  await move("x", -6);
  await page.keyboard.press("KeyE");
  await expect(page.locator("#base-oxygen-text")).toContainText("OFF");
  await move("x", 2);
  await move("z", -8.4);
  const before = await page.evaluate(
    () => (window as any).nebula.base.nourishment,
  );
  await page.keyboard.press("KeyE");
  await expect
    .poll(() => page.evaluate(() => (window as any).nebula.base.nourishment))
    .toBeGreaterThan(before);
  expect(
    await page.evaluate(() => (window as any).nebula.base.crops[0]),
  ).toBeLessThan(1);
  expect(await page.evaluate(() => (window as any).nebula.station.loaded)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
