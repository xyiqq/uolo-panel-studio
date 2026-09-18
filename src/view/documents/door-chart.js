import { dash, esc, pageShell } from "./_util.js";
import { productSku } from "../../core/domain.js";
import { qrSvg, circuitQrPayload } from "../qr.js";

/** 箱门回路总表 */
export function renderDoorChart({ design, assembly, matches, labels } = {}) {
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
        design?.publicBaseUrl ? "online" : "offline",
      );
      const qr = payload ? qrSvg(payload, 40) : "";
      return (
        `<tr>` +
        `<td>${esc(c.id)}</td>` +
        `<td>${esc(label)}</td>` +
        `<td>${esc(room)}</td>` +
        `<td>${esc(sku)}${product?.amps != null ? ` / ${product.amps}A` : ""}</td>` +
        `<td>${esc(c.phase)}</td>` +
        `<td>${esc(dash(c.moduleChannel))}</td>` +
        `<td class="qr-cell">${qr}</td>` +
        `</tr>`
      );
    })
    .join("");

  const body =
    `<table class="doc-table">` +
    `<thead><tr>` +
    `<th>回路号</th><th>名称</th><th>房间</th><th>开关规格</th><th>相位</th><th>模块通道</th><th>二维码</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`;

  return pageShell("箱门回路总表", body, "doc-door-chart");
}
