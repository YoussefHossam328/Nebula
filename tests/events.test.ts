import { test, expect } from "vitest";
import { scheduledEvent } from "../src/events";
import { BaseSimulation } from "../src/base/model";
import { baseDefaults, SOL_SECONDS } from "../src/base/config";
test("events warn, become active and finish at defined boundaries", () => {
  expect(scheduledEvent(0.95).warning).toBe("dust");
  expect(scheduledEvent(1).active).toBe("dust");
  expect(scheduledEvent(1.36).active).toBe("none");
  expect(scheduledEvent(2.1).active).toBe("cold");
  expect(scheduledEvent(5.2).active).toBe("dust");
});
test("seven-sol schedule is survivable with harvesting, cleaning, and shielding", () => {
  const s = new BaseSimulation({ ...baseDefaults });
  s.start();
  for (let i = 0; i < 7 * 96 && s.state === "running"; i++) {
    s.hazard = scheduledEvent(s.elapsed / SOL_SECONDS).active;
    if (s.nourishment < 65) s.harvest();
    s.clean(0, false);
    if (i % 96 === 0) s.clean(4, true);
    s.advance(SOL_SECONDS / 96, true);
  }
  expect(s.state).toBe("completed");
  expect(s.dose).toBeLessThan(5);
});
