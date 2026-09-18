/**
 * 文档中心汇总
 * ctx = { design, assembly, net, issues, matches, bom, labels }
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
import { renderSystemDiagram } from "../system-diagram.js";
import { renderSmartModuleFaces } from "./smart-faces.js";

/**
 * @param {object} ctx
 * @returns {{ pages: { id: string, title: string, html?: string, svg?: string, pageSize: string }[] }}
 */
export function buildDocumentPack(ctx = {}) {
  const {
    design,
    assembly,
    net,
    issues = [],
    matches = {},
    bom,
    labels,
  } = ctx;

  const pages = [];

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
    html: renderDoorChart({ design, assembly, matches, labels }),
    pageSize: "A4",
  });

  pages.push({
    id: "labels-sheet",
    title: "面标与 PT-D210",
    html: renderLabelsSheet({ design, assembly, labels }),
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
    html: renderChecklist({ design }),
    pageSize: "A4",
  });

  pages.push({
    id: "audit-list",
    title: "校核清单",
    html: renderAuditList({ issues }),
    pageSize: "A4",
  });

  return { pages };
}
