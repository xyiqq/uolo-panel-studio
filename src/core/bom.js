/**
 * BOM 与线材估算（纯函数）
 * 不编造产品参数：器件取自 assembly / design；线长由端子三维坐标推算。
 */

import { productSku, CONDUCTOR_COLORS } from "./domain.js";

const COLOR_NAME = {
  L1: "黄",
  L2: "绿",
  L3: "红",
  N: "蓝",
  PE: "黄绿",
};

function portOf(net, id) {
  return net?.ports?.[id] || null;
}

function distMm(a, b) {
  if (!a || !b) return 0;
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function wireLengthMeters(net, wire) {
  const from = portOf(net, wire.from);
  const to = portOf(net, wire.to);
  const mm = distMm(from, to) * 1.4 + 120;
  return mm / 1000;
}

function addItem(map, item) {
  const key = item.sku || item.name;
  const prev = map.get(key);
  if (prev) {
    prev.qty += item.qty;
    if (item.note && !prev.note) prev.note = item.note;
  } else {
    map.set(key, { ...item });
  }
}

/**
 * @param {object} design
 * @param {object} assembly
 * @param {object} net
 * @returns {{ items: object[], wires: object[] }}
 */
export function buildBom(design, assembly, net) {
  const itemMap = new Map();
  const wireMap = new Map();

  // 器件：按 productId / sku 合并
  for (const node of assembly?.nodes || []) {
    const p = node.product;
    if (!p) continue;
    addItem(itemMap, {
      sku: productSku(p) || p.id || node.id,
      name: p.name || node.label || node.id,
      brand: p.brand || "",
      qty: 1,
      note: p.note || "",
    });
  }

  // 箱体
  const box = assembly?.box;
  if (box) {
    addItem(itemMap, {
      sku: box.id || "CABINET",
      name: box.name || "配电箱体",
      brand: "",
      qty: 1,
      note: box.source || "",
    });
  }

  // 导轨
  const rows = box?.rows || 0;
  if (rows > 0) {
    addItem(itemMap, {
      sku: "DIN-RAIL",
      name: "DIN 导轨",
      brand: "",
      qty: rows,
      note: `${box?.slots || ""} 模位/排`,
    });
  }

  // N / PE 排
  addItem(itemMap, {
    sku: "N-BAR",
    name: "N 端子排",
    brand: "",
    qty: design.includeNeutralBar===false?0:1,
    note: "",
  });
  addItem(itemMap, {
    sku: "PE-BAR",
    name: "PE 端子排",
    brand: "",
    qty: design.includeEarthBar===false?0:1,
    note: "",
  });

  // 出箱端子：按回路导体孔位计数
  let outletPoles = 0;
  for (const c of design?.circuits || []) {
    const ports = Object.values(net?.ports || {}).filter(
      (p) => p.node === `X-${c.id}`,
    );
    outletPoles += ports.length || 0;
  }
  if (outletPoles > 0) {
    addItem(itemMap, {
      sku: "X-TERM",
      name: "出箱端子",
      brand: "",
      qty: outletPoles,
      note: "按回路导体孔位",
    });
  }

  // 盖板：空模位
  const totalSlots = (box?.rows || 0) * (box?.slots || 0);
  const used = assembly?.modules || 0;
  const blank = Math.max(0, totalSlots - used);
  if (blank > 0) {
    addItem(itemMap, {
      sku: "BLANK-COVER",
      name: "空白盖板（模位）",
      brand: "",
      qty: blank,
      note: "",
    });
  }

  // 号码管：导线数 × 2
  const wireCount = (net?.wires || []).length;
  if (wireCount > 0) {
    addItem(itemMap, {
      sku: "WIRE-MARKER",
      name: "号码管",
      brand: "",
      qty: wireCount * 2,
      note: "两端各一",
    });
  }

  // 箱内导线按截面×颜色汇总
  for (const w of net?.wires || []) {
    // 出箱电缆单独按回路长度估算，不混入箱内
    const isExternal =
      w.scope === "负载出线" ||
      w.scope === "回路独立 PE 端子" ||
      (w.externalSection != null && w.circuit);
    let meters;
    if (isExternal && w.circuit) {
      // 出箱段：用回路 length（m）计一次芯线；同回路多芯在下方按芯汇总
      // 此处仍按单根导体计入，长度为回路 length
      const circuit = (design.circuits || []).find((c) => c.id === w.circuit);
      meters = circuit?.length != null ? Number(circuit.length) : 0;
    } else {
      meters = wireLengthMeters(net, w);
    }
    if (!(meters > 0)) continue;
    const section = w.section != null ? w.section : w.autoSection;
    const cond = w.conductor || "";
    const color =
      COLOR_NAME[cond] ||
      (CONDUCTOR_COLORS[cond] ? cond : cond || "未标明");
    const key = `${section}|${color}`;
    const prev = wireMap.get(key);
    if (prev) prev.meters += meters;
    else
      wireMap.set(key, {
        section,
        color,
        meters,
      });
  }

  // 总线电缆（若 design.buses 存在）
  for (const b of design?.buses || []) {
    if (b.cableMeters != null && b.cableMeters > 0) {
      const key = `bus|${b.type || b.id || "bus"}`;
      wireMap.set(key, {
        section: b.section || "总线",
        color: b.type || "总线",
        meters: Number(b.cableMeters),
      });
    }
  }

  const items = [...itemMap.values()].filter(item=>item.qty>0);
  const wires = [...wireMap.values()].map((w) => ({
    ...w,
    meters: Math.round(w.meters * 1000) / 1000,
  }));

  return { items, wires };
}
