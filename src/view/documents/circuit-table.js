import { dash, esc, pageShell } from "./_util.js";
import { productSku } from "../../core/domain.js";

/** 回路计算表 HTML */
export function renderCircuitTable({ design, assembly, matches } = {}) {
  const matchMap = matches || {};
  const rows = (design?.circuits || [])
    .map((c) => {
      const m = matchMap[c.id] || {};
      const node = (assembly?.nodes || []).find((n) => n.id === c.id);
      const product = m.product || node?.product;
      const sku = product ? productSku(product) : "—";
      return (
        `<tr>` +
        `<td>${esc(c.id)}</td>` +
        `<td>${esc(c.name)}</td>` +
        `<td>${esc(c.phase)}</td>` +
        `<td>${esc(sku)}</td>` +
        `<td>${esc(dash(m.ib != null ? Number(m.ib).toFixed(2) : null))}</td>` +
        `<td>${esc(dash(m.p != null ? (Number(m.p) / 1000).toFixed(2) : null))}</td>` +
        `<td>${esc(dash(m.section))}</td>` +
        `<td>${esc(dash(m.cable))}</td>` +
        `<td>${esc(dash(m.drop != null ? Number(m.drop).toFixed(2) : null))}</td>` +
        `<td>${esc(dash(c.length))}</td>` +
        `</tr>`
      );
    })
    .join("");

  const body =
    `<table class="doc-table">` +
    `<thead><tr>` +
    `<th>回路</th><th>名称</th><th>相位</th><th>开关</th>` +
    `<th>Ib (A)</th><th>Pe (kW)</th><th>截面</th><th>电缆</th><th>压降%</th><th>长度 m</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`;

  return pageShell("回路计算表", body, "doc-circuit-table");
}
