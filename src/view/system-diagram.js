/**
 * 配电系统图 SVG 生成器
 * A4 纵向内容版心；每行两个回路，按文字高度自动分页。
 * 颜色与字体栈统一引用 svg-theme.js；正文保持可读的固定字号。
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
  gateway,
  psu,
} from "./symbols.js";
import { productSku } from "../core/domain.js";
import { escapeHtml } from "../core/escape.js";
import { computeBusBudgets } from "../core/buses.js";
import { circuitModuleChannels, moduleDeliveryLinks } from "./module-delivery-links.js";
import {
  C,
  PHASE_COLORS,
  PHASE_DASH,
  FONT_STACK,
  DISCLAIMER,
} from "./svg-theme.js";

const PAGE_W = 210;
const PAGE_H = 270;
const BODY_SIZE = 3.5;
const LINE_HEIGHT = 4.8;

const esc = escapeHtml;

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

// Width is measured in mm-like SVG units; Chinese characters occupy a full em.
// Keeping the same font size across lines avoids shrinking long identifiers.
function wrapText(value, width, size = BODY_SIZE) {
  const lines = [];
  for (const paragraph of String(value ?? '—').split('\n')) {
    let line = '', used = 0;
    for (const character of paragraph) {
      const advance = /[\u0000-\u007f]/.test(character) ? size * .61 : size;
      if (line && used + advance > width) { lines.push(line); line = ''; used = 0; }
      line += character; used += advance;
    }
    lines.push(line || '—');
  }
  return lines;
}

function textLines(lines, x, y, { size = BODY_SIZE, fill = C.ink, weight = 400 } = {}) {
  return lines.map((line, i) => `<text x="${x}" y="${y + i * LINE_HEIGHT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(line)}</text>`).join('');
}

function pageFrame(design, content, index, total) {
  const title = wrapText(`配电连接关系示意 · ${design.name || '未命名方案'}`, 184, 4).slice(0, 2);
  const rev = `Rev ${design.revisions?.length || 0}`;
  const stamp = `${rev} · ${String(design.updatedAt || design.createdAt || '日期未记录').slice(0, 10)} · 签认 ${design.signoff?.designer?.name || design.signoff?.reviewer?.name || '未签认'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}mm" height="${PAGE_H}mm" data-page="${index + 1}" role="img" aria-label="配电系统图，第 ${index + 1} 页" font-family="${FONT_STACK}">
    <rect width="100%" height="100%" fill="${C.paper}"/>
    <rect x="10" y="5" width="190" height="24" rx="2" fill="${C.headerBg}"/>
    ${textLines(title, 13, 12, {size:4, weight:700})}
    ${textLines(wrapText(stamp, 180, 2.8).slice(0,2), 13, 22, {size:2.8, fill:C.muted})}
    ${content}
    <line x1="10" y1="258" x2="200" y2="258" stroke="${C.line}" stroke-width=".3"/>
    <text x="10" y="264" font-size="2.8" fill="${C.danger}">${esc(DISCLAIMER)}</text>
    <text x="200" y="264" text-anchor="end" font-size="2.8" fill="${C.muted}">第 ${index + 1} / ${total} 页 · A4 纵版</text>
  </svg>`;
}

function circuitCard(design, assembly, circuit, match = {}, net = {}) {
  const node = findNode(assembly, circuit.id) || findNode(assembly, `${circuit.id}-RCD`);
  const product = node?.product;
  const channels = circuitModuleChannels(design, circuit);
  const associated = (assembly?.nodes || []).filter(n => n.id.startsWith(`${circuit.id}-`) && n.id !== node?.id);
  const protection = [product?.amps != null ? `额定 ${product.amps} A` : '额定电流待核', product?.residual != null ? `漏电 ${product.residual} mA` : ''].filter(Boolean).join(' / ');
  const wires = (net?.wires || []).filter(w => w.circuit === circuit.id ||
    [w.from,w.to].some(port => String(port || '').startsWith(`${circuit.id}:`) || String(port || '').startsWith(`${circuit.id}-RCD:`) || String(port || '').startsWith(`X-${circuit.id}:`)));
  const connections = wires.map(w => `${w.conductor === 'N' ? '零线 N' : w.conductor === 'PE' ? '地线 PE' : w.conductor ? `火线 ${w.conductor}` : w.scope || '连接'}：${w.from} → ${w.to}${w.connected === false ? '（断开）' : w.connected !== true ? '（状态待核）' : ''}`);
  const fields = [
    ['接线', connections.length ? connections.join('\n') : '未生成接线，来源与去向待核'],
    ['型号', product ? productSku(product) : '未选设备'],
    ['保护', protection],
    ['线缆', match.cable || (match.section != null ? `${match.section} mm²` : '待确认')],
    ['供电', `${circuit.phase || '相位待确认'} · ${circuitRoom(design, circuit) || '区域未填写'}`],
    ['负载', `${match.p != null ? `${fmtNum(match.p / 1000)} kW` : '功率待核'} / ${match.ib != null ? `${fmtNum(match.ib)} A` : '工作电流待核'}`],
    ...(associated.length ? [['附属', associated.map(n => `${n.id} ${productSku(n.product)}`).join(' / ')]] : []),
    ...(channels.length ? [['控制', channels.map(c => `${c.moduleId} CH${c.channel}`).join(' / ')]] : []),
    ...(circuit.path ? [['路径', circuit.path]] : []),
  ];
  const heading = wrapText(`${circuit.id} · ${circuit.name || '未命名回路'}`, 84, 3.5);
  const lines = fields.flatMap(([label, value]) => wrapText(`${label}：${value}`, 65));
  return {circuit, product, heading, lines, height:Math.max(95, 12 + heading.length * LINE_HEIGHT + lines.length * LINE_HEIGHT)};
}

function drawCard(card, x, y) {
  const titleHeight = 6 + card.heading.length * LINE_HEIGHT;
  let content = `<g data-circuit="${esc(card.circuit.id)}"><title>${esc(card.circuit.name || card.circuit.id)}</title>
    <rect x="${x}" y="${y}" width="92" height="${card.height}" rx="2" fill="${C.card}" stroke="${C.line}" stroke-width=".3"/>
    ${textLines(card.heading, x + 4, y + 6, {size:3.5,weight:600})}
    <line x1="${x + 4}" y1="${y + titleHeight}" x2="${x + 88}" y2="${y + titleHeight}" stroke="${C.line}" stroke-width=".3"/>
    ${textLines(card.lines, x + 23, y + titleHeight + 6)}
    ${card.product ? `<g transform="translate(${x + 9},${y + titleHeight + 6}) scale(.8)">${kindSymbol(card.product.kind, card.product.poles || 1)}</g>` : ''}`;
  content += `<text x="${x + 4}" y="${y + titleHeight + 30}" font-size="2.8" fill="${C.muted}">${card.product ? '保护器' : '待选型'}</text></g>`;
  return content;
}

/** A4 portrait SVG pages, ready to place within the document's print margins. */
export function renderSystemDiagram(design = {}, assembly, net, matches = {}) {
  const bodies = [];
  const intro = textLines(['怎么看：箭头由起点指向终点，按编号查找保护器、模块或出箱端子。', 'N = 零线；PE = 保护地线；CH = 通道。本页为关系示意，非标准电气原理图。'], 10, 36, {size:2.9,fill:C.muted});
  const q0 = findNode(assembly, 'Q0');
  const supply = `${design.supply === 'three' ? '三相 380/220 V' : '单相 220 V'} · 总开关 ${q0?.product?.amps ?? design.mainAmps ?? '待核'} A · 接地 ${design.earthing || '待核'}`;
  const cards = (design.circuits || []).map(c => circuitCard(design, assembly, c, matches?.[c.id], net));
  // Split an exceptionally long card without shrinking text or dropping fields.
  const segments = cards.flatMap(card => {
    const parts = [];
    const allLines = [...card.heading.slice(2), ...card.lines];
    for (let offset = 0; offset < Math.max(1, allLines.length); offset += 35) {
      const lines = allLines.slice(offset, offset + 35);
      parts.push({...card, heading:offset ? [`${card.circuit.id} · 续页`] : card.heading.slice(0,2), lines,
        height:Math.max(95, 12 + Math.min(2, card.heading.length) * LINE_HEIGHT + lines.length * LINE_HEIGHT)});
    }
    return parts;
  });
  let content = intro + textLines([supply], 10, 48, {size:3.1}), y = 55;
  for (let index = 0; index < segments.length; index += 2) {
    const row = segments.slice(index, index + 2);
    const height = Math.max(...row.map(card => card.height));
    if (y + height > 253) { bodies.push(content); content = intro + textLines([supply], 10, 48, {size:3.1}); y = 55; }
    row.forEach((card, column) => { content += drawCard(card, 10 + column * 98, y); });
    y += height + 5;
  }
  if (!cards.length) content += textLines(['尚未配置供电回路；如已配置智能模块，请继续查看后续连接关系页。'],10,62,{fill:C.muted});
  // Text and dash patterns make the phase key understandable in grayscale printing.
  ['L1','L2','L3','N','PE'].forEach((phase,index) => {
    const x=10+index*37;
    content += `<line x1="${x}" x2="${x+8}" y1="254" y2="254" stroke="${PHASE_COLORS[phase]}" stroke-width=".6"${PHASE_DASH[phase] ? ` stroke-dasharray="${PHASE_DASH[phase]}"` : ''}/><text x="${x+10}" y="255" font-size="2.8" fill="${C.muted}">${phase}</text>`;
  });
  bodies.push(content);

  const links = moduleDeliveryLinks(design, net);
  const recordedLinks = new Set(links.map(link => `${link.from}>${link.to}`));
  // Include upstream supply, surge protection and enclosure earth connections;
  // the circuit cards alone only show the wires assigned to each branch.
  for (const wire of net?.wires || []) {
    if (wire.circuit || recordedLinks.has(`${wire.from}>${wire.to}`)) continue;
    links.push({from:wire.from,to:wire.to,kind:wire.scope || '公共供电连接',
      detail:[wire.conductor,wire.section != null ? `${wire.section}${typeof wire.section === 'number' ? ' mm²' : ''}` : '线径待核',wire.connected === false ? '断开' : wire.connected === true ? '方案已连接' : '连接状态待核'].filter(Boolean).join(' · ')});
  }
  for (const budget of computeBusBudgets(design, (assembly?.nodes || []).map(n => n.product).filter(Boolean))) {
    const bus = design.buses.find(b => b.id === budget.id);
    links.push({from:`总线 ${budget.label || budget.id} (${budget.type})`,to:`设备 ${(bus.deviceModuleIds || []).join(' / ') || '—'}`,
      kind:`电源 ${(bus.psuModuleIds || []).join(' / ') || '未配置'}`,
      detail:`预算 ${budget.usedKnown ? textOrDash(budget.used) : '待核'}/${budget.capacityKnown ? textOrDash(budget.capacity) : '待核'} ${budget.unit || ''} · ${budget.deviceCount} 台${budget.overBudget ? ' · 超预算' : ''}`});
  }
  const linkHeader = textLines(['电源与模块连接关系 · 对照编号找到设备与端口'], 10, 36, {size:3.6,weight:600})
    + textLines(['从左向右阅读：起点 → 终点；“待核”表示尚需确认，不能视为已接通。'],10,43,{size:2.9,fill:C.muted})
    + `<rect x="10" y="47" width="190" height="8" fill="${C.headerBg}"/>`
    + ['起点（从哪里来）','终点（接到哪里）','连接用途 / 核对信息'].map((title,i)=>textLines([title],[13,66,119][i],52,{size:3,weight:600})).join('');
  content = linkHeader; y = 55;
  for (const link of links) {
    const cells = [link.from,link.to,`${link.kind}\n${link.detail}`].map((v,i)=>wrapText(v,[47,47,77][i]));
    const count = Math.max(...cells.map(lines => lines.length));
    for (let offset=0;offset<count;offset+=39) {
      const part = cells.map(lines => lines.slice(offset,offset+39));
      const height = Math.max(...part.map(lines => lines.length)) * LINE_HEIGHT + 6;
      if (y + height > 253) { bodies.push(content); content = linkHeader; y = 55; }
      content += `<g data-link-from="${esc(link.from)}" data-link-to="${esc(link.to)}"><rect x="10" y="${y}" width="190" height="${height}" fill="${C.card}" stroke="${C.line}" stroke-width=".25"/>`;
      part.forEach((lines,i)=>{ content += textLines(lines,[13,66,119][i],y+5); });
      content += '</g>'; y += height;
    }
  }
  if (links.length) bodies.push(content);
  return {pages:bodies.map((body,index)=>pageFrame(design,body,index,bodies.length))};

}
