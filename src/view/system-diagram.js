/**
 * 配电系统图 SVG 生成器
 * A3 横 420×297 mm；超过 16 回路列自动分页。
 * 口径：条件性方案 · 非施工合格结论
 */

import {
  breaker,
  rcd,
  rcbo,
  spd,
  isolator,
  contactor,
  relay,
  dimmer,
  meter,
  pe as peSym,
  gateway,
  psu,
} from "./symbols.js";
import { productSku, PHASES } from "../core/domain.js";

const PAGE_W = 420;
const PAGE_H = 297;
const COLS_PER_PAGE = 16;
const COL_W = 20;
const INLET_W = 60;
const MARGIN = 10;
const DISCLAIMER = "条件性方案 · 非施工合格结论";

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textOrDash(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

function fmtNum(v, digits = 2) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

function kindSymbol(kind, poles) {
  switch (kind) {
    case "mcb":
      return breaker(poles);
    case "rccb":
      return rcd();
    case "rcbo":
      return rcbo();
    case "spd":
      return spd();
    case "isolator":
    case "iso":
      return isolator();
    case "contactor":
      return contactor();
    case "relay":
      return relay();
    case "dimmer":
      return dimmer();
    case "meter":
    case "kwh":
      return meter();
    case "gateway":
      return gateway();
    case "psu":
      return psu();
    default:
      return breaker(poles || 1);
  }
}

function findNode(assembly, id) {
  return (assembly?.nodes || []).find((n) => n.id === id) || null;
}

function circuitRoom(design, circuit) {
  const loads = (design.loads || []).filter((l) =>
    (circuit.loadIds || []).includes(l.id),
  );
  const rooms = [...new Set(loads.map((l) => l.room).filter(Boolean))];
  return rooms[0] || "";
}

function renderInlet(design, assembly, x, y) {
  const q0 = findNode(assembly, "Q0");
  const spdNode = findNode(assembly, "SPD");
  const qspd = findNode(assembly, "QSPD");
  const supply =
    design.supply === "three" ? "三相 380/220 V" : "单相 220 V";
  const mainAmps = design.mainAmps != null ? `${design.mainAmps} A` : "—";
  const q0Name = q0 ? productSku(q0.product) : "—";
  const q0Poles = q0?.product?.poles;
  const q0Amps = q0?.product?.amps;
  const spdName = spdNode ? productSku(spdNode.product) : "";

  let body = "";
  body += `<text x="${x}" y="${y}" font-size="3.2" font-weight="600" fill="#1a1a1a">进线区</text>`;
  body += `<text x="${x}" y="${y + 6}" font-size="2.4" fill="#445">${esc(supply)} · In ${esc(mainAmps)}</text>`;
  body += `<text x="${x}" y="${y + 11}" font-size="2.2" fill="#445">Q0 ${esc(q0Name)}${q0Poles != null ? ` · ${q0Poles}P` : ""}${q0Amps != null ? ` / ${q0Amps}A` : ""}</text>`;
  if (q0) {
    body += `<g transform="translate(${x + 8},${y + 16})">${kindSymbol(q0.product.kind, q0.product.poles)}</g>`;
  }
  if (spdNode) {
    body += `<g transform="translate(${x + 28},${y + 16})">${spd()}</g>`;
    body += `<text x="${x}" y="${y + 42}" font-size="2.1" fill="#445">SPD ${esc(spdName)}</text>`;
    if (qspd) {
      body += `<text x="${x}" y="${y + 47}" font-size="2.1" fill="#445">后备 ${esc(productSku(qspd.product))}</text>`;
    }
  }
  body += `<text x="${x}" y="${y + 54}" font-size="2" fill="#666">接地系统 ${esc(design.earthing || "—")}</text>`;
  return body;
}

function renderBusbars(x, yTop, yBot) {
  const labels = [...PHASES, "N", "PE"];
  const colors = {
    L1: "#d9aa30",
    L2: "#27925d",
    L3: "#d9574f",
    N: "#429cdd",
    PE: "#afc143",
  };
  let body = "";
  labels.forEach((lab, i) => {
    const xx = x + i * 5;
    body += `<line x1="${xx}" y1="${yTop}" x2="${xx}" y2="${yBot}" stroke="${colors[lab]}" stroke-width="0.7"/>`;
    body += `<text x="${xx}" y="${yTop - 2}" text-anchor="middle" font-size="2.2" fill="${colors[lab]}">${lab}</text>`;
  });
  body += `<g transform="translate(${x - 2},${yBot + 2}) scale(0.7)">${peSym()}</g>`;
  return body;
}

function renderCircuitColumn(design, assembly, circuit, match, x, y) {
  const node =
    findNode(assembly, circuit.id) ||
    findNode(assembly, `${circuit.id}-RCD`);
  const rcdNode = findNode(assembly, `${circuit.id}-RCD`);
  const product = node?.product;
  const kind = product?.kind || "mcb";
  const poles = product?.poles || 1;
  const sku = product ? productSku(product) : "—";
  const amps = product?.amps;
  const residual = product?.residual;
  const room = circuitRoom(design, circuit);
  const ib = match?.ib;
  const p = match?.p;
  const cable = match?.cable;
  const section = match?.section;

  let body = `<g data-circuit="${esc(circuit.id)}" transform="translate(${x},${y})">`;
  body += `<rect x="0" y="0" width="${COL_W - 1.5}" height="200" fill="#fafcfa" stroke="#d5ded6" stroke-width="0.25"/>`;
  body += `<text x="1" y="5" font-size="2.6" font-weight="600" fill="#1a1a1a">${esc(circuit.id)}</text>`;
  body += `<text x="1" y="10" font-size="2.1" fill="#333">${esc((circuit.name || "").slice(0, 10))}</text>`;

  let sy = 14;
  body += `<g transform="translate(8,${sy}) scale(0.85)">${kindSymbol(kind, poles)}</g>`;
  sy += 20;
  if (rcdNode && rcdNode.id !== node?.id) {
    body += `<g transform="translate(8,${sy}) scale(0.75)">${rcd()}</g>`;
    sy += 18;
  }

  // 控制 / 计量模块（若装配中存在同回路附属节点）
  for (const n of assembly?.nodes || []) {
    if (!n.id.startsWith(circuit.id + "-")) continue;
    if (n.id.endsWith("-RCD")) continue;
    const k = n.product?.kind;
    if (["contactor", "relay", "dimmer", "meter", "gateway", "psu"].includes(k)) {
      body += `<g transform="translate(8,${sy}) scale(0.7)">${kindSymbol(k, 1)}</g>`;
      sy += 16;
    }
  }

  body += `<text x="1" y="118" font-size="1.9" fill="#444">${esc(sku.slice(0, 14))}</text>`;
  const inLine = [
    amps != null ? `In ${amps}A` : null,
    residual != null ? `Δn ${residual}mA` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  body += `<text x="1" y="123" font-size="1.8" fill="#555">${esc(inLine || "—")}</text>`;
  body += `<text x="1" y="129" font-size="1.7" fill="#555">${esc(cable || (section != null ? `${section} mm²` : "—"))}</text>`;
  body += `<text x="1" y="136" font-size="1.8" fill="#555">相 ${esc(circuit.phase || "—")}</text>`;
  body += `<text x="1" y="142" font-size="1.7" fill="#555">${esc(room.slice(0, 12) || "—")}</text>`;
  body += `<text x="1" y="149" font-size="1.7" fill="#555">Pe ${esc(p != null ? fmtNum(p / 1000, 2) + " kW" : "—")}</text>`;
  body += `<text x="1" y="155" font-size="1.7" fill="#555">Ib ${esc(ib != null ? fmtNum(ib, 2) + " A" : "—")}</text>`;
  body += `<text x="1" y="162" font-size="1.6" fill="#777">${esc((circuit.path || "").split("/")[0] || "")}</text>`;
  body += `</g>`;
  return body;
}

function renderTitleBar(design, pageIndex, pageCount) {
  const name = textOrDash(design?.name);
  const idRaw = design?.designId;
  const idShort =
    idRaw && String(idRaw).length >= 8
      ? String(idRaw).slice(0, 8)
      : idRaw
        ? String(idRaw)
        : "—";
  const rev =
    design?.revisions?.length != null && design.revisions.length > 0
      ? `Rev ${design.revisions.length}`
      : design?.revision
        ? `Rev ${design.revision}`
        : "—";
  const date = design?.updatedAt || design?.createdAt || "";
  const dateStr = date ? String(date).slice(0, 10) : "—";
  const sign =
    design?.signoff?.designer?.name ||
    design?.signoff?.reviewer?.name ||
    "未签认";

  return (
    `<rect x="0" y="0" width="${PAGE_W}" height="14" fill="#eef3ee"/>` +
    `<text x="${MARGIN}" y="6.5" font-size="3.6" font-weight="700" fill="#1a1a1a">系统图 · ${esc(name)}</text>` +
    `<text x="${MARGIN}" y="11.5" font-size="2.2" fill="#456">${esc(idShort)} · ${esc(rev)} · ${esc(dateStr)} · 签认 ${esc(sign)} · 第 ${pageIndex + 1}/${pageCount} 页</text>` +
    `<text x="${PAGE_W - MARGIN}" y="9" text-anchor="end" font-size="3" fill="#a33" font-weight="600">${esc(DISCLAIMER)}</text>`
  );
}

function renderWatermark() {
  return (
    `<text x="${PAGE_W / 2}" y="${PAGE_H / 2}" text-anchor="middle" ` +
    `font-size="14" fill="#c9d2c9" opacity="0.45" ` +
    `transform="rotate(-18 ${PAGE_W / 2} ${PAGE_H / 2})">${esc(DISCLAIMER)}</text>`
  );
}

function renderBusFooter(design) {
  const buses = design?.buses || [];
  if (!buses.length) {
    return `<text x="${MARGIN}" y="${PAGE_H - 6}" font-size="2" fill="#888">总线：本方案未配置智能总线</text>`;
  }
  const parts = buses.map((b) => {
    const used = b.used != null ? b.used : "—";
    const cap = b.capacity != null ? b.capacity : "—";
    return `${b.type || b.id || "总线"} 电源 ${b.power || "—"} 预算 ${used}/${cap}`;
  });
  return `<text x="${MARGIN}" y="${PAGE_H - 6}" font-size="2" fill="#666">总线：${esc(parts.join(" · "))}</text>`;
}

/**
 * @param {object} design
 * @param {object} assembly
 * @param {object} net
 * @param {Record<string, object>} [matches]
 * @returns {{ pages: string[] }}
 */
export function renderSystemDiagram(design, assembly, net, matches) {
  const matchMap = matches && typeof matches === "object" ? matches : {};
  const circuits = design?.circuits || [];
  const pageCount = Math.max(1, Math.ceil(circuits.length / COLS_PER_PAGE) || 1);
  const pages = [];

  for (let pi = 0; pi < pageCount; pi++) {
    const slice = circuits.slice(pi * COLS_PER_PAGE, (pi + 1) * COLS_PER_PAGE);
    const busX = MARGIN + INLET_W + 4;
    const colStartX = busX + 28;
    const colY = 22;

    let content = "";
    content += renderTitleBar(design, pi, pageCount);
    content += renderWatermark();
    if (pi === 0) {
      content += renderInlet(design, assembly, MARGIN, 24);
    } else {
      content += `<text x="${MARGIN}" y="30" font-size="2.4" fill="#666">（续页）进线区见第 1 页</text>`;
    }
    content += renderBusbars(busX, 28, 230);

    slice.forEach((c, i) => {
      const x = colStartX + i * COL_W;
      content += renderCircuitColumn(
        design,
        assembly,
        c,
        matchMap[c.id],
        x,
        colY,
      );
      // 母排到列的引线
      content += `<line x1="${busX + 20}" y1="${40 + (i % 5)}" x2="${x + 8}" y2="${colY + 14}" stroke="#999" stroke-width="0.25"/>`;
    });

    content += renderBusFooter(design);
    // net 仅用于潜在扩展；避免 unused 警告式引用
    void net;

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" ` +
      `width="${PAGE_W}mm" height="${PAGE_H}mm" data-page="${pi + 1}">` +
      `<rect width="100%" height="100%" fill="#fff"/>` +
      content +
      `</svg>`;
    pages.push(svg);
  }

  return { pages };
}
