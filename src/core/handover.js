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
      "对应出箱截面mm2", "线材", "用途", "连接状态", "回路", "过载保护A", "待核条件",
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
    ]),
  ];
}

/** BOM CSV 行 */
export function bomRows(bom) {
  const items = [
    ["类别", "订单号/规格", "名称", "品牌", "数量", "单位", "备注", "参考价"],
    ...(bom?.items || []).map((i) => [
      "器件/附件", i.sku, i.name, i.brand || "", i.qty, i.unit || "个", i.note || "",
      i.priceReference ?? "",
    ]),
    ...(bom?.wires || []).map((w) => [
      "线材", `${w.section} mm²`, w.color ? `${w.color}色导线` : "导线", "",
      w.meters != null ? Number(w.meters).toFixed(2) : "", "m", w.note || "", "",
    ]),
  ];
  return items;
}

/**
 * 组装 ZIP 文件表（纯文本部分）
 * @param {object} ctx { design, net, issues, bom, labels, pages, standaloneHtml }
 * @returns {Record<string,string>}
 */
export function buildHandoverFiles(ctx = {}) {
  const { design, net, issues = [], bom, labels, pages = [], standaloneHtml } = ctx;
  const simple = (design?.uiMode || "simple") === "simple";
  const files = {};

  files["README.txt"] = handoverReadme();
  files["方案.json"] = JSON.stringify(design, null, 2);
  const terminalConnections = terminalRows(design, id=>findProduct(design,id));
  if(terminalConnections.length) files['端子连接.csv']=terminalCsv(terminalConnections);
  files["通道清单.csv"] = channelRowsToCsv(
    buildChannelRows(design, (id) => findProduct(design, id)),
  );
  if (bom) files["物料清单.csv"] = toCsv(bomRows(bom));
  if (standaloneHtml) files["方案-独立HTML.html"] = standaloneHtml;

  if (!simple) {
    files["校核记录.json"] = JSON.stringify(
      { scope: "未签认的条件性计算", issues },
      null,
      2,
    );
    files["回路计算.csv"] = toCsv(circuitRows(design, issues));
    files["端子接线表.csv"] = toCsv(wireRows(net, labels));
  }

  pages.forEach((p, i) => {
    const idx = String(i + 1).padStart(2, "0");
    if (p.svg) files[`文档/${idx}-${p.id}.svg`] = p.svg;
    else if (p.html) files[`文档/${idx}-${p.id}.html`] = wrapHtml(p.title, p.html);
  });

  return files;
}

function wrapHtml(title, body) {
  return (
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">` +
    `<title>${String(title || "").replace(/</g, "&lt;")}</title></head>` +
    `<body>${body}</body></html>`
  );
}
