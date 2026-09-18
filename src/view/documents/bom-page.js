import { dash, esc, pageShell } from "./_util.js";

/** BOM 页 */
export function renderBomPage({ bom } = {}) {
  const items = bom?.items || [];
  const wires = bom?.wires || [];

  const itemRows = items
    .map(
      (it) =>
        `<tr>` +
        `<td>${esc(it.sku)}</td>` +
        `<td>${esc(it.name)}</td>` +
        `<td>${esc(it.brand || "")}</td>` +
        `<td>${esc(it.qty)}</td>` +
        `<td>${esc(it.note || "")}</td>` +
        `</tr>`,
    )
    .join("");

  const wireRows = wires
    .map(
      (w) =>
        `<tr>` +
        `<td>${esc(dash(w.section))}</td>` +
        `<td>${esc(w.color)}</td>` +
        `<td>${esc(w.meters)}</td>` +
        `</tr>`,
    )
    .join("");

  const body =
    `<section><h2>器件与附件</h2>` +
    `<table class="doc-table"><thead><tr><th>SKU</th><th>名称</th><th>品牌</th><th>数量</th><th>备注</th></tr></thead>` +
    `<tbody>${itemRows || "<tr><td colspan='5'>无</td></tr>"}</tbody></table></section>` +
    `<section><h2>线材估算</h2>` +
    `<table class="doc-table"><thead><tr><th>截面</th><th>颜色</th><th>米数</th></tr></thead>` +
    `<tbody>${wireRows || "<tr><td colspan='3'>无</td></tr>"}</tbody></table>` +
    `<p class="hint">线长按端子三维距离 ×1.4 +120 mm 余量估算；出箱电缆按回路长度计。仅供备料参考。</p></section>`;

  return pageShell("物料清单 BOM", body, "doc-bom");
}
