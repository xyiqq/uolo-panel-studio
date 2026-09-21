/**
 * 方案模板：空白箱体、按空开数量起步、用户保存的设备组合。
 * createDefaultDesign（全屋演示）仍保留给黄金测试与「全屋演示」模板。
 */
import {
  createDefaultDesign,
  validateDesign,
  balancePhases,
  clone,
  findProduct,
} from "../core/domain.js";

const SLOT_MM = 18;
const INNER_EXTRA_MM = 70; // makeGenericCabinet: width = slots*18 + 70

/** 每排 P 对应导轨净宽与箱内宽估算 */
export function slotsLengthHint(slots) {
  const n = Number(slots);
  if (!Number.isFinite(n) || n <= 0) return "";
  const rail = n * SLOT_MM;
  const inner = rail + INNER_EXTRA_MM;
  return `${n}P × ${SLOT_MM} mm = 导轨 ${rail} mm · 箱内宽约 ${inner} mm`;
}

/**
 * 空白方案：无支路空开，可选总开/SPD。
 * @param {object} [overrides]
 */
export function createBlankDesign(overrides = {}) {
  return {
    version: 2,
    revision: "simplified",
    name: "空白配电方案",
    cabinet: "MH144",
    supply: "three",
    earthing: "TN-S",
    mainAmps: 80,
    demand: 0.65,
    feedMethod: "B2",
    feedAmbient: 30,
    feedBunched: 1,
    sourceIsc: null,
    loads: [],
    circuits: [],
    states: {},
    wireOverrides: {},
    disconnected: [],
    brand: "Schneider Electric",
    includeMain: true,
    includeSpd: true,
    mainProductId: null,
    spdProductId: null,
    customCabinets: [],
    customProducts: [],
    connections: {},
    modules: [],
    buses: [],
    protectGroups: [],
    uiMode: "simple",
    nBarPosition: "bottom",
    ...overrides,
  };
}

/**
 * 按空开数量生成起步方案（默认施耐德 iDPN N Vigi C16）。
 * @param {{ count: number, productId?: string, name?: string, cabinet?: string, supply?: string }} opts
 */
export function createBreakerPackDesign(opts) {
  const count = Math.max(0, Math.min(80, Number(opts.count) || 0));
  const productId = opts.productId || "A9D32616";
  const design = createBlankDesign({
    name: opts.name || `${count} 路空开起步`,
    cabinet: opts.cabinet || "MH144",
    supply: opts.supply || "three",
  });
  const product = findProduct(design, productId);
  if (!product && count > 0) {
    throw new Error(`模板空开型号未找到：${productId}`);
  }
  for (let i = 0; i < count; i++) {
    design.circuits.push({
      id: `C${String(i + 1).padStart(2, "0")}`,
      name: `回路 ${String(i + 1).padStart(2, "0")}`,
      group: "sockets",
      path: "用户扩展 / 空开模板",
      loadIds: [],
      phase: "L1",
      voltage: 220,
      pf: 0.8,
      method: "B2",
      ambient: 30,
      bunched: 1,
      length: 20,
      wire: null,
      productId,
      rcdProductId: null,
      on: true,
      position: null,
    });
  }
  if (design.supply === "three") balancePhases(design);
  return design;
}

/** @typedef {{ id: string, name: string, hint: string, builtin: boolean, build: () => object }} BuiltinTemplate */

