/**
 * 箱体库汇总：玛德克 + 通用估算 + 方案自定义。
 */
import { CABINETS as MADEK_CABINETS } from "./madek.js";
import { GENERIC_CABINETS, makeGenericCabinet } from "./generic.js";
import { UOLO_CABINETS } from "./uolo.js";

/**
 * 为玛德克条目补齐 V5 可选字段（不改动原数据源文件内容语义）。
 * @param {object} cab
 */
function enrichMadek(cab) {
  const pitch = cab.pitch ?? 175;
  const depth = cab.depth ?? 150;
  return {
    ...cab,
    brand: cab.brand || "玛德克",
    slotWidth: cab.slotWidth ?? 18,
    rowClearance: cab.rowClearance ?? pitch - 45,
    maxDeviceDepth: cab.maxDeviceDepth ?? depth - 25,
    estimated: cab.estimated ?? false,
    zonesDefault:
      cab.zonesDefault ||
      Array.from({ length: cab.rows }, (_, i) =>
        i === cab.rows - 1 && cab.rows > 1 ? "control" : "power",
      ),
  };
}

/** @type {Record<string, object>} */
export const CABINETS = Object.fromEntries(
  Object.entries(MADEK_CABINETS).map(([id, cab]) => [id, enrichMadek(cab)]),
);

export { GENERIC_CABINETS, makeGenericCabinet, UOLO_CABINETS };

/**
 * 合并内置、通用与方案自定义箱体为列表。
 * @param {object} [design]
 * @returns {object[]}
 */
export function allCabinets(design) {
  const custom = Array.isArray(design?.customCabinets) ? design.customCabinets : [];
  return [...Object.values(CABINETS), ...UOLO_CABINETS, ...GENERIC_CABINETS, ...custom];
}

/**
 * 按 id 查找箱体（含自定义）。
 * @param {string} id
 * @param {object} [design]
 */
export function findCabinet(id, design) {
  if (CABINETS[id]) return CABINETS[id];
  const uolo = UOLO_CABINETS.find((c) => c.id === id);
  if (uolo) return uolo;
  const generic = GENERIC_CABINETS.find((c) => c.id === id);
  if (generic) return generic;
  return (design?.customCabinets || []).find((c) => c.id === id) || null;
}
