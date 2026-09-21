/**
 * 文档中心汇总
 * ctx = { design, assembly, net, issues, matches, bom, labels, uiMode, findProduct }
 */

import { renderCover } from "./cover.js";
import { renderCircuitTable } from "./circuit-table.js";
import { renderDoorChart } from "./door-chart.js";
import { renderLabelsSheet } from "./labels-sheet.js";
import { renderWireTags } from "./wire-tags.js";
import { renderNameplate } from "./nameplate.js";
import { renderWiringTable } from "./wiring-table.js";
import { renderChecklist } from "./checklist.js";
import { renderAuditList } from "./audit-list.js";
import { renderBomPage } from "./bom-page.js";
import { renderChannelList } from "./channel-list.js";
import { renderSystemDiagram } from "../system-diagram.js";
import { renderSmartModuleFaces } from "./smart-faces.js";
import { findProduct as domainFindProduct } from "../../core/domain.js";
import {terminalRows} from '../../core/terminal-connections.js';
import {terminalConnectionSvg} from '../terminal-connections.js';
import {buildDeliveryNet} from '../../core/delivery-net.js';
import {buildBom} from '../../core/bom.js';
import {applyLabelRules} from '../../core/labels.js';

/** 简易布置默认文档页 */
export const SIMPLE_DOC_PAGE_IDS = new Set([
  "cover",
  "nameplate",
  "labels-sheet",
  "channel-list",
  "bom",
  "wiring-table",
  "wire-tags",
  "door-chart",
]);

/**
 * @param {object} ctx
 * @returns {{ pages: { id: string, title: string, html?: string, svg?: string, pageSize: string }[] }}
 */
export function buildDocumentPack(ctx = {}) {
  const deliveryNet=buildDeliveryNet(ctx.design,ctx.assembly,ctx.net);
  ctx={...ctx,net:deliveryNet,bom:buildBom(ctx.design,ctx.assembly,deliveryNet),labels:applyLabelRules(ctx.design,deliveryNet)};
  const {
    design,
    assembly,
    net,
    issues = [],
    matches = {},
    bom,
    labels,
    interactive = false,
    uiMode,
    findProduct,
  } = ctx;

  const resolver = findProduct || ((id) => domainFindProduct(design, id));
  const pages = [];
  const connections = terminalRows(design || {}, resolver).filter(r=>r.loadName || r.output);
  for(let i=0;i<connections.length;i+=8) pages.push({
    id:`terminal-connections-${i/8+1}`, title:`端子连接 · 第 ${i/8+1} 页`,
    svg:terminalConnectionSvg(connections.slice(i,i+8)), pageSize:'A4-landscape',
  });

  pages.push({
    id: "cover",
    title: "封面",
    html: renderCover({ design, assembly }),
    pageSize: "A4",
  });

  const diagram = renderSystemDiagram(design, assembly, net, matches);
  (diagram.pages || []).forEach((svg, i) => {
    pages.push({
      id: `system-diagram-${i + 1}`,
      title: `系统图 · 第 ${i + 1} 页`,
      svg,
      pageSize: "A3-landscape",
    });
  });

  pages.push({
    id: "circuit-table",
    title: "回路计算表",
    html: renderCircuitTable({ design, assembly, matches }),
    pageSize: "A4-landscape",
  });

  pages.push({
    id: "door-chart",
    title: "箱门回路总表",
    html: renderDoorChart({ design, assembly, net, matches, labels }),
    pageSize: "A4",
  });

  pages.push({
    id: "labels-sheet",
    title: "面标与 PT-D210",
    html: renderLabelsSheet({ design, assembly, labels }),
    pageSize: "A4",
  });

  pages.push({
    id: "channel-list",
    title: "通道清单",
    html: renderChannelList({ design, findProduct: resolver }),
    pageSize: "A4",
  });

  pages.push({
    id: "wire-tags",
    title: "号码管 / 端子 / 挂牌",
    html: renderWireTags({ design, assembly, net, labels, matches }),
    pageSize: "A4",
  });

  pages.push({
    id: "nameplate",
    title: "铭牌",
    html: renderNameplate({ design }),
    pageSize: "90x60mm",
  });

  pages.push({
    id: "wiring-table",
    title: "接线表",
    html: renderWiringTable({ net, labels }),
    pageSize: "A4-landscape",
  });

  pages.push({
    id: "bom",
    title: "物料清单",
    html: renderBomPage({ bom }),
    pageSize: "A4",
  });

  pages.push({
    id: "smart-faces",
    title: "智能模块面板图",
    html: renderSmartModuleFaces({ design, assembly }),
    pageSize: "A4",
  });

  pages.push({
    id: "checklist",
    title: "检查与验收单",
    html: renderChecklist({ design, interactive }),
    pageSize: "A4",
  });

  pages.push({
    id: "audit-list",
    title: "校核清单",
    html: renderAuditList({ issues }),
    pageSize: "A4",
  });

  const mode = uiMode || design?.uiMode || "simple";
  if (mode === "simple") {
    return { pages: pages.filter((p) => SIMPLE_DOC_PAGE_IDS.has(p.id) || p.id.startsWith('terminal-connections-') || p.id.startsWith('system-diagram-')) };
  }

  return { pages };
}
