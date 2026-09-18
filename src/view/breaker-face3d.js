/**
 * 断路器 / SPD / 漏保正面精绘（按贴图宽高比生成高分辨率纹理，避免竖图画布被拉糊）。
 */
import { Is, ye, THREE } from "./three-shim.js";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W
 * @param {number} H
 * @param {object} product
 */
export function paintBreakerFace(ctx, W, H, product) {
  const brandRaw = product.brand || "";
  const brand =
    brandRaw === "Schneider Electric"
      ? "Schneider"
      : brandRaw === "ABB"
        ? "ABB"
        : brandRaw;
  const kind = product.kind || "mcb";
  const series = product.custom
    ? product.name || product.sku || "CUSTOM"
    : kind === "spd"
      ? "iPRD40"
      : kind === "rccb"
        ? "iID A-SI"
        : String(product.name || "").startsWith("DS")
          ? "DS201 A"
          : brandRaw === "ABB"
            ? "System M"
            : "Acti9";
  const ampsLabel =
    product.amps == null
      ? kind === "spd" || product.custom
        ? "T2"
        : "—"
      : kind === "rccb"
        ? `${product.amps}A`
        : `C${product.amps}`;
  const accent = product.color || "#2a8d68";

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#f7f9f4");
  bg.addColorStop(0.55, "#eef2ea");
  bg.addColorStop(1, "#e2e8df");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#c5d0c4";
  ctx.lineWidth = Math.max(2, H * 0.012);
  ctx.strokeRect(1, 1, W - 2, H - 2);

  const barH = Math.max(4, Math.round(H * 0.055));
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, barH);
  const hi = ctx.createLinearGradient(0, 0, 0, barH);
  hi.addColorStop(0, "rgba(255,255,255,.4)");
  hi.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hi;
  ctx.fillRect(0, 0, W, barH);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#3a6653";
  ctx.font = `600 ${Math.round(H * 0.09)}px Arial,"Segoe UI","PingFang SC",sans-serif`;
  ctx.fillText(brand, W / 2, H * 0.16, W * 0.9);

  ctx.fillStyle = "#67756a";
  ctx.font = `500 ${Math.round(H * 0.075)}px Arial,"Segoe UI","PingFang SC",sans-serif`;
  ctx.fillText(series, W / 2, H * 0.32, W * 0.88);

  // 电流铭牌底板
  const plateY = H * 0.52;
  const plateH = H * 0.28;
  const plateW = W * 0.82;
  const plateX = (W - plateW) / 2;
  roundRect(ctx, plateX, plateY - plateH / 2, plateW, plateH, Math.min(8, plateH * 0.12));
  ctx.fillStyle = "#fbfcf9";
  ctx.fill();
  ctx.strokeStyle = "#d5ddd2";
  ctx.lineWidth = Math.max(1, H * 0.006);
  ctx.stroke();

  ctx.fillStyle = "#253f30";
  ctx.font = `700 ${Math.round(H * 0.17)}px Arial,"Segoe UI",sans-serif`;
  ctx.fillText(ampsLabel, W / 2, plateY, plateW * 0.92);

  if (product.residual) {
    ctx.fillStyle = "#708174";
    ctx.font = `500 ${Math.round(H * 0.055)}px Arial,sans-serif`;
    ctx.fillText(`${product.rcdType || "A"} / ${product.residual}mA`, W / 2, H * 0.86, W * 0.9);
  } else if (kind === "spd") {
    ctx.fillStyle = "#708174";
    ctx.font = `500 ${Math.round(H * 0.055)}px Arial,sans-serif`;
    ctx.fillText("SPD · Type 2", W / 2, H * 0.86, W * 0.9);
  } else {
    ctx.fillStyle = "#9aa89c";
    ctx.font = `500 ${Math.round(H * 0.045)}px Arial,sans-serif`;
    const mods = product.modules != null ? `${product.modules}M` : "";
    const dim =
      product.width && product.height
        ? `${product.width}×${product.height}`
        : mods;
    if (dim) ctx.fillText(dim, W / 2, H * 0.9, W * 0.9);
  }

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * @param {*} kit Studio kit (ja)
 * @param {object} product
 * @param {number} faceWmm
 * @param {number} faceHmm
 */
export function makeBreakerFaceTexture(kit, product, faceWmm, faceHmm) {
  const px = 20;
  const texW = Math.min(2048, Math.max(384, Math.round(faceWmm * px)));
  const texH = Math.min(4096, Math.max(512, Math.round(faceHmm * px)));
  const key =
    `breaker-face-hi:${texW}x${texH}:` +
    JSON.stringify([
      product.id,
      product.brand,
      product.name,
      product.amps,
      product.kind,
      product.residual,
      product.rcdType,
      product.color,
    ]);
  if (kit.textures.has(key)) return kit.textures.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext("2d", { alpha: false });
  paintBreakerFace(ctx, texW, texH, product);

  const tex = new Is(canvas);
  tex.colorSpace = ye;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  kit.textures.set(key, tex);
  kit.own(tex);
  return tex;
}
