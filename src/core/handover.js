/**
 * 交底包文件集（纯函数）
 * P3-4：独立 HTML、方案 JSON、系统图 SVG（各页）、标签 PNG、接线 CSV、
 *       回路 CSV、BOM CSV、校核 JSON、三维 PNG、README.txt
 * 口径：条件性方案 · 非施工合格结论
 */

import { matchCircuit, productSku, findProduct } from "./domain.js";
import { handoverReadme } from "./pack.js";
import { buildChannelRows, channelRowsToCsv } from "./modules.js";
import {terminalRows, terminalCsv} from './terminal-connections.js';
import {buildDeliveryNet} from './delivery-net.js';
import {buildBom} from './bom.js';
import {applyLabelRules} from './labels.js';
import {deliveryMetadata} from './revisions.js';
import {buildBomDelivery} from './bom-delivery.js';

/** CSV 文本（BOM + CRLF） */
export function toCsv(rows) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** 回路计算 CSV 行 */
export function circuitRows(design, issues = []) {
  return [
    [
      "回路", "名称", "源框架", "电压V", "相位", "已知负荷W", "功率因数",
      "Ib_A", "器件订单号", "In_A", "宽度mm", "Iz_A", "线缆", "压降初估百分比", "需核事项",
    ],
    ...(design.circuits || []).map((c) => {
      const m = matchCircuit(design, c);
      return [
        c.id, c.name, c.path, c.voltage, c.phase, m.p, c.pf,
        m.ib.toFixed(3), productSku(m.product), m.product.amps, m.product.width,
        m.iz.toFixed(2), m.cable, m.drop.toFixed(2),
        issues.filter((i) => i.circuit === c.id).map((i) => i.text).join("；"),
      ];
    }),
  ];
}

/** 接线表 CSV 行（含标签 tag 与线类） */
export function wireRows(net, labels) {
  return [
    [
      "起点", "起点标签", "终点", "终点标签", "导体", "线类", "线段截面mm2",
      "对应出箱截面mm2", "线材", "用途", "连接状态", "回路", "过载保护A", "待核条件", "线号", "长度类别",
    ],
    ...(net?.wires || []).map((w) => [
      w.from,
      labels?.terminalTag ? labels.terminalTag(w.from) : w.fromTag || "",
      w.to,
      labels?.terminalTag ? labels.terminalTag(w.to) : w.toTag || "",
      w.conductor,
      w.class || "power",
      w.section,
      w.externalSection || "",
      w.material,
      w.scope,
      w.connected ? "已连接" : "断开",
      w.circuit || "",
      w.protect || "",
      "短路、温升及现场条件仍待工程核验",
      w.wireNo || labels?.wireTag?.(w) || w.tag || '',
      w.lengthKind==='external'?'出箱':'箱内',
    ]),
  ];
}

/** BOM CSV 行 */
export function bomRows(bom, context = {}) {
  const delivery = buildBomDelivery(bom, context);
  const items = [
    ["类别", "通用名称", "数量", "单位", "用途 / 位置 / 待核事项"],
    ...delivery.items.map(i=>['设备/附件（按布置统计，实物选型待确认）',i.name,i.qty,i.unit,i.location]),
    ...delivery.wires.map(w=>['线材（估算待核）',w.name,w.qty??'待核',w.unit,w.location]),
  ];
  return items;
}

/**
 * 组装 ZIP 文件表（纯文本部分）
 * @param {object} ctx { design, net, issues, bom, labels, pages, standaloneHtml }
 * @returns {Record<string,string>}
 */
export function buildHandoverFiles(ctx = {}) {
  const deliveryNet=buildDeliveryNet(ctx.design,ctx.net?.assembly,ctx.net);
  ctx={...ctx,net:deliveryNet,labels:applyLabelRules(ctx.design,deliveryNet),bom:buildBom(ctx.design,deliveryNet.assembly,deliveryNet)};
  const { design, net, issues = [], bom, labels, pages = [], standaloneHtml } = ctx;
  const simple = (design?.uiMode || "simple") === "simple";
  const files = {};

  const metadata = deliveryMetadata(design);
  files["README.txt"] = `${handoverReadme()}\n\n方案：${metadata.name}\n方案 ID：${metadata.designId}\n版本：${metadata.revision}\n修订时间：${metadata.at}\n修订摘要：${metadata.summary}`;
  files['交付清单.json'] = JSON.stringify({ ...metadata, documents: pages.map(p => ({ id: p.id, title: p.title, pageSize: p.pageSize })) }, null, 2);
  files["方案.json"] = JSON.stringify(design, null, 2);
  const terminalConnections = terminalRows(design, id=>findProduct(design,id));
  if(terminalConnections.length) files['端子连接.csv']=terminalCsv(terminalConnections);
  files["通道清单.csv"] = channelRowsToCsv(
    buildChannelRows(design, (id) => findProduct(design, id)),
  );
  if (bom) files["物料清单.csv"] = toCsv(bomRows(bom,{assembly:deliveryNet.assembly,design}).map((row, index) => [...row, ...(index === 0 ? ['方案 ID', '方案版本', '修订时间'] : [metadata.designId, metadata.revision, metadata.at])]));
  if (standaloneHtml) files["方案-独立HTML.html"] = standaloneHtml;
  files["端子接线表.csv"] = toCsv(wireRows(net, labels));
  if(net.wiringIssues.length) files['配线待核事项.json']=JSON.stringify(net.wiringIssues,null,2);

  if (!simple) {
    files["校核记录.json"] = JSON.stringify(
      { scope: "未签认的条件性计算", issues },
      null,
      2,
    );
    files["回路计算.csv"] = toCsv(circuitRows(design, issues));
  }

  pages.forEach((p, i) => {
    if (p.metadata && (p.metadata.revision !== metadata.revision || p.metadata.at !== metadata.at || p.metadata.designId !== metadata.designId)) {
      throw new Error('文档版本已过期，请重新生成文档后导出交底包');
    }
    const idx = String(i + 1).padStart(2, "0");
    if (p.svg) files[`文档/${idx}-${p.id}.svg`] = p.svg;
    else if (p.html) files[`文档/${idx}-${p.id}.html`] = wrapHtml(p.title, p.html, p.pageSize, ctx.documentCss);
  });

  return files;
}

function wrapHtml(title, body, size = 'A4', css = '') {
  const escape = value => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  return (
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">` +
    `<title>${escape(title)}</title><style>${String(css).replace(/<\/style/gi, '<\\/style')}</style></head>` +
    `<body><div id="v5-print-root"><section class="v5-doc-sheet print-sheet page-${escape(size)}" data-size="${escape(size)}">${body}</section></div></body></html>`
  );
}
