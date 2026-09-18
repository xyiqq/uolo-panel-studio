import { esc, pageShell } from "./_util.js";

const SECTIONS = [
  {
    id: "before-install",
    title: "安装前",
    items: [
      { id: "bi-cabinet", text: "箱体规格、安装方式与预留开孔与方案一致" },
      { id: "bi-zones", text: "强电 / 弱电 / SELV 分区隔离满足设计" },
      { id: "bi-reserve", text: "散热与预留模位已核对" },
      { id: "bi-selv", text: "SELV 回路与市电回路物理隔离" },
    ],
  },
  {
    id: "during-wiring",
    title: "接线中",
    items: [
      { id: "dw-npe", text: "N / PE 分排，无混接" },
      { id: "dw-hole", text: "每回路独立孔位，未共用端子" },
      { id: "dw-torque", text: "压接扭矩按产品额定值执行并记录" },
      { id: "dw-section", text: "线径与方案截面一致" },
      { id: "dw-bus", text: "总线极性 / 终端电阻正确（若有）" },
    ],
  },
  {
    id: "before-energize",
    title: "送电前",
    items: [
      { id: "be-insulation", text: "绝缘电阻测量合格并记录" },
      { id: "be-rcd", text: "RCD 试验按钮动作正常" },
      { id: "be-phase", text: "相序正确" },
      { id: "be-earth", text: "接地电阻满足要求" },
      { id: "be-bus-v", text: "总线供电电压在允许范围（若有）" },
    ],
  },
];

/** 检查与验收单（可空表或已填） */
export function renderChecklist({ design } = {}) {
  const state = design?.checklist || {};
  const blocks = SECTIONS.map((sec) => {
    const rows = sec.items
      .map((it) => {
        const st = state[it.id] || {};
        const checked = st.checked ? "checked" : "";
        const val = st.value != null ? String(st.value) : "";
        const meta = [st.by, st.at].filter(Boolean).join(" · ");
        return (
          `<tr>` +
          `<td><input type="checkbox" disabled ${checked}/></td>` +
          `<td>${esc(it.text)}</td>` +
          `<td>${esc(val)}</td>` +
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

  return pageShell("检查与验收单", blocks, "doc-checklist");
}
