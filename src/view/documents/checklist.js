import { esc, pageShell } from "./_util.js";
import { CHECKLIST_SECTIONS, checklistProgress } from "../../core/checklist-spec.js";

/**
 * 检查与验收单（可空表或已填）
 * @param {{ design?: object, interactive?: boolean }} ctx
 *   interactive=true 时输出可勾选 / 可填写的控件（文档中心预览用），
 *   打印与 ZIP 用 false，保持只读快照。
 */
export function renderChecklist({ design, interactive = false } = {}) {
  const state = design?.checklist || {};
  const blocks = CHECKLIST_SECTIONS.map((sec) => {
    const rows = sec.items
      .map((it) => {
        const st = state[it.id] || {};
        const checked = st.checked ? "checked" : "";
        const val = st.value != null ? String(st.value) : "";
        const meta = [st.by, st.at].filter(Boolean).join(" · ");
        const box = interactive
          ? `<input type="checkbox" data-check="${esc(it.id)}" ${checked}/>`
          : `<input type="checkbox" disabled ${checked}/>`;
        const value = interactive
          ? `<input type="text" data-check-value="${esc(it.id)}" value="${esc(val)}" placeholder="记录值">`
          : esc(val);
        return (
          `<tr>` +
          `<td>${box}</td>` +
          `<td>${esc(it.text)}</td>` +
          `<td>${value}</td>` +
          `<td>${esc(meta)}</td>` +
          `</tr>`
        );
      })
      .join("");
    return (
      `<section class="check-sec" data-section="${esc(sec.id)}">` +
      `<h2>${esc(sec.title)}</h2>` +
      `<table class="doc-table"><thead><tr><th>✓</th><th>检查项</th><th>记录值</th><th>执行</th></tr></thead>` +
      `<tbody>${rows}</tbody></table></section>`
    );
  }).join("");

  const { done, total } = checklistProgress(state);
  const head =
    `<p class="hint">已记录 ${done} / ${total} 项。勾选仅为现场记录，不替代持证电工的送电试验与竣工验收。</p>`;

  return pageShell("检查与验收单", head + blocks, "doc-checklist");
}
