/**
 * 智能模块面板图（SVG 拼版，非厂家 CAD）
 */
import { smartFaceSvg } from "../smart-device3d.js";

/**
 * @param {{ design?: object, assembly?: object }} ctx
 */
export function renderSmartModuleFaces({ design, assembly } = {}) {
  const nodes = (assembly?.nodes || []).filter((n) => n.product?.smart || n.product?.zone === "control");
  const products = [];
  const seen = new Set();
  for (const n of nodes) {
    const p = n.product;
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    products.push(p);
  }
  if (!products.length && design?.customProducts) {
    // fallback empty
  }
  const cards = products
    .map(
      (p) =>
        `<div style="break-inside:avoid;margin:0 0 16px;border:1px solid #ccc;padding:8px">
      <div style="font:12px sans-serif;margin-bottom:6px"><b>${p.brand}</b> · ${p.name} · ${p.modules ?? "—"}M</div>
      ${smartFaceSvg(p, 360, 100)}
    </div>`
    )
    .join("");

  return `<section>
    <h2 style="font:16px sans-serif">智能模块面板图</h2>
    <p style="font:11px sans-serif;color:#555">参数化 SVG 示意，非厂家专有 CAD 翻模。尺寸取自公开资料或同族占位，不得直接施工。</p>
    <div style="display:flex;flex-wrap:wrap;gap:12px">${cards || "<p>当前方案未装入智能模块。</p>"}</div>
  </section>`;
}
