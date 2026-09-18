import { dash, esc, pageShell, DISCLAIMER } from "./_util.js";
import { qrSvg, nameplateQrPayload } from "../qr.js";

/** 封面 HTML */
export function renderCover({ design, assembly } = {}) {
  const box = assembly?.box;
  const circuits = design?.circuits?.length ?? 0;
  const supply =
    design?.supply === "three" ? "三相 380/220 V" : "单相 220 V";
  const rev =
    design?.revisions?.length > 0
      ? `Rev ${design.revisions.length}`
      : dash(design?.revision);
  const sign = design?.signoff?.designer?.name
    ? `设计 ${design.signoff.designer.name}`
    : "未签认";
  const payload = nameplateQrPayload(design, design?.publicBaseUrl ? "online" : "offline");
  const qr = payload ? qrSvg(payload, 96) : "";

  const body =
    `<div class="cover">` +
    `<p class="cover-kicker">配电工坊 · 施工文档包</p>` +
    `<h2 class="cover-title">${esc(dash(design?.name))}</h2>` +
    `<dl class="cover-meta">` +
    `<div><dt>箱体</dt><dd>${esc(dash(box?.name))}</dd></div>` +
    `<div><dt>供电</dt><dd>${esc(supply)} · 接地 ${esc(dash(design?.earthing))}</dd></div>` +
    `<div><dt>回路数</dt><dd>${circuits}</dd></div>` +
    `<div><dt>版本</dt><dd>${esc(rev)}</dd></div>` +
    `<div><dt>签认</dt><dd>${esc(sign)}</dd></div>` +
    `<div><dt>方案 ID</dt><dd>${esc(dash(design?.designId))}</dd></div>` +
    `</dl>` +
    (qr ? `<div class="cover-qr">${qr}</div>` : "") +
    `<p class="cover-note">${esc(DISCLAIMER)}。本封面及后续页仅供方案沟通与现场辅助，不构成施工合格或送电许可。</p>` +
    `</div>`;

  return pageShell("封面", body, "doc-cover");
}
