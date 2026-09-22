import { dash, esc, pageShell, DISCLAIMER } from "./_util.js";
import { qrSvg, nameplateQrPayload, qrMode } from "../qr.js";
import { revisionLabel, SIGNOFF_ROLE_LABELS } from '../../core/revisions.js';

/** 封面 HTML */
export function renderCover({ design, assembly } = {}) {
  const box = assembly?.box;
  const validDimensions = values => Array.isArray(values) && values.length === 3 && values.every(value => Number.isFinite(value) && value > 0);
  const hasOuterDimensions = validDimensions(box?.outer);
  const dimensions = hasOuterDimensions ? box.outer : [box?.width, box?.height, box?.depth];
  const dimensionText = validDimensions(dimensions) ? `${dimensions.join(' × ')} mm${box?.estimated ? '（估算，待实物确认）' : ''}` : '待填写';
  const circuits = design?.circuits?.length ?? 0;
  const supply =
    design?.supply === "three" ? "三相 380/220 V" : "单相 220 V";
  const rev = revisionLabel(design);
  const sign = Object.entries(SIGNOFF_ROLE_LABELS).map(([role, label]) => {
    const entry = design?.signoff?.[role];
    return entry?.name ? `${label} ${entry.name} · ${entry.at || '日期未填'}${entry.note ? ` · ${entry.note}` : ''}` : `${label} 未签认`;
  }).join('；');
  const payload = nameplateQrPayload(design, qrMode(design));
  const qr = payload ? qrSvg(payload, 96) : "";

  const body =
    `<div class="cover">` +
    `<p class="cover-kicker">配电工坊 · 方案交付文档</p>` +
    `<h2 class="cover-title">${esc(dash(design?.name))}</h2>` +
    `<dl class="cover-meta">` +
    `<div class="cover-project-info"><dt>公司名称</dt><dd>${esc(dash(design?.companyName))}</dd></div>` +
    `<div class="cover-project-info"><dt>项目地址</dt><dd>${esc(dash(design?.projectAddress))}</dd></div>` +
    `<div><dt>箱体</dt><dd>${esc(dash(box?.name))}</dd></div>` +
    `<div><dt>${hasOuterDimensions ? '配电箱外形尺寸' : '配电箱尺寸'}（宽 × 高 × 深）</dt><dd>${esc(dimensionText)}</dd></div>` +
    `<div><dt>供电</dt><dd>${esc(supply)} · 接地 ${esc(dash(design?.earthing))}</dd></div>` +
    `<div><dt>回路数</dt><dd>${circuits}</dd></div>` +
    `<div><dt>版本</dt><dd>${esc(rev)}</dd></div>` +
    `<div><dt>修订摘要</dt><dd>${esc(dash(design?.revisions?.at(-1)?.summary))}</dd></div>` +
    `<div><dt>签认</dt><dd>${esc(sign)}</dd></div>` +
    `<div><dt>方案 ID</dt><dd>${esc(dash(design?.designId))}</dd></div>` +
    `</dl>` +
    `<section class="cover-reading"><h2>这份文档怎么看</h2><p><strong>了解用途：</strong>先看箱门回路总表和通道清单，找到各房间、灯具与设备。</p><p><strong>核对采购：</strong>查看物料清单，对照名称、数量和安装位置；实际品牌、型号及规格由采购前另行确认。</p><p><strong>安装与交接：</strong>由专业人员核对图纸、接线表和校核清单，再填写检查与验收单。不同导出选项可能只包含其中部分页面。</p><p class="hint">同一个设备或回路编号在不同页面中指向同一对象；— 表示信息未提供。</p></section>` +
    (qr ? `<div class="cover-qr">${qr}</div>` : "") +
    `<p class="cover-note">${esc(DISCLAIMER)}。本封面及后续页仅供方案沟通与现场辅助，不构成施工合格或送电许可。</p>` +
    `</div>`;

  return pageShell("封面", body, "doc-cover");
}
