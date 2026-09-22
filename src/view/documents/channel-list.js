import { esc, pageShell } from "./_util.js";
import { buildChannelRows } from "../../core/modules.js";

/** 通道备注清单（简易布置主文档） */
export function renderChannelList({ design, findProduct } = {}) {
  const rows = buildChannelRows(design || {}, findProduct || null);
  const bodyRows = rows
    .map(
      (r) =>
        `<tr>` +
        `<td>${esc(r.moduleId)}</td>` +
        `<td>${esc(r.moduleLabel)}</td>` +
        `<td>${esc(r.productName)}</td>` +
        `<td>${r.channel === "" ? "—" : `CH${r.channel}`}</td>` +
        `<td>${esc(r.label || "")}</td>` +
        `<td>${esc(r.terminal || "—")}</td>` +
        `<td>${esc(r.breaker || "—")}</td>` +
        `<td>${esc(r.rcd || "—")}</td>` +
        `</tr>`,
    )
    .join("");

  const body =
    `<p class="hint">模块通道自由备注与共用保护关系；非强电计算表。</p>` +
    `<table class="doc-table"><thead><tr>` +
    `<th>模块</th><th>名称</th><th>型号</th><th>通道</th><th>备注</th><th>端子节号</th><th>共用空开</th><th>共用漏保</th>` +
    `</tr></thead><tbody>${bodyRows || "<tr><td colspan='8'>暂无模块</td></tr>"}</tbody></table>`;

  return pageShell("通道清单", body, "doc-channel-list");
}
