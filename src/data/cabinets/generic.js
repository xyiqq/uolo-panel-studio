/**
 * 通用箱体规格生成器与预置列表（计划 5.5）。
 * 尺寸为估算，须以所选厂家图纸为准。
 */

/**
 * @param {number} rows
 * @param {number} slots
 * @param {number} depth
 * @param {"明装"|"暗装"} [mount]
 */
export function makeGenericCabinet(rows, slots, depth, mount = "明装") {
  const slotWidth = 18;
  const pitch = 150;
  const topRail = 150;
  const width = slots * slotWidth + 70;
  const height = 150 + rows * 150 + 100;
  const outer = [width + 30, height + 30, depth + 18];
  const zonesDefault = Array.from({ length: rows }, (_, i) =>
    i === rows - 1 && rows > 1 ? "control" : "power",
  );

  return {
    id: `GEN-${rows}x${slots}-D${depth}-${mount === "暗装" ? "F" : "S"}`,
    name: `通用 ${rows}×${slots}P · 深${depth} · ${mount}`,
    brand: "通用",
    mount,
    rows,
    slots,
    slotWidth,
    width,
    height,
    depth,
    outer,
    pitch,
    topRail,
    rowClearance: pitch - 45,
    maxDeviceDepth: depth - 25,
    zonesDefault,
    source: "通用估算尺寸，须以所选厂家图纸为准",
    estimated: true,
    priceReference: null,
  };
}

/** 常用规格：约 36 个，避免组合爆炸 */
const PRESET_SPECS = [
  [1, 12],
  [1, 16],
  [1, 18],
  [1, 20],
  [1, 24],
  [2, 12],
  [2, 18],
  [2, 24],
  [3, 24],
  [4, 24],
  [5, 24],
  [6, 24],
];

const PRESET_DEPTHS = [90, 120, 150];

/** @type {ReturnType<typeof makeGenericCabinet>[]} */
export const GENERIC_CABINETS = PRESET_SPECS.flatMap(([rows, slots]) =>
  PRESET_DEPTHS.map((depth) => makeGenericCabinet(rows, slots, depth, "明装")),
);
