/**
 * 智能模块面板图（SVG 拼版，非厂家 CAD）
 * 口径：参数化示意 · 非厂家 CAD · 不得直接施工
 */
import { moduleFaceSvg } from "../module-face.js";
import { esc } from "./_util.js";

/**
 * @param {{ design?: object, assembly?: object }} ctx
 */
export function renderSmartModuleFaces({ design, assembly } = {}) {
  const nodes = (assembly?.nodes || []).filter(
    (n) => n.product?.smart || n.product?.zone === "control",
  );
  const products = [];
  const seen = new Set();
  for (const n of nodes) {
    const p = {...n.product, hardwareId:n.module?.hardwareId || n.product?.hardwareId || '', ipAddress:n.module?.ipAddress || n.product?.ipAddress || '', instanceId:n.id};
    if (!n.product || seen.has(n.id)) continue;
    seen.add(n.id);
    products.push(p);
  }
  if (!products.length && design?.customProducts) {
    // fallback empty
  }
  const cards = products
    .map(
      (p) =>
        `<figure class="smart-face-card">
      <figcaption><b>${esc(p.instanceId)}</b> · ${esc(p.brand)} · ${esc(p.name)} · ${p.modules ?? "—"}M</figcaption>
      ${moduleFaceSvg(p, 360, 150)}
    </figure>`,
    )
    .join("");

  return `<section>
    <h2 style="font:16px sans-serif">智能模块面板图</h2>
    <p style="font:11px sans-serif;color:#555">参数化 SVG 示意，非厂家专有 CAD 翻模。尺寸取自公开资料或同族占位，不得直接施工。</p>
    <div style="display:flex;flex-wrap:wrap;gap:12px">${cards || "<p>当前方案未装入智能模块。</p>"}</div>
  </section>
  <style>
    .smart-face-card{break-inside:avoid;margin:0 0 14px}
    .smart-face-card figcaption{font:12px 'Microsoft YaHei',sans-serif;color:#33403a;margin-bottom:5px}
    .smart-face-card svg{display:block}
  </style>`;
}
