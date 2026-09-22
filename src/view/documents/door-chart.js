import { dash, esc, pageShell } from "./_util.js";
import { productSku } from "../../core/domain.js";
import { qrSvg, circuitQrPayload, qrMode } from "../qr.js";
import { circuitModuleChannels, moduleDeliveryLinks } from "../module-delivery-links.js";

/** 箱门回路总表 */
export function renderDoorChart({ design, assembly, net, matches, labels } = {}) {
  const matchMap = matches || {};
  const rows = (design?.circuits || [])
    .map((c) => {
      const m = matchMap[c.id] || {};
      const node = (assembly?.nodes || []).find((n) => n.id === c.id);
      const product = m.product || node?.product;
      const sku = product ? productSku(product) : "—";
      const label = labels?.circuitLabel ? labels.circuitLabel(c) : `${c.id} ${c.name}`;
      const roomLoads = (design.loads || []).filter((l) =>
        (c.loadIds || []).includes(l.id),
      );
      const room = roomLoads.map((l) => l.room).find(Boolean) || "";
      const payload = circuitQrPayload(
        design,
        {
          ...c,
          productName: product?.name || "",
          residual: product?.residual,
        },
        qrMode(design),
      );
      const qr = payload ? qrSvg(payload, 40) : "";
      return (
        `<tr>` +
        `<td>${esc(c.id)}</td>` +
        `<td>${esc(label)}</td>` +
        `<td>${esc(room)}</td>` +
        `<td>${esc(sku)}${product?.amps != null ? ` / ${product.amps}A` : ""}</td>` +
        `<td>${esc(c.phase)}</td>` +
        `<td style="overflow-wrap:anywhere">${esc(dash(circuitModuleChannels(design,c).map(d => `${d.moduleId} CH${d.channel}`).join(' / ') || c.moduleChannel))}</td>` +
        `<td class="qr-cell">${qr}</td>` +
        `</tr>`
      );
    });

  const table = part =>
    `<table class="doc-table">` +
    `<thead><tr>` +
    `<th>回路号</th><th>名称</th><th>房间</th><th>开关规格</th><th>相位</th><th>模块通道</th><th>二维码</th>` +
    `</tr></thead><tbody>${part.join('')}</tbody></table>`;

  const pages = [];
  for(let i=0;i<Math.max(rows.length,1);i+=24) {
    pages.push(pageShell("箱门回路总表", table(rows.slice(i,i+24)), "doc-door-chart"));
  }
  const links = moduleDeliveryLinks(design,net);
  for(let i=0;i<links.length;i+=20) {
    const body = `<table class="doc-table" style="table-layout:fixed;width:100%;overflow-wrap:anywhere"><thead><tr><th>起点</th><th>终点</th><th>关联类型</th><th>接线说明</th></tr></thead><tbody>` +
      links.slice(i,i+20).map(r => `<tr><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${esc(r.kind)}</td><td>${esc(r.detail)}</td></tr>`).join('') + '</tbody></table>';
    pages.push(pageShell('箱门表 · 模块与端子链路',body,'doc-door-chart'));
  }
  return pages.join('');
}
