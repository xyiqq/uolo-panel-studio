/**
 * 标签数据导出：P-touch Editor 数据库格式 + 面标 SVG（供 PNG 导出）
 * 列：label,line1,line2,qr
 * 面标视觉 token 与系统图同源（svg-theme.js）。
 */

import { esc } from "./_util.js";
import { circuitQrPayload, qrMode } from "../qr.js";
import { C, FONT_STACK, ellipsis } from "../svg-theme.js";

/**
 * @param {{ design?: object, assembly?: object, labels?: object, matches?: object }} ctx
 * @returns {string[][]} 首行为表头
 */
export function buildPtouchRows({ design, assembly, labels, matches } = {}) {
  const circuits = design?.circuits || [];
  const mode = qrMode(design);
  const rows = [["label", "line1", "line2", "qr"]];

  for (const c of circuits) {
    const node = (assembly?.nodes || []).find((n) => n.id === c.id);
    const face = labels?.faceLabel
      ? labels.faceLabel(node || { id: c.id, label: c.name })
      : c.id;
    const match = matches?.[c.id];
    const product = match?.product || node?.product;
    const amps = product?.amps != null ? `${product.amps}A` : "";
    const line2 = [c.phase || "", amps].filter(Boolean).join(" ");
    const payload = circuitQrPayload(
      design,
      {
        ...c,
        productName: product?.name || "",
        residual: product?.residual ?? null,
      },
      mode,
    );
    rows.push([String(face), String(c.name || ""), line2, payload]);
  }
  return rows;
}

/** CSV 文本（BOM + CRLF，Excel / P-touch 可直接打开） */
export function ptouchCsv(rows) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/**
 * 面标 SVG 拼版：18 mm 模位宽，用于 PNG 位图导出（标签机 / 打印店）
 * @param {{ design?: object, assembly?: object, labels?: object }} ctx
 * @param {{ columns?: number, labelHeightMm?: number }} [opts]
 * @returns {string} SVG 字符串
 */
export function renderFaceLabelsSvg({ design, assembly, labels } = {}, opts = {}) {
  const circuits = design?.circuits || [];
  const heightMm = opts.labelHeightMm || 12;
  const gapMm = 2;
  const sheetWidthMm = 190; // A4 可打印宽度
  const px = (mm) => +(mm * 3.7795).toFixed(2); // 96dpi

  let x = 0;
  let y = 0;
  let maxRight = 0;
  const cards = [];

  for (const c of circuits) {
    const node = (assembly?.nodes || []).find((n) => n.id === c.id);
    const modules = Math.max(1, Number(node?.product?.modules || 1));
    const wMm = modules * 18;
    if (x + wMm > sheetWidthMm && x > 0) {
      x = 0;
      y += heightMm + gapMm;
    }
    const face = labels?.faceLabel
      ? labels.faceLabel(node || { id: c.id, label: c.name })
      : c.id;
    const nameMax = Math.max(6, Math.floor(wMm / 1.9));
    const faceMax = Math.max(4, Math.floor(wMm / 2.4));
    cards.push(
      `<g transform="translate(${px(x)},${px(y)})" data-circuit="${esc(c.id)}">` +
        `<rect width="${px(wMm)}" height="${px(heightMm)}" fill="${C.card}" stroke="#a9b3aa" stroke-width="0.4" stroke-dasharray="1.4 1.4"/>` +
        `<rect width="${px(0.8)}" height="${px(heightMm)}" fill="${C.accent}" opacity="0.85"/>` +
        `<text x="${px(2)}" y="${px(4.4)}" font-family="${FONT_STACK}" font-size="${px(2.7)}" font-weight="700" fill="${C.ink}">${esc(ellipsis(face, faceMax))}</text>` +
        `<text x="${px(2)}" y="${px(8)}" font-family="${FONT_STACK}" font-size="${px(2.1)}" fill="#3c4440">${esc(ellipsis(c.name || "", nameMax))}</text>` +
        `<text x="${px(2)}" y="${px(11)}" font-family="${FONT_STACK}" font-size="${px(1.8)}" fill="${C.faint}">${esc(c.phase || "")}</text>` +
        `</g>`,
    );
    x += wMm + gapMm;
    maxRight = Math.max(maxRight, x);
  }

  const totalW = px(Math.max(maxRight, sheetWidthMm));
  const totalH = px(y + heightMm + gapMm);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" ` +
    `viewBox="0 0 ${totalW} ${totalH}" font-family="${FONT_STACK}">` +
    `<rect width="100%" height="100%" fill="${C.paper}"/>${cards.join("")}</svg>`
  );
}
