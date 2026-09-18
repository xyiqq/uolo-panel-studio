/**
 * 智能/控制模块三维外观（参数化精绘）。
 * 面板纹理按真实贴图宽高比生成高分辨率横版，避免竖图画布被拉糊。
 */
import { rA, pA, Is, ye, sr, Yt, rr, THREE } from "./three-shim.js";

export const KIND_BODY = {
  psu: "#2c3340",
  gateway: "#3a4554",
  relay: "#3d4650",
  contactor: "#3d4650",
  dimmer: "#354050",
  meter: "#2f3a42",
  mcb: "#2a4050",
  rcbo: "#2a4050",
  timer: "#3a4540",
};

export const BRAND_ACCENT = {
  Crestron: "#6eb5ff",
  Lutron: "#c4a35a",
  MDT: "#5a9fd4",
  ABB: "#e0392d",
  明纬: "#e8b84a",
  Lunatone: "#7ec8e3",
  Tridonic: "#8a9aaa",
  涂鸦DIN: "#ff6a3d",
};

const KIND_LABEL = {
  psu: "POWER SUPPLY",
  gateway: "GATEWAY / INTERFACE",
  relay: "SWITCHING ACTUATOR",
  contactor: "MOTOR / CONTACTOR",
  dimmer: "DIMMER / DRIVER",
  meter: "ENERGY METER",
  mcb: "SMART MCB",
  rcbo: "SMART RCBO",
};

/**
 * 横版精绘面板（W≫H，匹配 DIN 模块正面）。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W
 * @param {number} H
 * @param {object} product
 */
