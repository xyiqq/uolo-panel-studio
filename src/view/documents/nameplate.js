import { dash, esc, pageShell } from "./_util.js";
import { qrSvg, nameplateQrPayload, qrMode } from "../qr.js";
import { revisionLabel } from '../../core/revisions.js';

/** 铭牌 90×60 mm */
export function renderNameplate({ design } = {}) {
  const payload = nameplateQrPayload(
    design,
    qrMode(design),
  );
  const qr = payload ? qrSvg(payload, 120) : "";
  const rev = revisionLabel(design);
  const date = (design?.updatedAt || design?.createdAt || "").toString().slice(0, 10);

  const plate =
    `<div class="nameplate">` +
    `<div class="np-brand">配电工坊</div>` +
    `<div class="np-title">${esc(dash(design?.name))}</div>` +
    `<div class="np-meta">${esc(rev)} · ${esc(dash(date))}</div>` +
    `<div class="np-disclaimer">先核对项目和版本，再按现场确认结果使用。</div>` +
    `</div>`;

  return pageShell('箱体识别标签',`<section><h2>贴在箱门上的项目标识</h2>${plate}<p class="hint">按虚线剪裁，标签为 90 × 60 毫米。打印请选择“实际大小 / 100%”，不要缩放。</p></section><section><h2>扫码标签接口</h2>${qr?`<div class="np-qr">${qr}</div><p>扫码打开本项目网页，可与上方识别标签一起贴在箱门上。</p>`:'<p class="doc-empty">本版尚未配置项目网页，因此不印二维码。后续在“文档设置”填写项目网页地址后重新生成。</p>'}</section>`, 'doc-nameplate','用于识别这份资料属于哪个项目、哪个版本。二维码网页由项目方后续提供，本页不会生成纯文本码。');
}
