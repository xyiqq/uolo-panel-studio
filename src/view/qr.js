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
  const quiet = 4;
  const cell = size / (n + quiet * 2);
  const rects = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        rects.push(
          `<rect x="${((c + quiet) * cell).toFixed(3)}" y="${((r + quiet) * cell).toFixed(3)}" width="${cell.toFixed(3)}" height="${cell.toFixed(3)}"/>`,
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

/** External project-page contract. No text-code or local-storage fallback. */
export function projectQrUrl(design) {
  const value=String(design?.qrProjectUrl || '').trim();
  if(!value || value.length>1024)return '';
  try {
    const url=new URL(value),host=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||url.hash)return '';
    if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||!host.includes('.')||/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host))return '';
    return url.href;
  } catch {return '';}
}
export function qrMode(design) {
  return design?.labelRules?.qrMode==='online' && projectQrUrl(design) ? 'online' : 'disabled';
}
export function nameplateQrPayload(design,mode=qrMode(design)) {
  return mode==='online' ? projectQrUrl(design) : '';
}
export function circuitQrPayload(design,circuit,mode=qrMode(design)) {
  const base=nameplateQrPayload(design,mode);
  if(!base||!circuit?.id)return '';
  const url=new URL(base);url.searchParams.set('c',String(circuit.id));
  return url.href;
}