export function paintSmartFace(ctx, W, H, product) {
  const brand = product.brand || "";
  const accent = BRAND_ACCENT[brand] || product.color || "#7a8a9a";
  const kind = product.kind || "gateway";
  const name = String(product.name || product.sku || product.id);
  const protocols = Array.isArray(product.protocol) ? product.protocol.map(String) : [];
  const channels = Math.min(12, Number(product.channels) || (kind === "psu" ? 1 : kind === "gateway" ? 2 : 4));

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#343c48");
  bg.addColorStop(0.45, "#252c36");
  bg.addColorStop(1, "#1a1f27");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 外边框
  ctx.strokeStyle = "#0d1014";
  ctx.lineWidth = Math.max(2, H * 0.04);
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // 顶栏品牌色
  const barH = Math.max(6, Math.round(H * 0.1));
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, barH);
  // 高光
  const hi = ctx.createLinearGradient(0, 0, 0, barH);
  hi.addColorStop(0, "rgba(255,255,255,.35)");
  hi.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hi;
  ctx.fillRect(0, 0, W, barH);

  // 左侧色带
  const strip = Math.max(6, Math.round(W * 0.018));
  ctx.fillStyle = accent;
  ctx.fillRect(0, barH, strip, H - barH);

  const padL = strip + Math.round(W * 0.03);
  const padR = Math.round(W * 0.03);
  const contentW = W - padL - padR;
  const midY = barH + (H - barH) * 0.5;

  // 品牌（左上）
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#dce6f0";
  ctx.font = `600 ${Math.round(H * 0.16)}px Arial,"Segoe UI","PingFang SC",sans-serif`;
  ctx.fillText(brand, padL, barH + (H - barH) * 0.22, contentW * 0.42);

  // 型号（右上，大字）
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(H * 0.28)}px Arial,"Segoe UI",sans-serif`;
  ctx.fillText(name, W - padR, barH + (H - barH) * 0.28, contentW * 0.55);

  // 种类（左中）
  ctx.textAlign = "left";
  ctx.fillStyle = "#8fa0b0";
  ctx.font = `500 ${Math.round(H * 0.12)}px Arial,sans-serif`;
  ctx.fillText(KIND_LABEL[kind] || String(kind).toUpperCase(), padL, midY + H * 0.02, contentW * 0.5);

  // 协议徽章（右中）
  const badges = (protocols.length ? protocols : ["DIN"]).slice(0, 3);
  let bx = W - padR;
  const bh = Math.round(H * 0.22);
  const by = midY - bh / 2 + H * 0.02;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = badges.length - 1; i >= 0; i--) {
    const label = badges[i].toUpperCase();
    ctx.font = `700 ${Math.round(H * 0.11)}px Arial,sans-serif`;
    const tw = ctx.measureText(label).width;
    const bw = tw + Math.round(H * 0.28);
    bx -= bw;
    roundRect(ctx, bx, by, bw, bh, Math.round(bh * 0.2));
    ctx.fillStyle = "#0e1319";
    ctx.fill();
    ctx.lineWidth = Math.max(2, H * 0.035);
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillText(label, bx + bw / 2, by + bh / 2);
    bx -= Math.round(W * 0.012);
  }

  // LED 行
  const ledY = barH + (H - barH) * 0.78;
  const ledR = Math.max(3, H * 0.055);
  const ledCount = Math.max(1, channels);
  const ledSpan = Math.min(contentW * 0.7, ledCount * ledR * 3.2);
  for (let i = 0; i < ledCount; i++) {
    const x = padL + ledSpan * ((i + 0.5) / ledCount);
    ctx.beginPath();
    ctx.arc(x, ledY, ledR, 0, Math.PI * 2);
    const on = i === 0;
    ctx.fillStyle = on ? "#3dff9a" : "#1e4a34";
    ctx.fill();
    ctx.lineWidth = Math.max(1, H * 0.02);
    ctx.strokeStyle = on ? "#b8ffe0" : "#0a1810";
    ctx.stroke();
    // 下方小矩条
    ctx.fillStyle = on ? "#2ab56e" : "#243028";
    ctx.fillRect(x - ledR * 0.7, ledY + ledR + 2, ledR * 1.4, Math.max(2, H * 0.04));
  }

  // 电表 LCD（覆盖 LED 区中部）
  if (kind === "meter") {
    const lx = padL + contentW * 0.35;
    const ly = barH + (H - barH) * 0.55;
    const lw = contentW * 0.55;
    const lh = H * 0.32;
    roundRect(ctx, lx, ly, lw, lh, 4);
    ctx.fillStyle = "#061a14";
    ctx.fill();
    ctx.strokeStyle = "#1a6b4a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#4dffc0";
    ctx.font = `600 ${Math.round(H * 0.18)}px ui-monospace,Consolas,monospace`;
    ctx.textAlign = "center";
    ctx.fillText("0.00 kWh", lx + lw / 2, ly + lh / 2, lw * 0.9);
  }

  // 底部尺寸
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#6a7a88";
  ctx.font = `500 ${Math.round(H * 0.1)}px ui-monospace,Consolas,monospace`;
  const mods = product.modules != null ? `${product.modules}M` : "—M";
  const dim =
    product.width != null
      ? `${product.width}×${product.height ?? "—"}×${product.depth ?? "—"}`
      : "";
  ctx.fillText(`${mods}${dim ? "  " + dim : ""}`, W - padR, H - Math.round(H * 0.1));

  // 电源通风细线
  if (kind === "psu") {
    ctx.strokeStyle = "rgba(120,140,160,.45)";
    ctx.lineWidth = Math.max(1, H * 0.015);
    for (let i = 0; i < 3; i++) {
      const y = H - Math.round(H * 0.08) - i * Math.round(H * 0.045);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + contentW * 0.35, y);
      ctx.stroke();
    }
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

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** 文档用横版矢量 SVG */
export function smartFaceSvg(product, width = 360, height = 100) {
  const name = product.name || product.id;
  const brand = product.brand || "";
  const accent = BRAND_ACCENT[brand] || "#7a8a9a";
  const mods = product.modules != null ? `${product.modules}M` : "—";
  const proto = (product.protocol || []).map((p) => String(p).toUpperCase()).join(" · ") || "DIN";
  const kind = KIND_LABEL[product.kind] || product.kind || "";
  const uid = String(product.id || "x").replace(/[^a-zA-Z0-9_-]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#343c48"/><stop offset="100%" stop-color="#1a1f27"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="3" fill="url(#bg-${uid})"/>
  <rect width="100%" height="10" fill="${accent}"/>
  <rect width="6" height="100%" fill="${accent}" opacity="0.7"/>
  <text x="14" y="32" fill="#dce6f0" font-size="13" font-family="Arial,sans-serif" font-weight="600">${escapeXml(brand)}</text>
  <text x="${width - 10}" y="34" text-anchor="end" fill="#fff" font-size="18" font-family="Arial,sans-serif" font-weight="700">${escapeXml(name)}</text>
  <text x="14" y="55" fill="#8fa0b0" font-size="11" font-family="Arial,sans-serif">${escapeXml(kind)}</text>
  <text x="${width - 10}" y="55" text-anchor="end" fill="${accent}" font-size="12" font-family="Arial,sans-serif" font-weight="700">${escapeXml(proto)}</text>
  <text x="${width - 10}" y="${height - 12}" text-anchor="end" fill="#6a7a88" font-size="11" font-family="monospace">${escapeXml(mods)}${product.width ? ` · ${product.width}×${product.height}×${product.depth}` : ""}</text>
</svg>`;
}

