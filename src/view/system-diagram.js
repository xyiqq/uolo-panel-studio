/**
 * 配电系统图 SVG 生成器
 * A3 横 420×297 mm；超过 16 回路列自动分页。
 * 视觉 token 统一引用 svg-theme.js（颜色 / 字号 / 线宽 / 版面）。
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
import { computeBusBudgets } from "../core/buses.js";
import { circuitModuleChannels, moduleDeliveryLinks } from "./module-delivery-links.js";
import {
  C,
  FS,
  LW,
  LAYOUT,
  PHASE_COLORS,
  PHASE_DASH,
  FONT_STACK,
  DISCLAIMER,
  ellipsis,
} from "./svg-theme.js";

const PAGE_W = LAYOUT.pageW;
const PAGE_H = LAYOUT.pageH;
const COLS_PER_PAGE = LAYOUT.colsPerPage;
const COL_W = LAYOUT.colW;
const INLET_W = LAYOUT.inletW;
const MARGIN = LAYOUT.margin;

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
  body += `<text x="${x}" y="${y}" font-size="${FS.section}" font-weight="600" fill="${C.ink}">进线区</text>`;
  body += `<line x1="${x}" y1="${y + 2.2}" x2="${x + INLET_W - 6}" y2="${y + 2.2}" stroke="${C.line}" stroke-width="${LW.thin}"/>`;
  body += `<text x="${x}" y="${y + 7}" font-size="${FS.sub}" fill="${C.muted}">${esc(supply)} · In ${esc(mainAmps)}</text>`;
  body += `<text x="${x}" y="${y + 12}" font-size="${FS.sub}" fill="${C.muted}">Q0 ${esc(q0Name)}${q0Poles != null ? ` · ${q0Poles}P` : ""}${q0Amps != null ? ` / ${q0Amps}A` : ""}</text>`;
  if (q0) {
    body += `<g transform="translate(${x + 8},${y + 17})">${kindSymbol(q0.product.kind, q0.product.poles)}</g>`;
  }
  if (spdNode) {
    body += `<g transform="translate(${x + 30},${y + 17})">${spd()}</g>`;
    body += `<text x="${x + 26}" y="${y + 43}" font-size="${FS.name}" fill="${C.muted}">SPD ${esc(ellipsis(spdName, 16))}</text>`;
    if (qspd) {
      body += `<text x="${x + 26}" y="${y + 48}" font-size="${FS.name}" fill="${C.muted}">后备 ${esc(ellipsis(productSku(qspd.product), 14))}</text>`;
    }
  }
  body += `<text x="${x}" y="${y + 56}" font-size="${FS.foot}" fill="${C.faint}">接地系统 ${esc(design.earthing || "—")}</text>`;
  return body;
}

function renderBusbars(x, yTop, yBot) {
  const labels = [...PHASES, "N", "PE"];
  let body = "";
  labels.forEach((lab, i) => {
    const xx = x + i * 5;
    const dash = PHASE_DASH[lab] ? ` stroke-dasharray="${PHASE_DASH[lab]}"` : "";
    body += `<line x1="${xx}" y1="${yTop}" x2="${xx}" y2="${yBot}" stroke="${PHASE_COLORS[lab]}" stroke-width="${LW.bus}"${dash}/>`;
    body += `<text x="${xx}" y="${yTop - 2}" text-anchor="middle" font-size="${FS.bus}" font-weight="600" fill="${PHASE_COLORS[lab]}">${lab}</text>`;
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

  const tx = LAYOUT.colTextX;
  let body = `<g data-circuit="${esc(circuit.id)}" transform="translate(${x},${y})">`;
  body += `<rect x="0" y="0" width="${COL_W - 1.5}" height="${LAYOUT.colH}" fill="${C.card}" stroke="${C.line}" stroke-width="${LW.thin}"/>`;
  // 顶部：回路 id + 名称 + 分隔线
  body += `<text x="${tx}" y="5" font-size="${FS.id}" font-weight="600" fill="${C.ink}">${esc(circuit.id)}</text>`;
  body += `<text x="${tx}" y="9.6" font-size="${FS.name}" fill="${C.muted}">${esc(ellipsis(circuit.name || "", 9))}</text>`;
  body += `<line x1="${tx}" y1="11.6" x2="${COL_W - 2.5}" y2="11.6" stroke="${C.line}" stroke-width="${LW.thin}"/>`;

  let sy = LAYOUT.symY;
  body += `<g transform="translate(${LAYOUT.symX},${sy}) scale(0.85)">${kindSymbol(kind, poles)}</g>`;
  sy += 20;
  if (rcdNode && rcdNode.id !== node?.id) {
    body += `<g transform="translate(${LAYOUT.symX},${sy}) scale(0.75)">${rcd()}</g>`;
    sy += 18;
  }

  // 控制 / 计量模块（同回路附属节点）：虚线分组框 + Kx 短代号标注
  const mods = [];
  for (const n of assembly?.nodes || []) {
    if (!n.id.startsWith(circuit.id + "-")) continue;
    if (n.id.endsWith("-RCD")) continue;
    const k = n.product?.kind;
    if (
      ["contactor", "relay", "dimmer", "meter", "gateway", "psu"].includes(k)
    ) {
      mods.push(n);
    }
  }
  if (mods.length) {
    const boxTop = sy - 2;
    for (const n of mods) {
      body += `<g transform="translate(${LAYOUT.symX},${sy}) scale(0.7)">${kindSymbol(n.product.kind, 1)}</g>`;
      body += `<text x="1.5" y="${sy + 4}" font-size="${FS.tiny}" fill="${C.accent}">${esc(moduleTag(n.id))}</text>`;
      sy += 16;
    }
    body += `<rect x="0.6" y="${boxTop}" width="${COL_W - 2.7}" height="${sy - boxTop - 2}" fill="none" stroke="${C.accent}" stroke-width="${LW.thin}" stroke-dasharray="1.6 1.2" rx="1"/>`;
  }

  const sharedChannels = circuitModuleChannels(design, circuit);
  if (sharedChannels.length) {
    body += `<text x="${tx}" y="108" font-size="${FS.body}" fill="${C.accent}">${esc(ellipsis(sharedChannels.map(d => `${d.moduleId} CH${d.channel}`).join(' / '), 14))}</text>`;
    body += `<text x="${tx}" y="112" font-size="${FS.tiny}" fill="${C.faint}">完整关联见模块链路页</text>`;
  }

  // 参数区：标签:值 两色排版，行距统一为 colTextStep
  const ty = (i) => LAYOUT.colTextY0 + i * LAYOUT.colTextStep;
  const field = (i, label, value, valueFill = C.muted) =>
    `<text x="${tx}" y="${ty(i)}" font-size="${FS.body}">` +
    `<tspan fill="${C.faint}">${label} </tspan>` +
    `<tspan fill="${valueFill}">${esc(value)}</tspan></text>`;

  body += `<line x1="${tx}" y1="${ty(0) - 3.4}" x2="${COL_W - 2.5}" y2="${ty(0) - 3.4}" stroke="${C.line}" stroke-width="${LW.thin}"/>`;
  body += `<text x="${tx}" y="${ty(0)}" font-size="${FS.body}" fill="${C.muted}">${esc(ellipsis(sku, 13))}</text>`;
  body += field(
    1,
    "保护",
    [
      amps != null ? `In ${amps}A` : null,
      residual != null ? `Δn ${residual}mA` : null,
    ]
      .filter(Boolean)
      .join(" ") || "—",
  );
  body += field(2, "线缆", cable || (section != null ? `${section} mm²` : "—"));
  body += field(
    3,
    "相位",
    circuit.phase || "—",
    PHASE_COLORS[circuit.phase] || C.muted,
  );
  body += field(4, "区域", room ? ellipsis(room, 10) : "—");
  body += field(5, "Pe", p != null ? `${fmtNum(p / 1000, 2)} kW` : "—");
  body += field(6, "Ib", ib != null ? `${fmtNum(ib, 2)} A` : "—");
  body += `<text x="${tx}" y="${ty(7)}" font-size="${FS.tiny}" fill="${C.faint}">${esc(ellipsis((circuit.path || "").split("/")[0] || "", 14))}</text>`;
  body += `</g>`;
  return body;
}

/** 模块在系统图中的短代号（K1/K2…），避免与回路 id 混淆 */
function moduleTag(id) {
  const m = /-(\d+)$/.exec(String(id || ""));
  return m ? `K${m[1]}` : "K";
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

  // 两行栅格：左列标题/元信息，右列免责声明/页码，避免互撞
  return (
    `<rect x="0" y="0" width="${PAGE_W}" height="${LAYOUT.headerH}" fill="${C.headerBg}"/>` +
    `<rect x="0" y="${LAYOUT.headerH - 0.6}" width="${PAGE_W}" height="0.6" fill="${C.accent}" opacity="0.55"/>` +
    `<text x="${MARGIN}" y="6.2" font-size="${FS.title}" font-weight="700" fill="${C.ink}">系统图 · ${esc(ellipsis(name, 40))}</text>` +
    `<text x="${MARGIN}" y="12" font-size="${FS.sub}" fill="${C.muted}">编号 ${esc(idShort)} · ${esc(rev)} · ${esc(dateStr)} · 签认 ${esc(sign)}</text>` +
    `<text x="${PAGE_W - MARGIN}" y="6.2" text-anchor="end" font-size="${FS.sub}" fill="${C.danger}" font-weight="600">${esc(DISCLAIMER)}</text>` +
    `<text x="${PAGE_W - MARGIN}" y="12" text-anchor="end" font-size="${FS.sub}" fill="${C.muted}">第 ${pageIndex + 1} / ${pageCount} 页 · A3 横版</text>`
  );
}

