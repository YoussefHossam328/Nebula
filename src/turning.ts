export function smoothHeading(
  current: number,
  target: number,
  responsiveness: number,
  dt: number,
) {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + delta * (1 - Math.exp(-responsiveness * Math.max(0, dt)));
}