/** @type {BuiltinTemplate[]} */
export const BUILTIN_DESIGN_TEMPLATES = [
  {
    id: "blank",
    name: "空白箱体",
    hint: "仅总开 + SPD，无支路空开",
    builtin: true,
    build: () => createBlankDesign({ name: "空白箱体" }),
  },
  {
    id: "breakers-6",
    name: "6 路空开",
    hint: "6 × iDPN N Vigi C16",
    builtin: true,
    build: () => createBreakerPackDesign({ count: 6, name: "6 路空开起步" }),
  },
  {
    id: "breakers-12",
    name: "12 路空开",
    hint: "12 × iDPN N Vigi C16",
    builtin: true,
    build: () => createBreakerPackDesign({ count: 12, name: "12 路空开起步" }),
  },
  {
    id: "breakers-24",
    name: "24 路空开",
    hint: "24 × iDPN N Vigi C16 · 约 1 排满",
    builtin: true,
    build: () => createBreakerPackDesign({ count: 24, name: "24 路空开起步" }),
  },
  {
    id: "breakers-36",
    name: "36 路空开",
    hint: "36 × iDPN N Vigi C16",
    builtin: true,
    build: () => createBreakerPackDesign({ count: 36, name: "36 路空开起步" }),
  },
  {
    id: "full-demo",
    name: "全屋演示方案",
    hint: "117 源表 · 44 回路 · 教学/对照用",
    builtin: true,
    build: () => createDefaultDesign(),
  },
];

const USER_TPL_KEY = "panel-studio-v5:design-templates";

export function listUserDesignTemplates() {
  try {
    const raw = localStorage.getItem(USER_TPL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeUserTemplates(list) {
  localStorage.setItem(USER_TPL_KEY, JSON.stringify(list.slice(0, 40)));
}

/**
 * 从当前方案抽取可复用设备模板（不含全屋源表负荷）。
 * @param {object} design
 * @param {string} name
 */
export function snapshotDesignTemplate(design, name) {
  const trimmed = String(name || "").trim().slice(0, 80);
  if (!trimmed) throw new Error("请填写模板名称");
  const loadIds = new Set(design.circuits.flatMap((c) => c.loadIds || []));
  const payload = {
    version: 2,
    revision: "simplified",
    name: trimmed,
    cabinet: design.cabinet,
    supply: design.supply,
    earthing: design.earthing,
    mainAmps: design.mainAmps,
    demand: design.demand,
    feedMethod: design.feedMethod,
    feedAmbient: design.feedAmbient,
    feedBunched: design.feedBunched,
    sourceIsc: design.sourceIsc,
    brand: design.brand,
    includeMain: design.includeMain,
    includeSpd: design.includeSpd,
    mainProductId: design.mainProductId,
    spdProductId: design.spdProductId,
    customCabinets: clone(design.customCabinets || []),
    customProducts: clone(design.customProducts || []),
    modules: clone(design.modules || []),
    buses: clone(design.buses || []),
    protectGroups: clone(design.protectGroups || []),
    positions: clone(design.positions || {}),
    uiMode: design.uiMode || 'simple',
    nBarPosition: design.nBarPosition || 'bottom',
    connections: {},
    states: {},
    wireOverrides: {},
    disconnected: [],
    loads: clone((design.loads || []).filter((l) => loadIds.has(l.id))),
    circuits: clone(design.circuits || []).map((c) => ({
      ...c,
      position: null,
      loadIds: (c.loadIds || []).filter((id) => loadIds.has(id)),
    })),
  };
  return {
    id: "USR-TPL-" + crypto.randomUUID(),
    name: trimmed,
    hint: `${payload.circuits.length} 回路 · 箱体 ${payload.cabinet}`,
    builtin: false,
    savedAt: new Date().toISOString(),
    design: payload,
  };
}

export function saveUserDesignTemplate(design, name) {
  const entry = snapshotDesignTemplate(design, name);
  const list = listUserDesignTemplates();
  list.unshift(entry);
  writeUserTemplates(list);
  return entry;
}

export function deleteUserDesignTemplate(id) {
  writeUserTemplates(listUserDesignTemplates().filter((t) => t.id !== id));
}

/**
 * 应用模板并校验。
 * @param {{ builtin?: boolean, id?: string, build?: () => object, design?: object }} tpl
 */
export function materializeTemplate(tpl) {
  let raw;
  if (tpl.builtin && typeof tpl.build === "function") raw = tpl.build();
  else if (tpl.design) raw = clone(tpl.design);
  else throw new Error("无效模板");
  raw.name = tpl.name || raw.name;
  return validateDesign(raw);
}
