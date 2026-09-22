import { esc, pageShell } from "./_util.js";
import { qrSvg, circuitQrPayload, qrMode } from "../qr.js";
import { productSku } from "../../core/domain.js";

/**
 * 号码管 / 端子条 + 电缆挂牌
 */
export function renderWireTags({ design, assembly, net, labels, matches } = {}) {
  const wires = labels?.wires || [];
  const byCircuit = new Map();
  for (const w of wires) {
    const raw = (net?.wires || []).find((x) => x.id === w.id);
    const cid = raw?.circuit || "_common";
    if (!byCircuit.has(cid)) byCircuit.set(cid, []);
    byCircuit.get(cid).push({ ...w, conductor: raw?.conductor, scope: raw?.scope });
  }

  let tubeHtml = "";
  for (const [cid, list] of byCircuit) {
    tubeHtml += `<h3>${esc(cid === "_common" ? "公共 / 进线" : cid)}</h3><ul class="tag-list">`;
    for (const w of list) {
      tubeHtml +=
        `<li><code>${esc(w.fromTag)}</code> → <code>${esc(w.toTag)}</code>` +
        ` <span class="muted">${esc(w.conductor || "")} ${esc(w.scope || "")}</span></li>`;
    }
    tubeHtml += `</ul>`;
  }

  // 端子条 XN / XPE / X
  const ports = Object.values(net?.ports || {});
  const groups = { XN: [], XPE: [], X: [] };
  for (const p of ports) {
    const tag = labels?.terminalTag ? labels.terminalTag(p) : p.tag || "";
    if (String(tag).startsWith("XN:")) groups.XN.push({ tag, id: p.id });
    else if (String(tag).startsWith("XPE:")) groups.XPE.push({ tag, id: p.id });
    else if (String(tag).startsWith("X:")) groups.X.push({ tag, id: p.id });
  }

  const strip = (title, arr) =>
    `<section><h3>${esc(title)}</h3><ol class="term-strip">` +
    arr
      .sort((a, b) => String(a.tag).localeCompare(String(b.tag), undefined, { numeric: true }))
      .map((t) => `<li><code>${esc(t.tag)}</code> <span class="muted">${esc(t.id)}</span></li>`)
      .join("") +
    `</ol></section>`;

  // 出箱电缆挂牌
  const matchMap = matches || {};
  const hang = (design?.circuits || [])
    .map((c) => {
      const m = matchMap[c.id] || {};
      const node = (assembly?.nodes || []).find((n) => n.id === c.id);
      const product = m.product || node?.product;
      const payload = circuitQrPayload(
        design,
        {
          ...c,
          productName: product?.name || "",
          residual: product?.residual,
        },
        qrMode(design),
      );
      return (
        `<div class="cable-tag" data-circuit="${esc(c.id)}">` +
        `<div><strong>${esc(c.id)}</strong> ${esc(c.name)}</div>` +
        `<div>${esc(m.cable || "—")} · ${esc(c.length != null ? c.length + " m" : "—")}</div>` +
        `<div>去向：${esc(c.path || "—")}</div>` +
        `<div>${product ? esc(productSku(product)) : ""}</div>` +
        (payload ? `<div class="qr-cell">${qrSvg(payload, 48)}</div>` : "") +
        `</div>`
      );
    })
    .join("");

  const body =
    `<section><h2>号码管（按回路）</h2>${tubeHtml || "<p>无导线</p>"}</section>` +
    `<section><h2>端子条</h2>${strip("N 排 XN", groups.XN)}${strip("PE 排 XPE", groups.XPE)}${strip("出箱 X", groups.X)}</section>` +
    `<section><h2>电缆挂牌</h2><div class="cable-grid">${hang}</div></section>`;

  return pageShell("号码管 / 端子条 / 挂牌", body, "doc-wire-tags");
}
