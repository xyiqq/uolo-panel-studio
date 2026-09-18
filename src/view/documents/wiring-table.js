import { dash, esc, pageShell } from "./_util.js";

/** 接线表 */
export function renderWiringTable({ net, labels } = {}) {
  const rows = (net?.wires || [])
    .map((w) => {
      const fromTag = labels?.terminalTag
        ? labels.terminalTag(w.from)
        : w.fromTag || w.from;
      const toTag = labels?.terminalTag
        ? labels.terminalTag(w.to)
        : w.toTag || w.to;
      const tag = labels?.wireTag ? labels.wireTag(w) : w.tag || "";
      return (
        `<tr>` +
        `<td>${esc(w.id)}</td>` +
        `<td>${esc(tag)}</td>` +
        `<td>${esc(fromTag)}</td>` +
        `<td>${esc(toTag)}</td>` +
        `<td>${esc(w.conductor)}</td>` +
        `<td>${esc(dash(w.section))}</td>` +
        `<td>${esc(w.scope || "")}</td>` +
        `<td>${esc(w.circuit || "")}</td>` +
        `<td>${w.connected ? "是" : "否"}</td>` +
        `</tr>`
      );
    })
    .join("");

  const body =
    `<table class="doc-table">` +
    `<thead><tr>` +
    `<th>导线 ID</th><th>号码管</th><th>起点标签</th><th>终点标签</th>` +
    `<th>导体</th><th>截面</th><th>范围</th><th>回路</th><th>已接</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`;

  return pageShell("接线表", body, "doc-wiring-table");
}
