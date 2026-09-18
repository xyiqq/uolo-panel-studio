import { dash, esc, DISCLAIMER } from "./_util.js";
import { qrSvg, nameplateQrPayload } from "../qr.js";

/** 铭牌 90×60 mm */
export function renderNameplate({ design } = {}) {
  const payload = nameplateQrPayload(
    design,
    design?.publicBaseUrl ? "online" : "offline",
  );
  const qr = payload ? qrSvg(payload, 72) : "";
  const rev =
    design?.revisions?.length > 0
      ? `Rev ${design.revisions.length}`
      : dash(design?.revision);
  const date = (design?.updatedAt || design?.createdAt || "").toString().slice(0, 10);

  const plate =
    `<div class="nameplate" style="width:90mm;height:60mm">` +
    `<div class="np-brand">配电工坊</div>` +
    `<div class="np-title">${esc(dash(design?.name))}</div>` +
    `<div class="np-meta">ID ${esc(dash(design?.designId))}</div>` +
    `<div class="np-meta">${esc(rev)} · ${esc(dash(date))}</div>` +
    `<div class="np-disclaimer">${esc(DISCLAIMER)}</div>` +
    (qr ? `<div class="np-qr">${qr}</div>` : "") +
    `</div>`;

  return (
    `<article class="doc-page doc-nameplate">` +
    `<header class="doc-head"><h1>铭牌</h1>` +
    `<p class="doc-disclaimer">${esc(DISCLAIMER)}</p></header>` +
    `<div class="doc-body">${plate}</div></article>`
  );
}
