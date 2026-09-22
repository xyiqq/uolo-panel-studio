/**
 * 检查与验收单条目定义（视图与交互共用）
 * 口径：条件性方案 · 非施工合格结论；勾选只是现场记录，不构成验收结论。
 */

export const CHECKLIST_SECTIONS = [
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

/** 全部条目 id（扁平） */
export function checklistItemIds() {
  return CHECKLIST_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
}

/** 查找条目文案 */
export function checklistItemText(id) {
  for (const s of CHECKLIST_SECTIONS) {
    const hit = s.items.find((i) => i.id === id);
    if (hit) return hit.text;
  }
  return "";
}

/** 本地时区时间戳 `YYYY-MM-DD HH:mm`（现场记录按本地时间读） */
export function localStamp(now) {
  const d = now ? new Date(now) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * 写入一条检查记录（纯函数，返回新的 checklist 对象）
 * @param {object} checklist design.checklist
 * @param {string} itemId
 * @param {{ checked?: boolean, value?: string, by?: string }} patch
 * @param {string|Date} [now] 时间，便于测试注入
 */
export function setChecklistItem(checklist, itemId, patch = {}, now) {
  const base = { ...(checklist || {}) };
  const prev = base[itemId] || {};
  const next = { ...prev };
  if (patch.checked !== undefined) next.checked = !!patch.checked;
  if (patch.value !== undefined) next.value = String(patch.value);
  if (patch.by !== undefined) next.by = String(patch.by);
  next.at = localStamp(now);
  if (!next.checked && !next.value) {
    delete base[itemId];
    return base;
  }
  base[itemId] = next;
  return base;
}

/** 统计：已勾选 / 总数 */
export function checklistProgress(checklist) {
  const ids = checklistItemIds();
  const done = ids.filter((id) => (checklist || {})[id]?.checked).length;
  return { done, total: ids.length };
}
