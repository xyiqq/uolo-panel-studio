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
          ? `<span class="check-mirror" aria-hidden="true">${st.checked ? '☑' : '□'}</span><input type="checkbox" aria-label="${esc(it.text)}" data-check="${esc(it.id)}" ${checked}/>`
          : `<span aria-label="${st.checked ? '已记录' : '待检查'}">${st.checked ? '☑' : '□'}</span>`;
        const value = interactive
          ? `<span class="check-mirror" aria-hidden="true">${esc(val || '待记录')}</span><input type="text" data-check-value="${esc(it.id)}" value="${esc(val)}" placeholder="记录值">`
          : esc(val || '待记录');
        return (
          `<tr>` +
          `<td>${box}</td>` +
          `<td>${esc(it.text)}</td>` +
          `<td>${value}</td>` +
          `<td>${esc(meta || '待填写')}</td>` +
          `</tr>`
        );
      })
      .join("");
    return (
      `<section class="check-sec" data-section="${esc(sec.id)}">` +
      `<h2>${esc(sec.title)}</h2>` +
      `<table class="doc-table"><thead><tr><th>记录</th><th>检查事项</th><th>实测值 / 备注</th><th>记录人 / 时间</th></tr></thead>` +
      `<tbody>${rows}</tbody></table></section>`
    );
  }).join("");

  const { done, total } = checklistProgress(state);
  const head =
    `<p class="hint">已记录 ${done} / ${total} 项。勾选仅为现场记录，不替代持证电工的送电试验与竣工验收。</p>`;

  return pageShell("检查与验收单", head + blocks, "doc-checklist", '按安装前、接线中、送电前顺序核对。由专业人员填写实测值及记录人；不适用的项目请在备注中说明。N 为零线，PE 为保护地线，SELV 为安全特低电压，RCD 为漏电保护器。空白不表示已通过。');
}
