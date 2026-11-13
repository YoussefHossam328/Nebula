/** Local scenario timings in sols. Particle dose uses the separate RAD-reference curve. */
export const eventDefaults = {
  dustSol: 1,
  dustDuration: 0.35,
  coldSol: 2,
  coldDuration: 0.4,
  strongDustSol: 5,
  strongDustDuration: 0.4,
  warningSols: 0.08,
};
export function scheduledEvent(
  sol: number,
  c = eventDefaults,
): { active: "dust" | "cold" | "none"; warning: "dust" | "cold" | "none" } {
  const events = [
    { kind: "dust" as const, start: c.dustSol, duration: c.dustDuration },
    { kind: "cold" as const, start: c.coldSol, duration: c.coldDuration },
    {
      kind: "dust" as const,
      start: c.strongDustSol,
      duration: c.strongDustDuration,
    },
  ];
  const active = events.find(
    (e) => sol >= e.start && sol < e.start + e.duration,
  );
  const warning = events.find(
    (e) => sol >= e.start - c.warningSols && sol < e.start,
  );
  return { active: active?.kind ?? "none", warning: warning?.kind ?? "none" };
}
