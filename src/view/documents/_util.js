/** 文档公用：转义与口径 */

export const DISCLAIMER = "条件性方案 · 非施工合格结论";

import { escapeHtml as esc } from "../../core/escape.js";

export { esc };

export function dash(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

export function pageShell(title, body, extraClass = "", guide = "") {
  return (
    `<article class="doc-page ${extraClass}">` +
    `<header class="doc-head"><h1>${esc(title)}</h1>` +
    `<p class="doc-disclaimer">${esc(DISCLAIMER)}</p></header>` +
    `<div class="doc-body">${guide ? `<p class="doc-guide">${esc(guide)}</p>` : ""}${body}</div></article>`
  );
}
