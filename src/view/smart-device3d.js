/**
 * 智能/控制模块三维外观（参数化精绘）。
 * 面板纹理按真实贴图宽高比生成高分辨率横版，避免竖图画布被拉糊。
 */
import { paintModuleFace, moduleFaceSize, faceTextureSize } from "./module-face.js";
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
  paintModuleFace(ctx, W, H, product);
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** 文档用横版矢量 SVG（参数化示意，非厂家 CAD；白底打印友好） */
export function smartFaceSvg(product, width = 360, height = 100) {
  const name = product.name || product.id;
  const brand = product.brand || "";
  const accent = BRAND_ACCENT[brand] || product.color || "#5a7a8a";
  const mods = product.modules != null ? `${product.modules}M` : "—";
  const proto =
    (product.protocol || []).map((p) => String(p).toUpperCase()).join(" · ") ||
    "DIN";
  const kind = KIND_LABEL[product.kind] || product.kind || "";
  const uid = String(product.id || "x").replace(/[^a-zA-Z0-9_-]/g, "");
  const maxName = 22; // 超长型号省略，避免压到品牌区
  const nameTxt =
    String(name).length > maxName
      ? String(name).slice(0, maxName - 1) + "…"
      : String(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(brand)} ${escapeXml(nameTxt)}">
  <defs>
    <linearGradient id="bg-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#343c48"/><stop offset="100%" stop-color="#1a1f27"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="4" fill="#fdfdfc" stroke="#c9d2ca"/>
  <g transform="translate(6,7)">
    <rect width="${width - 12}" height="${height - 30}" rx="3" fill="url(#bg-${uid})" stroke="#0d1014" stroke-width="1"/>
    <rect width="${width - 12}" height="9" fill="${accent}"/>
    <rect width="5" height="${height - 30}" fill="${accent}" opacity="0.75"/>
    <text x="12" y="24" fill="#dce6f0" font-size="12" font-family="Arial,Microsoft YaHei,sans-serif" font-weight="600">${escapeXml(brand)}</text>
    <text x="${width - 20}" y="27" text-anchor="end" fill="#fff" font-size="17" font-family="Arial,Microsoft YaHei,sans-serif" font-weight="700">${escapeXml(nameTxt)}</text>
    <text x="12" y="44" fill="#8fa0b0" font-size="10" font-family="Arial,sans-serif">${escapeXml(kind)}</text>
    <text x="${width - 20}" y="44" text-anchor="end" fill="${accent}" font-size="11" font-family="Arial,sans-serif" font-weight="700">${escapeXml(proto)}</text>
    <text x="${width - 20}" y="${height - 40}" text-anchor="end" fill="#6a7a88" font-size="10" font-family="Consolas,monospace">${escapeXml(mods)}${product.width ? ` · ${product.width}×${product.height}×${product.depth} mm` : ""}</text>
  </g>
  <text x="8" y="${height - 6}" fill="#889" font-size="8" font-family="Microsoft YaHei,sans-serif">参数化示意 · 非厂家 CAD · 不得直接施工</text>
</svg>`;
}

function makeFaceTexture(kit, product, faceWmm, faceHmm) {
  const { width: texW, height: texH } = faceTextureSize(faceWmm, faceHmm);
  const key = `module-vector-v1:${texW}x${texH}:` + JSON.stringify(product);
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
  if (product.kind === "terminal") return buildTerminalDevice(kit, product, label);
  const w = Math.max(16, Number(product.width) || (Number(product.modules) || 2) * 18);
  const h = Math.max(70, Number(product.height) || 90);
  const d = Math.max(40, Number(product.depth) || 58);
  const body =
    product.kind === "terminal"
      ? product.terminalColor === "blue"
        ? "#2f6fbf"
        : "#8a8f96"
      : KIND_BODY[product.kind] || "#3a4550";
  const accent = BRAND_ACCENT[product.brand] || product.color || "#7a8a9a";

  // 壳体
  kit.cube(s, w - 1.2, h - 3, d, 0, 0, d / 2 + 6, body, 1.35, 0.32);
  // 前脸凹槽底板（略矮，给横版贴图留准比例）
  const { width: faceW, height: faceH } = moduleFaceSize({ ...product, width: w, height: h });
  kit.cube(s, faceW + 1.5, faceH + 3, 4.5, 0, h * 0.04, d + 8.5, "#1c222b", 0.7, 0.4);
  kit.cube(s, w - 5, 2.5, 1.8, 0, h * 0.04 + faceH / 2 + 3, d + 11, accent, 0.35, 0.18);

  const tex = makeFaceTexture(kit, product, faceW, faceH);
  const geo = kit.geometry(`smart-plane:${faceW},${faceH}`, () => new sr(faceW, faceH));
  const matKey = "smart-decal:" + tex.uuid;
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
  if(product.displayName){
    const noteW=w-8,noteH=7;
    const noteTex=makeFaceTexture(kit,{...product,faceRole:'module-note'},noteW,noteH);
    const note=new Yt(kit.geometry(`module-note:${noteW}`,()=>new sr(noteW,noteH)),kit.own(new rr({map:noteTex,toneMapped:false})));
    note.position.set(0,h*.405,d+11.3);
    s.add(note);
  }

  // 端子条
  kit.cube(s, w - 6, 5.5, 3.5, 0, h / 2 - 7, d + 4, "#151a20", 1, 0.45);
  kit.cube(s, w - 6, 5.5, 3.5, 0, -h / 2 + 7, d + 4, "#151a20", 1, 0.45);

  const ch = 1; // 仅保留仿真状态灯；通道外观已在矢量面板逐一绘制。
  let led = null;
  for (let i = 0; i < ch; i++) {
    const x = -w / 2 + Math.min(9, w * 0.3);
    const bulb = kit.cube(s, 2.8, 2.8, 1.4, x, -h * 0.36, d + 11.5, "#667b6d", 0.2, 0.15);
    bulb.material = kit.own(
      new rA({
        color: "#667b6d",
        emissive: "#000000",
        emissiveIntensity: 0,
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

  const toggle = kit.cube(s, Math.min(12, w * 0.16), 4.5, 3.5, w / 2 - Math.min(10, w * 0.3), -h * 0.36, d + 11.5, "#4a5562", 1.1);
  toggle.userData.dynamic = true;
  toggle.userData.onY = -h * 0.36;
  toggle.userData.offY = -h * 0.36 - 3;

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
  return ["gateway", "relay", "dimmer", "psu", "meter", "contactor", "timer", "terminal"].includes(product.kind);
}

/** 推入式端子使用真实目录宽高；不再套 70mm 高的智能网关壳。 */
function buildTerminalDevice(kit, product, label) {
  const group = new pA();
  const w = Number(product.width) || 5.2, h = Number(product.height) || 48.5, d = Number(product.depth) || 35.3;
  const count = Math.max(1, Math.min(48, Math.floor(Number(product.poles) || 1))), cell = w / count;
  const blue = product.terminalColor === "blue", body = blue ? "#397ba9" : "#8a9194";
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + cell * (i + 0.5);
    kit.cube(group, cell, h, d, x, 0, d / 2 + 6, body, 0.35);
    for (const side of [-1, 1]) {
      kit.cube(group, cell * 0.58, 6, 1, x, side * h * 0.29, d + 6.6, "#1c292f", 0.5);
      kit.cube(group, cell * 0.56, 4, 1.5, x, side * h * 0.13, d + 7, "#df9b58", 0.4);
    }
    const faceW = cell * 0.8, faceH = 9;
    const tex = makeFaceTexture(kit, { ...product, faceRole: "terminal-marker", marker: i + 1 }, faceW, faceH);
    kit.decal(group, tex, faceW, faceH, x, 0, d + 7.8);
  }
  if (label) kit.text(group, label, Math.max(w, 20), 6, 0, -h / 2 - 6, d + 8, "#dbe4e0", "#1c292f");
  kit.batch(group);
  return { group, toggle: null, led: null };
}
