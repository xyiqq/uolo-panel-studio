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
    pitch,
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
  if (product.width == null || !Number.isFinite(product.width) || product.width <= 0) {
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
  const current = normalizeCabinet(assembly?.box || cabinets.find(c=>c.id===design?.cabinet) || cabinets[0] || { slots: 24, rows: 6, pitch: 150, depth: 150 });
  const slotWidth = current.slotWidth;
  const spare = Number.isFinite(design?.spareRatio) ? Math.max(0, design.spareRatio) : 0.25;

  let modulesPower = 0;
  let modulesControl = 0;
  let unknownWidth = 0;
  let maxHeight = 0;
  let maxSingleRowHeight = 0;
  let maxDeviceWidth = 0;
  let heightUnknown = 0;
  let depthUnknown = 0;
  let maxDepth = 0;
  let heatW = 0;
  let heatUnknown = 0;

  const nodes = assembly?.nodes || [];
  for (const node of nodes) {
    const product = node.product || {};
    const baseMods = nodeModules(node, slotWidth);
    const mods = baseMods==null?null:baseMods*(product.outletCount?(Number.isFinite(product.height)&&product.height>0?Math.max(1,Math.ceil(product.height/current.pitch)):1):1);
    if (mods == null) {
      unknownWidth += 1;
    } else if (nodeZone(node) === "control") {
      modulesControl += mods;
    } else {
      modulesPower += mods;
    }
    if (Number.isFinite(product.height)&&product.height>0) maxHeight = Math.max(maxHeight, product.height);
    else heightUnknown++;
    if(!product.outletCount||product.pduOrientation!=='vertical')maxSingleRowHeight=Math.max(maxSingleRowHeight,Number(product.height)||0);
    if(Number.isFinite(product.width))maxDeviceWidth=Math.max(maxDeviceWidth,product.width);
    if (Number.isFinite(product.depth)&&product.depth>0) maxDepth = Math.max(maxDepth, product.depth);
    else depthUnknown++;
    if (product.heatW == null || !Number.isFinite(product.heatW) || product.heatW<0) heatUnknown += 1;
    else heatW += product.heatW;
  }

  const totalModules = modulesPower + modulesControl;

  // Each candidate uses its own rail pitch and slot width.
  function rowsFor(cab) {
    const slots = Math.max(1, cab.slots || 24);
    const totals = {power:0, control:0}, spans = {power:0, control:0};
    for (const node of nodes) {
      const p=node.product||{}, zone=nodeZone(node)==='control'?'control':'power';
      const span=p.outletCount&&Number.isFinite(p.height)&&p.height>0?Math.max(1,Math.ceil(p.height/cab.pitch)):1;
      const mods=nodeModules(node,cab.slotWidth);
      if(mods!==null) totals[zone]+=mods*span;
      if(p.outletCount) spans[zone]=Math.max(spans[zone],span);
    }
    const rowsPower=Math.max(spans.power,Math.ceil(totals.power*(1+spare)/slots));
    const rowsControl=Math.max(spans.control,Math.ceil(totals.control*(1+spare)/slots));
    return {rowsPower, rowsControl, rowsNeeded:rowsPower+rowsControl,totalModules:totals.power+totals.control};
  }
  const {rowsPower,rowsControl,rowsNeeded}=rowsFor(current);

  const suggestedInner = {
    width: current.slots * slotWidth + 70,
    height: (current.topRail || 150) + rowsNeeded * current.pitch + 100,
    depth: Math.max(maxDepth + 25, current.depth || 90),
  };

  const recommendationText = `需要 ${rowsNeeded} 排 × ${current.slots}P（含 ${Math.round(spare * 100)}% 备用），器件最大高 ${maxHeight || "—"} mm / 深 ${maxDepth || "—"} mm，建议内部空间 ≥ ${suggestedInner.width}×${suggestedInner.height}×${suggestedInner.depth}（估算）`;

  function evaluate(raw) {
      const cab = normalizeCabinet(raw);
      const need = rowsFor(cab);
      const clearanceOk = !maxSingleRowHeight || cab.rowClearance >= maxSingleRowHeight;
      const depthOk = !maxDepth || cab.maxDeviceDepth >= maxDepth;
      const fits =
        unknownWidth===0 && heightUnknown===0 && depthUnknown===0 &&
        cab.rows >= need.rowsNeeded &&
        cab.slots >= 1 &&
        cab.slots*cab.slotWidth >= maxDeviceWidth &&
        clearanceOk &&
        depthOk;
      const excess = cab.rows * cab.slots - need.totalModules;
      return {
        cabinet: cab,
        fits,
        clearanceOk,
        depthOk,
        dimensionsKnown: unknownWidth===0&&heightUnknown===0&&depthUnknown===0,
        excess,
        rowsNeeded: need.rowsNeeded,
        rowsPower: need.rowsPower,
        rowsControl: need.rowsControl,
      };
  }
  const recommendations = (cabinets || []).map(evaluate)
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
    heightUnknown,
    depthUnknown,
    currentFit: evaluate(current),
    heatW,
    heatUnknown,
    suggestedInner,
    recommendationText,
    recommendations,
    currentCabinetId: current.id ?? design?.cabinet ?? null,
  };
}
