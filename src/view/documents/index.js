/**
 * 文档中心汇总
 * ctx = { design, assembly, net, issues, matches, bom, labels, uiMode, findProduct }
 */

import { renderCover } from "./cover.js";
import { renderCabinetImage, renderSitePhoto } from "./cabinet-images.js";
import { renderCircuitTable } from "./circuit-table.js";
import { renderDoorChart } from "./door-chart.js";
import { renderLabelsSheet, renderLabelPaperPages } from "./labels-sheet.js";
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
import {deliveryMetadata} from '../../core/revisions.js';
import {esc} from './_util.js';

/** 简易布置默认文档页 */
export const SIMPLE_DOC_PAGE_IDS = new Set([
  "cover",
  "cabinet-image",
  "site-photo",
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
    cabinetImage,
  } = ctx;

  const resolver = findProduct || ((id) => domainFindProduct(design, id));
  const pages = [];
  const terminalPages = [];
  const connections = terminalRows(design || {}, resolver).filter(r=>r.loadName || r.output);
  for(let i=0;i<connections.length;i+=6) terminalPages.push({
    id:`terminal-connections-${i/6+1}`, title:`端子连接 · 第 ${i/6+1} 页`,
    svg:terminalConnectionSvg(connections.slice(i,i+6),{orientation:'portrait'}), pageSize:'A4',
  });

  pages.push({
    id: "cover",
    title: "封面",
    html: renderCover({ design, assembly }),
    pageSize: "A4",
  });

  pages.push({
    id: 'cabinet-image',
    title: '三维配电箱方案图',
    html: renderCabinetImage({ cabinetImage }),
    pageSize: 'A4',
  });
  const sitePhotoHtml = renderSitePhoto({ design });
  if (sitePhotoHtml) pages.push({
    id: 'site-photo',
    title: '配电箱现场实拍',
    html: sitePhotoHtml,
    pageSize: 'A4',
  });

  const diagram = renderSystemDiagram(design, assembly, net, matches);
  (diagram.pages || []).forEach((svg, i) => {
    pages.push({
      id: `system-diagram-${i + 1}`,
      title: `系统图 · 第 ${i + 1} 页`,
      svg,
      pageSize: "A4",
    });
  });
  pages.push(...terminalPages);

  pages.push({
    id: "circuit-table",
    title: "回路计算表",
    html: renderCircuitTable({ design, assembly, matches }),
    pageSize: "A4",
  });

  pages.push({
    id: "door-chart",
    title: "箱门回路总表",
    html: renderDoorChart({ design, assembly, net, matches, labels }),
    pageSize: "A4",
  });

  const labelPages = renderLabelPaperPages({ design, assembly, labels });
  if (labelPages) pages.push(...labelPages);
  else pages.push({
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
    pageSize: "A4",
  });

  pages.push({
    id: "wiring-table",
    title: "接线表",
    html: renderWiringTable({ net, labels }),
    pageSize: "A4",
  });

  pages.push({
    id: "bom",
    title: "物料清单",
    html: renderBomPage({ bom,assembly,design }),
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

  const metadata = deliveryMetadata(design);
  for (const page of pages) {
    page.metadata = metadata;
    if (page.html && page.pageSize !== 'A4-labels') page.html = page.html.replace('</article>', `<footer class="doc-version">${esc(metadata.name)} · ${esc(metadata.revision)} · ${esc(metadata.at)}</footer></article>`);
    if (page.svg) page.svg = page.svg.replace(/(<svg\b[^>]*>)/, `$1<metadata>${esc(JSON.stringify(metadata))}</metadata>`);
  }
  const mode = uiMode || design?.uiMode || "simple";
  if (mode === "simple") {
    return { metadata, pages: pages.filter((p) => SIMPLE_DOC_PAGE_IDS.has(p.id) || p.id.startsWith('labels-sheet-') || p.id.startsWith('terminal-connections-') || p.id.startsWith('system-diagram-')) };
  }

  return { metadata, pages };
}
