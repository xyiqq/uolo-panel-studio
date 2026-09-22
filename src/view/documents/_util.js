/** 文档公用：转义与口径 */

export const DISCLAIMER = "条件性方案 · 非施工合格结论";

export function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