function makeFaceTexture(kit, product, faceWmm, faceHmm) {
  const px = 18; // ~18 px/mm → 9M 模块约 2800× 清晰
  const texW = Math.min(4096, Math.max(1024, Math.round(faceWmm * px)));
  const texH = Math.min(2048, Math.max(256, Math.round(faceHmm * px)));
  const key = `smart-face-hi:${texW}x${texH}:` + JSON.stringify([product.id, product.name, product.kind, product.modules, product.channels, product.protocol]);
  if (kit.textures.has(key)) return kit.textures.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext("2d", { alpha: false });
  paintSmartFace(ctx, texW, texH, product);

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

/**
 * @param {*} kit
 * @param {object} product
 * @param {object[]} ports
 * @param {string} label
 */
export function buildSmartDevice(kit, product, ports = [], label = "") {
  const s = new pA();
  const w = Math.max(16, Number(product.width) || (Number(product.modules) || 2) * 18);
  const h = Math.max(70, Number(product.height) || 90);
  const d = Math.max(40, Number(product.depth) || 58);
  const body = KIND_BODY[product.kind] || "#3a4550";
  const accent = BRAND_ACCENT[product.brand] || product.color || "#7a8a9a";

  // 壳体
  kit.cube(s, w - 1.2, h - 3, d, 0, 0, d / 2 + 6, body, 1.35, 0.32);
  // 前脸凹槽底板（略矮，给横版贴图留准比例）
  const faceW = Math.max(12, w - 7);
  const faceH = Math.max(20, Math.min(h * 0.36, faceW * 0.32));
  kit.cube(s, faceW + 1.5, faceH + 3, 4.5, 0, h * 0.04, d + 8.5, "#1c222b", 0.7, 0.4);
  kit.cube(s, w - 5, 2.5, 1.8, 0, h * 0.04 + faceH / 2 + 3, d + 11, accent, 0.35, 0.18);

  const tex = makeFaceTexture(kit, product, faceW, faceH);
  const geo = kit.geometry(`smart-plane:${faceW},${faceH}`, () => new sr(faceW, faceH));
  const matKey = "smart-decal:" + (product.id || faceW);
  if (!kit.materials.has(matKey)) {
    kit.materials.set(
      matKey,
      new rr({ map: tex, transparent: false, depthWrite: true, toneMapped: false })
    );
  } else {
    kit.materials.get(matKey).map = tex;
  }
  const faceMesh = new Yt(geo, kit.materials.get(matKey));
  faceMesh.position.set(0, h * 0.04, d + 11.2);
  faceMesh.userData.dynamic = true;
  s.add(faceMesh);

  // 端子条
  kit.cube(s, w - 6, 5.5, 3.5, 0, h / 2 - 7, d + 4, "#151a20", 1, 0.45);
  kit.cube(s, w - 6, 5.5, 3.5, 0, -h / 2 + 7, d + 4, "#151a20", 1, 0.45);

  const ch = Math.min(8, Number(product.channels) || (product.kind === "psu" ? 1 : 2));
  let led = null;
  for (let i = 0; i < ch; i++) {
    const x = -w / 2 + 9 + i * Math.min(11, (w - 18) / Math.max(1, ch));
    const bulb = kit.cube(s, 2.8, 2.8, 1.4, x, -h * 0.28, d + 11.5, i === 0 ? "#2ecc71" : "#1a4a32", 0.2, 0.15);
    bulb.material = kit.own(
      new rA({
        color: i === 0 ? "#2ecc71" : "#1a4a32",
        emissive: i === 0 ? "#1a8f4a" : "#000000",
        emissiveIntensity: i === 0 ? 0.6 : 0,
        roughness: 0.3,
      })
    );
    bulb.userData.dynamic = true;
    if (!led) led = bulb;
  }
  if (!led) {
    led = kit.cube(s, 3.5, 2.8, 1.4, -w / 2 + 8, h * 0.22, d + 11.5, "#667b6d", 0.5);
    led.material = kit.own(new rA({ color: "#7d9382", emissive: "#000000", roughness: 0.3 }));
    led.userData.dynamic = true;
  }

  const toggle = kit.cube(s, Math.min(12, w * 0.16), 4.5, 3.5, w / 2 - 10, -h * 0.28, d + 11.5, "#4a5562", 1.1);
  toggle.userData.dynamic = true;

  for (const p of ports) {
    kit.cube(s, 5.5, 6.5, 2, p.x, p.y, p.z - 2, "#8a949c", 1);
    kit.screw(s, p.x, p.y, p.z, 2);
  }

  if (label) {
    kit.text(s, label, Math.max(w - 2, 28), 8, 0, -h / 2 - 10, 84, "#c5d0da", "#1a222c");
  }

  kit.batch(s);
  return { group: s, toggle, led };
}

export function isSmartVisual(product) {
  if (!product) return false;
  if (product.smart) return true;
  if (product.zone === "control") return true;
  return ["gateway", "relay", "dimmer", "psu", "meter", "contactor", "timer"].includes(product.kind);
}
