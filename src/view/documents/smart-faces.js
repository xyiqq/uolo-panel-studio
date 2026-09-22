/**
 * 智能模块面板图（SVG 拼版，非厂家 CAD）
 * 口径：参数化示意 · 非厂家 CAD · 不得直接施工
 */
import { moduleFaceSvg } from "../module-face.js";
import { esc, pageShell } from "./_util.js";
import {visibleModuleAddress} from '../../core/modules.js';

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
    const p = {...n.product, ...visibleModuleAddress(n.module || n.product), displayName:n.module?.displayName || n.product?.displayName || '', instanceId:n.id};
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
      <figcaption><b>${esc(p.instanceId)}</b> · ${esc(p.brand)} · ${esc(p.name)} · 占用 ${esc(p.modules ?? "—")} 个模位</figcaption>
      ${moduleFaceSvg(p, 600, 250)}
    </figure>`,
    )
    .join("");

  return pageShell('智能模块面板图', cards || '<p class="doc-empty">当前方案未装入智能模块。</p>', 'doc-smart-faces',
    '按设备编号对照箱内实物，查看各通道与接口位置。模位表示设备占用的安装宽度；图形为示意，非实际比例或厂家施工图。尺寸与接线须以对应型号的厂家资料为准。');
}
