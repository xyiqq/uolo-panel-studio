/**
 * 空间计算器（计划 P1-6）。
 * width 为 null 的器件计入 unknownWidth，不参与模位合计。
 */

const DEFAULT_SLOT_WIDTH = 18;

/**
 * @param {object} cabinet
 */
function normalizeCabinet(cabinet) {
  const slotWidth = cabinet.slotWidth ?? DEFAULT_SLOT_WIDTH;
  const pitch = cabinet.pitch ?? 150;
  const depth = cabinet.depth ?? 0;
  return {
    ...cabinet,
    slotWidth,
    rowClearance: cabinet.rowClearance ?? pitch - 45,
    maxDeviceDepth: cabinet.maxDeviceDepth ?? Math.max(0, depth - 25),
    estimated: cabinet.estimated ?? false,
  };
}

/**
 * 节点占用模位数：优先 modules，否则 ceil(width/slotWidth)；width/modules 皆未知则返回 null。
 */
function nodeModules(node, slotWidth) {
  const product = node.product || {};
  if (Number.isFinite(product.modules) && product.modules > 0) {
    return product.modules;
  }
  if (product.width == null || !Number.isFinite(product.width)) {
    return null;
  }
  return Math.ceil(product.width / slotWidth);
}

function nodeZone(node) {
  return node.zone || node.product?.zone || "power";
}

/**
 * @param {object} design
 * @param {object} assembly
 * @param {object[]} cabinets
 */
export function computeSpace(design, assembly, cabinets = []) {
  const current = normalizeCabinet(assembly?.box || cabinets[0] || { slots: 24, rows: 6, pitch: 150, depth: 150 });
  const slotWidth = current.slotWidth;
  const spare = Number.isFinite(design?.spareRatio) ? design.spareRatio : 0.25;

  let modulesPower = 0;
  let modulesControl = 0;
  let unknownWidth = 0;
  let maxHeight = 0;
  let maxDepth = 0;
  let heatW = 0;
  let heatUnknown = 0;

  const nodes = assembly?.nodes || [];
  for (const node of nodes) {
    const product = node.product || {};
    const mods = nodeModules(node, slotWidth);
    if (mods == null) {
      unknownWidth += 1;
    } else if (nodeZone(node) === "control") {
      modulesControl += mods;
    } else {
      modulesPower += mods;
    }
    if (Number.isFinite(product.height)) maxHeight = Math.max(maxHeight, product.height);
    if (Number.isFinite(product.depth)) maxDepth = Math.max(maxDepth, product.depth);
    if (product.heatW == null || !Number.isFinite(product.heatW)) heatUnknown += 1;
    else heatW += product.heatW;
  }

  const totalModules = modulesPower + modulesControl;

  function rowsFor(slots) {
    const s = Math.max(1, slots || 24);
    const rowsPower = Math.ceil((modulesPower * (1 + spare)) / s);
    const rowsControl =
      modulesControl > 0 ? Math.ceil((modulesControl * (1 + spare)) / s) : 0;
    return { rowsPower, rowsControl, rowsNeeded: rowsPower + rowsControl, slots: s };
  }

  const base = rowsFor(current.slots);
  const { rowsPower, rowsControl, rowsNeeded } = base;

  const suggestedInner = {
    width: current.slots * slotWidth + 70,
    height: 150 + rowsNeeded * 150 + 100,
    depth: Math.max(maxDepth + 25, current.depth || 90),
  };

  const recommendationText = `需要 ${rowsNeeded} 排 × ${current.slots}P（含 ${Math.round(spare * 100)}% 备用），器件最大高 ${maxHeight || "—"} mm / 深 ${maxDepth || "—"} mm，建议内部空间 ≥ ${suggestedInner.width}×${suggestedInner.height}×${suggestedInner.depth}（估算）`;

  const recommendations = (cabinets || [])
    .map((raw) => {
      const cab = normalizeCabinet(raw);
      const need = rowsFor(cab.slots);
      const clearanceOk = !maxHeight || cab.rowClearance >= maxHeight;
      const depthOk = !maxDepth || cab.maxDeviceDepth >= maxDepth;
      const fits =
        cab.rows >= need.rowsNeeded &&
        cab.slots >= 1 &&
        clearanceOk &&
        depthOk;
      const excess = cab.rows * cab.slots - totalModules;
      return {
        cabinet: cab,
        fits,
        excess,
        rowsNeeded: need.rowsNeeded,
        rowsPower: need.rowsPower,
        rowsControl: need.rowsControl,
      };
    })
    .sort((a, b) => {
      if (a.fits !== b.fits) return a.fits ? -1 : 1;
      if (a.excess !== b.excess) return a.excess - b.excess;
      if (a.cabinet.estimated !== b.cabinet.estimated) {
        return a.cabinet.estimated ? 1 : -1;
      }
      return String(a.cabinet.id).localeCompare(String(b.cabinet.id));
    });

  return {
    modulesPower,
    modulesControl,
    totalModules,
    unknownWidth,
    spare,
    rowsPower,
    rowsControl,
    rowsNeeded,
    maxHeight,
    maxDepth,
    heatW,
    heatUnknown,
    suggestedInner,
    recommendationText,
    recommendations,
    currentCabinetId: current.id ?? design?.cabinet ?? null,
  };
}
