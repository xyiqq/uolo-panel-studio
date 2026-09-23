/**
 * 优诺（UOLO）线槽箱标准，取自《0A-UOLO东边套（主图2024.04.20）》图块「配电箱76…160」1:1 实测：
 * - 内部安装板四周及每两排导轨之间为 40 mm 线槽，线槽之间为安装区，导轨位于安装区正中；
 * - 安装区宽 = 内部宽 − 2×线槽；排数按每排约 176.7 mm（安装区 136.7 + 线槽 40）排满，余量均分到各排；
 * - 外形 = 内部 + 边距，图中左右边距多为 35 mm、上下多为 45 mm。
 * 图纸只有正视尺寸，箱体深度与线槽深度为待核默认值。
 */

export const DUCT_STANDARD = {
  ductWidth: 40,
  rowPitch: 176.7,
  sideMargin: 35,
  endMargin: 45,
  depth: 150,
  ductDepth: 60,
  minZoneHeight: 100,
};

export function suggestDuctRows(innerHeight, { ductWidth = DUCT_STANDARD.ductWidth, rowPitch = DUCT_STANDARD.rowPitch } = {}) {
  return Math.max(1, Math.round((innerHeight - ductWidth) / rowPitch));
}

/**
 * @param {{innerWidth:number, innerHeight:number, rows?:number, sideMargin?:number, endMargin?:number,
 *   depth?:number, ductDepth?:number, ductWidth?:number, mount?:string, id?:string, name?:string}} spec
 */
export function makeDuctCabinet(spec) {
  const s = { ...DUCT_STANDARD, mount: "明装", ...spec };
  const { innerWidth: width, innerHeight: height, ductWidth, depth } = s;
  if (![width, height, depth, ductWidth, s.sideMargin, s.endMargin, s.ductDepth].every(Number.isFinite)) throw new Error("线槽箱尺寸需填写数字");
  const rows = Number.isInteger(s.rows) && s.rows > 0 ? s.rows : suggestDuctRows(height, s);
  const zoneWidth = width - 2 * ductWidth;
  const zoneHeight = (height - ductWidth * (rows + 1)) / rows;
  const slots = Math.floor(zoneWidth / 18);
  if (slots < 6) throw new Error(`内部宽 ${width} mm 扣除两侧线槽后不足 6P`);
  if (zoneHeight < s.minZoneHeight) throw new Error(`内部高 ${height} mm 放 ${rows} 排时每排安装区仅 ${zoneHeight.toFixed(1)} mm，需减少排数或加高箱体`);
  const pitch = zoneHeight + ductWidth;
  const tag = `${Math.round(width / 10)}cm/${Math.round(height / 10)}cm`;
  const outer = [width + 2 * s.sideMargin, height + 2 * s.endMargin, depth + 20];
  return {
    id: s.id || `UOLO-${Math.round(width / 10)}x${Math.round(height / 10)}-R${rows}`,
    name: s.name || `优诺线槽箱 · ${tag} · ${rows} 排`,
    brand: "优诺",
    mount: s.mount,
    rows,
    slots,
    slotWidth: 18,
    width,
    height,
    depth,
    outer,
    pitch,
    topRail: ductWidth + zoneHeight / 2,
    rowClearance: zoneHeight,
    maxDeviceDepth: depth - 25,
    zonesDefault: Array.from({ length: rows }, (_, i) => (i === rows - 1 && rows > 1 ? "control" : "power")),
    wireDucts: { width: ductWidth, depth: s.ductDepth, zoneWidth, zoneHeight },
    source: `优诺线槽箱标准：内部 ${width}×${height} mm、外形 ${outer[0]}×${outer[1]} mm、线槽 ${ductWidth} mm；深度 ${depth} mm、线槽深 ${s.ductDepth} mm 待核`,
    estimated: false,
    priceReference: null,
  };
}

/** Drawing blocks: [inner height, side margin, end margin]; inner width is 630 throughout. */
const DRAWING_PRESETS = [[760, 45, 45], [930, 35, 45], [1100, 35, 45], [1270, 35, 45], [1450, 35, 40], [1600, 45, 45]];

export const UOLO_CABINETS = DRAWING_PRESETS.map(([innerHeight, sideMargin, endMargin]) =>
  makeDuctCabinet({ innerWidth: 630, innerHeight, sideMargin, endMargin, id: `UOLO-63x${Math.round(innerHeight / 10)}` }));

/** Keep a saved custom cabinet's duct geometry only when it is internally consistent. */
export function sanitizeWireDucts(cab) {
  const d = cab?.wireDucts;
  if (!d) return cab;
  const ok = [d.width, d.depth, d.zoneWidth, d.zoneHeight].every((n) => Number.isFinite(n) && n > 0)
    && d.width <= 120 && d.depth <= 200
    && Math.abs(d.zoneWidth - (cab.width - 2 * d.width)) < 0.5
    && Math.abs(cab.pitch - (d.zoneHeight + d.width)) < 0.5
    && Math.abs(cab.topRail - (d.width + d.zoneHeight / 2)) < 0.5;
  if (ok) return cab;
  const { wireDucts, ...rest } = cab;
  return rest;
}
