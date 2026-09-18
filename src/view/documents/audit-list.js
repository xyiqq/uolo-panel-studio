import { dash, esc, pageShell } from "./_util.js";

/** 校核清单 */
export function renderAuditList({ issues } = {}) {
  const list = issues || [];
  const rows = list
    .map((it) => {
      const level = it.level || it.severity || "info";
      return (
        `<tr class="issue-${esc(level)}">` +
        `<td>${esc(level)}</td>` +
        `<td>${esc(it.code || "")}</td>` +
        `<td>${esc(it.message || it.text || "")}</td>` +
        `<td>${esc(dash(it.circuit || it.target || ""))}</td>` +
        `</tr>`
      );
    })
    .join("");

  const body =
    list.length === 0
      ? `<p>当前无校核条目。</p>`
      : `<table class="doc-table"><thead><tr><th>级别</th><th>代码</th><th>说明</th><th>对象</th></tr></thead>` +
        `<tbody>${rows}</tbody></table>`;

  return pageShell("校核清单", body, "doc-audit-list");
}
