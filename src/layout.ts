/** Shared equipment anchors keep visible props, prompts and physics in agreement. */
export function stationLayout() {
  const legacy =
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).has("lab");
  return legacy
    ? {
        oxygen: { x: -2, z: 2 },
        farm: { x: -2, z: -3 },
        farmTarget: { x: -1.2, z: -3 },
      }
    : {
        oxygen: { x: -6.4, z: -0.3 },
        farm: { x: 1.1, z: -10 },
        farmTarget: { x: 1.9, z: -10 },
      };
}

/**
 * Interior of the authored three-room habitat (rooms + corridors). Its walls
 * double as the radiation shelter: regolith-covered modules attenuate dose.
 */
export function insideHabitat(p: { x: number; y: number; z: number }) {
  return (
    p.y > -0.5 &&
    p.y < 2.7 &&
    (Math.hypot(p.x - 2, p.z + 1) < 3 ||
      Math.hypot(p.x + 7, p.z + 1) < 3 ||
      Math.hypot(p.x - 2, p.z + 9.6) < 3 ||
      (p.x > -4.4 && p.x < -0.6 && Math.abs(p.z + 1) < 1) ||
      (Math.abs(p.x - 2) < 1 && p.z < -3.6 && p.z > -7))
  );
}
