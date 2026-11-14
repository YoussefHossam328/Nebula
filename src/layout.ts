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