function renderWatermark() {
  return (
    `<text x="${PAGE_W / 2}" y="${PAGE_H / 2}" text-anchor="middle" ` +
    `font-size="${FS.watermark}" fill="${C.watermark}" opacity="0.32" ` +
    `transform="rotate(-18 ${PAGE_W / 2} ${PAGE_H / 2})">${esc(DISCLAIMER)}</text>`
  );
}

function renderBusFooter(design, pageIndex, pageCount) {
  const buses = design?.buses || [];
  const left = !buses.length
    ? "总线：本方案未配置智能总线"
    : `总线：${buses.length} 条 · 预算及成员见模块链路页`;
  return (
    `<text x="${MARGIN}" y="${PAGE_H - 4}" font-size="${FS.foot}" fill="${C.faint}">${esc(left)}</text>` +
    `<text x="${PAGE_W / 2}" y="${PAGE_H - 4}" text-anchor="middle" font-size="${FS.foot}" fill="${C.danger}">${esc(DISCLAIMER)}</text>` +
    `<text x="${PAGE_W - MARGIN}" y="${PAGE_H - 4}" text-anchor="end" font-size="${FS.foot}" fill="${C.faint}">— ${pageIndex + 1}/${pageCount} —</text>`
  );
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
  const circuitPageCount = Math.max(1, Math.ceil(circuits.length / COLS_PER_PAGE) || 1);
  const links = moduleDeliveryLinks(design, net);
  const budgets = computeBusBudgets(design, (assembly?.nodes || []).map(n => n.product).filter(Boolean));
  for (const budget of budgets) {
    const bus = design.buses.find(b => b.id === budget.id);
    links.push({from:`总线 ${budget.label || budget.id} (${budget.type})`,to:`设备 ${(bus.deviceModuleIds || []).join(' / ') || '—'}`,
      kind:`电源 ${(bus.psuModuleIds || []).join(' / ') || '未配置'}`,
      detail:`预算 ${budget.usedKnown ? textOrDash(budget.used) : '待核'}/${budget.capacityKnown ? textOrDash(budget.capacity) : '待核'} ${budget.unit || ''} · ${budget.deviceCount} 台${budget.overBudget ? ' · 超预算' : ''}`});
  }
  // Wrap all identifiers instead of truncating them; variable-height rows paginate.
  const wrapped = value => String(value || '—').match(/.{1,34}/gu) || ['—'];
  const linkPages = [];
  let current = [], height = 0;
  for (const link of links) {
    const cells = [link.from,link.to,`${link.kind}\n${link.detail}`].map(v => String(v).split('\n').flatMap(wrapped));
    const lineCount = Math.max(...cells.map(c => c.length));
    for (let offset=0;offset<lineCount;offset+=48) {
      const part = cells.map(c => c.slice(offset,offset+48));
      const rowHeight = Math.max(...part.map(c => c.length)) * 4 + 6;
      if (current.length && height + rowHeight > 244) { linkPages.push(current); current = []; height = 0; }
      current.push({link,cells:part,height:rowHeight}); height += rowHeight;
    }
  }
  if (current.length) linkPages.push(current);
  const pageCount = circuitPageCount + linkPages.length;
  const pages = [];

  for (let pi = 0; pi < circuitPageCount; pi++) {
    const slice = circuits.slice(pi * COLS_PER_PAGE, (pi + 1) * COLS_PER_PAGE);
    const busX = MARGIN + INLET_W + 4;
    const colStartX = busX + 28;
    const colY = LAYOUT.colY;

    let content = "";
    content += renderTitleBar(design, pi, pageCount);
    content += renderWatermark();
    if (pi === 0) {
      content += renderInlet(design, assembly, MARGIN, 24);
    } else {
      content += `<text x="${MARGIN}" y="30" font-size="${FS.sub}" fill="${C.faint}">（续页）进线区见第 1 页</text>`;
    }
    content += renderBusbars(busX, LAYOUT.busTop, LAYOUT.busBot);

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
      // 母排到列的引线：浅色 L 型折线，避免与相线色彩混淆
      content +=
        `<path d="M${busX + 20} ${LAYOUT.busTop + 12 + (i % 5)} H${x + 8} V${colY}" ` +
        `fill="none" stroke="${C.line}" stroke-width="${LW.thin}"/>`;
    });

    content += renderBusFooter(design, pi, pageCount);

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" ` +
      `width="${PAGE_W}mm" height="${PAGE_H}mm" data-page="${pi + 1}" font-family="${FONT_STACK}">` +
      `<rect width="100%" height="100%" fill="${C.paper}"/>` +
      content +
      `</svg>`;
    pages.push(svg);
  }

  linkPages.forEach((rows, index) => {
    const pi = circuitPageCount + index;
    let content = renderTitleBar(design,pi,pageCount);
    content += `<text x="10" y="25" font-size="${FS.section}" fill="${C.ink}">模块链路 · 馈电 / 通道 / 接线端子 / 总线预算</text>`;
    let y = 32;
    for (const {link,cells,height} of rows) {
      content += `<g data-link-from="${esc(link.from)}" data-link-to="${esc(link.to)}"><rect x="10" y="${y}" width="400" height="${height}" fill="${C.card}" stroke="${C.line}" stroke-width="${LW.thin}"/>`;
      const mid = y + height / 2;
      content += `<path d="M105 ${mid} H138 M135 ${mid-1.5} L138 ${mid} L135 ${mid+1.5}" fill="none" stroke="${C.accent}" stroke-width="${LW.sym}"/>`;
      cells.forEach((lines,column) => lines.forEach((line,i) => {
        content += `<text x="${14 + column * 132}" y="${y + 5 + i * 4}" font-size="${FS.sub}" fill="${C.ink}">${esc(line)}</text>`;
      }));
      content += '</g>'; y += height;
    }
    content += renderBusFooter(design,pi,pageCount);
    pages.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}mm" height="${PAGE_H}mm" data-page="${pi+1}" font-family="${FONT_STACK}"><rect width="100%" height="100%" fill="${C.paper}"/>${content}</svg>`);
  });

  return { pages };
}
