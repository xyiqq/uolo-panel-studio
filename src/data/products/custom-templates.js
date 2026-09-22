/**
 * 自定义模块精绘 DIN 尺寸模板（IEC 60715 / DIN 43880 常见模位）。
 * 宽按 18 mm/模；高/深为箱内常见导轨外形，电气额定仍由用户自填或待核。
 */

/** @typedef {{ id: string, label: string, modules: number, width: number, height: number, depth: number, hint: string }} DinSizeTemplate */

/** @type {DinSizeTemplate[]} */
export const DIN_SIZE_TEMPLATES = [
  {
    id: "din-1m",
    label: "1P · 18×90×60",
    modules: 1,
    width: 18,
    height: 90,
    depth: 60,
    hint: "单极占位 / 辅件",
  },
  {
    id: "din-2m",
    label: "2P · 36×90×60",
    modules: 2,
    width: 36,
    height: 90,
    depth: 60,
    hint: "2P 断路器常见占位",
  },
  {
    id: "din-3m",
    label: "3P · 54×94×59",
    modules: 3,
    width: 54,
    height: 94,
    depth: 59,
    hint: "Crestron DIN-DLI 同族 3P",
  },
  {
    id: "din-4m",
    label: "4P · 72×90×60",
    modules: 4,
    width: 72,
    height: 90,
    depth: 60,
    hint: "4P / 小型执行器",
  },
  {
    id: "din-6m",
    label: "6P · 108×95×60",
    modules: 6,
    width: 108,
    height: 95,
    depth: 60,
    hint: "电源 / 接触器常见",
  },
  {
    id: "din-9m",
    label: "9P · 162×95×60",
    modules: 9,
    width: 162,
    height: 95,
    depth: 60,
    hint: "网关 / 多路开关",
  },
  {
    id: "din-12m",
    label: "12P · 216×95×60",
    modules: 12,
    width: 216,
    height: 95,
    depth: 60,
    hint: "多路调光 / 大型执行器",
  },
];

/** 自定义表单可选设备类型 */
export const CUSTOM_KIND_OPTIONS = [
  ["rcbo", "RCBO · 漏电与过流保护"],
  ["mcb", "MCB · 过流保护"],
  ["rccb", "RCCB · 仅漏电保护"],
  ["spd", "SPD · 并联浪涌保护"],
  ["gateway", "智能 · 网关 / 接口"],
  ["relay", "智能 · 开关执行器"],
  ["dimmer", "智能 · 调光 / 驱动"],
  ["psu", "智能 · 导轨电源"],
  ["meter", "智能 · 计量"],
  ["contactor", "智能 · 接触器 / 电机"],
  ["timer", "智能 · 时控"],
  ["terminal", "附件 · 导轨端子"],
];

export const SMART_CUSTOM_KINDS = [
  "gateway",
  "relay",
  "dimmer",
  "psu",
  "meter",
  "contactor",
  "timer",
  "terminal",
];

export const POWER_CUSTOM_KINDS = ["rcbo", "mcb", "rccb", "spd"];

/**
 * @param {string} kind
 * @returns {boolean}
 */
export function isSmartCustomKind(kind) {
  return SMART_CUSTOM_KINDS.includes(kind);
}

/**
 * 按品牌 + 型号自动拼名称预览。
 * @param {string} brand
 * @param {string} sku
 * @param {string} [existingName]
 */
export function autoCustomName(brand, sku, existingName = "") {
  const b = String(brand || "").trim();
  const s = String(sku || "").trim();
  if (!b && !s) return existingName || "";
  if (b && s) return `${b} ${s}`;
  return b || s;
}
