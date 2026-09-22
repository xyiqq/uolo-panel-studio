/**
 * 二维码 SVG（同步，依赖 qrcode MIT）
 */

import QRCode from "qrcode";

/**
 * @param {string} text
 * @param {number} [size=64]
 * @returns {string} SVG 字符串
 */
export function qrSvg(text, size = 64) {
  const payload = text == null ? "" : String(text);
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  const rects = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        rects.push(
          `<rect x="${(c * cell).toFixed(3)}" y="${(r * cell).toFixed(3)}" width="${cell.toFixed(3)}" height="${cell.toFixed(3)}"/>`,
        );
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#fff"/>` +
    `<g fill="#000">${rects.join("")}</g></svg>`
  );
}

/**
 * 当前二维码模式：labelRules.qrMode 选在线且填了基址才走在线，否则离线文本。
 * @param {object} design
 * @returns {"offline"|"online"}
 */
export function qrMode(design) {
  const wants = design?.labelRules?.qrMode === "online";
  return wants && design?.publicBaseUrl ? "online" : "offline";
}

/**
 * 回路二维码载荷
 * @param {object} design
 * @param {object} circuit
 * @param {"offline"|"online"} [mode]
 * @returns {string}
 */
export function circuitQrPayload(design, circuit, mode = "offline") {
  const m = mode === "online" ? "online" : "offline";
  if (m === "online") {
    const base = (design?.publicBaseUrl || "").replace(/\/$/, "");
    const designId = design?.designId || "";
    const cid = circuit?.id || "";
    if (!base) return "";
    return `${base}/d/${encodeURIComponent(designId)}?c=${encodeURIComponent(cid)}`;
  }

  const name = design?.name || "";
  const circuitId = circuit?.id || "";
  const circuitName = circuit?.name || "";
  const productName = circuit?.productName || "";
  const residual =
    circuit?.residual != null
      ? circuit.residual
      : circuit?.product?.residual != null
        ? circuit.product.residual
        : "";
  const phase = circuit?.phase || "";
  return `PDX1|${name}|${circuitId}|${circuitName}|${productName}|${residual}mA|${phase}`;
}

/**
 * 铭牌二维码载荷
 * @param {object} design
 * @param {"offline"|"online"} [mode]
 */
export function nameplateQrPayload(design, mode = "offline") {
  const m = mode === "online" ? "online" : "offline";
  if (m === "online") {
    const base = (design?.publicBaseUrl || "").replace(/\/$/, "");
    const designId = design?.designId || "";
    if (!base) return "";
    return `${base}/d/${encodeURIComponent(designId)}`;
  }
  const name = design?.name || "";
  const designId = design?.designId || "";
  const rev =
    design?.revisions?.length > 0
      ? design.revisions.length
      : design?.revision || "";
  const date = (design?.updatedAt || design?.createdAt || "").toString().slice(0, 10);
  return `PDX1|${name}|${designId}|${rev}|${date}`;
}
