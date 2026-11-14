import * as THREE from "three";

/**
 * Compact world-space label: a translucent pill with an optional key chip.
 * "E / O₂ PLANT" renders as [E] O₂ PLANT; "HOLD E / CLEAN" as [HOLD E] CLEAN.
 */
export function makeLabel(text: string, width = 2.6) {
  const [maybeKey, ...rest] = text.split(" / ");
  const hasKey = rest.length > 0 && maybeKey.length <= 7;
  const key = hasKey ? maybeKey : "";
  const body = hasKey ? rest.join(" / ") : text;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 112;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "600 34px Inter, system-ui, sans-serif";
  const keyFont = "700 28px Inter, system-ui, sans-serif";
  ctx.font = keyFont;
  const keyW = key ? ctx.measureText(key).width + 30 : 0;
  ctx.font = "600 34px Inter, system-ui, sans-serif";
  const bodyW = ctx.measureText(body).width;
  const total = Math.min(620, keyW + (key ? 18 : 0) + bodyW + 56);
  const x0 = (640 - total) / 2;
  const y0 = 14,
    h = 84;
  ctx.fillStyle = "rgba(24, 18, 15, 0.84)";
  ctx.strokeStyle = "rgba(240, 190, 140, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x0, y0, total, h, 42);
  ctx.fill();
  ctx.stroke();
  let x = x0 + 28;
  if (key) {
    ctx.fillStyle = "#f4d9b0";
    ctx.beginPath();
    ctx.roundRect(x, y0 + 18, keyW, h - 36, 10);
    ctx.fill();
    ctx.fillStyle = "#24170f";
    ctx.font = keyFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(key, x + keyW / 2, y0 + h / 2 + 1);
    x += keyW + 18;
  }
  ctx.fillStyle = "#f6e6cf";
  ctx.font = "600 34px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(body, x, y0 + h / 2 + 1, total - (x - x0) - 24);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  sprite.scale.set(width, (width * 112) / 640, 1);
  sprite.renderOrder = 5;
  sprite.userData.label = text;
  return sprite;
}
