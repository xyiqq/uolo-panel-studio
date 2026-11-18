/**
 * BOM 与线材估算（纯函数）
 * 不编造产品参数：器件取自 assembly / design；线长由端子三维坐标推算。
 */

import { productSku, CONDUCTOR_COLORS, matchCircuit } from "./domain.js";
import {buildDeliveryNet} from './delivery-net.js';
import {isCresnetDataBus} from './cresnet.js';

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
  const key = `${item.brand || ""}|${item.sku || item.name}`;
  const prev = map.get(key);
  if (prev) {
    prev.qty += item.qty;
    if (item.note && !prev.note) prev.note = item.note;
  } else {
    map.set(key, { ...item });
  }
}

/** Compacted assemblies pack sub-module terminals by millimetre, so count whole 18 mm gaps per row. */
function blankSlots(assembly) {
  const box = assembly?.box;
  const rows = box?.rows || 0, slots = box?.slots || 0;
  const footprints = assembly?.occupied?.footprints;
  if (!footprints) return Math.max(0, rows * slots - (assembly?.modules || 0));
  let blank = 0;
  for (let row = 0; row < rows; row++) {
    const used = footprints.filter((f) => f.row === row).reduce((sum, f) => sum + (f.right - f.left), 0);
    blank += Math.max(0, Math.floor((slots * 18 - used + 1e-6) / 18));
  }
  return blank;
}

/**
 * @param {object} design
 * @param {object} assembly
 * @param {object} net
 * @returns {{ items: object[], wires: object[] }}
 */
export function buildBom(design, assembly, net) {
  net=buildDeliveryNet(design,assembly,net);
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
  const blank = blankSlots(assembly);
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
    if (w.bridgeJumper) continue; // 随模块提供的固定跨接件，不计入散线长度
    if (w.cresnet || w.rs485) continue; // 一根多芯线按总线行计长。
    // 出箱电缆单独按回路长度估算，不混入箱内
    const isExternal = w.lengthKind === 'external';
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
    const key = `${section}|${color}|${isExternal?'external':'internal'}|${w.class||'power'}`;
    const prev = wireMap.get(key);
    if (prev) prev.meters += meters;
    else
      wireMap.set(key, {
        section,
        color,
        meters,
        note:isExternal?'出箱电缆芯线估算':'箱内连接：端点距离×1.4＋两端预留120mm',
        lengthKind:isExternal?'external':'internal',
        class:w.class||'power',
      });
  }

  // 真实净线止于 X 端子，出箱长度按每回路每根芯线单独且仅统计一次。
  for(const c of design.circuits||[]) {
    if(!(Number(c.length)>0)) continue;
    const external=Object.values(net.ports||{}).filter(p=>p.node===`X-${c.id}`);
    for(const port of external) {
      if(net.wires.some(w=>w.lengthKind==='external'&&w.circuit===c.id&&w.conductor===port.conductor)) continue;
      const wire=net.wires.find(w=>w.to===port.id||w.from===port.id)||net.wires.find(w=>w.circuit===c.id&&w.externalSection!=null);
      const section=wire?.externalSection??c.wire??matchCircuit(design,c).section??null;
      const color=COLOR_NAME[port.conductor]||port.conductor;
      const key=`${section}|${color}|external|power`,prev=wireMap.get(key);
      if(prev) prev.meters+=Number(c.length);
      else wireMap.set(key,{section,color,meters:Number(c.length),lengthKind:'external',class:'power',note:'出箱电缆按回路长度逐芯估算；未填写长度的回路不估算'});
    }
  }

  // 总线电缆（若 design.buses 存在）
  const serialRuns = (design.modules || []).filter(m=>m.rs485Meters?.length && net.wires.some(w=>w.rs485 && w.serialMaster===m.id))
    .map(m=>({id:m.id,type:'rs485',serialMaster:m.id,cableMeters:m.rs485MetersLength,cableSpec:'120 Ω 屏蔽双绞线，含信号参考芯'}));
  for (const b of [...(design.buses || []), ...serialRuns]) {
    const estimated = (isCresnetDataBus(b) || b.serialMaster) && b.cableMeters == null;
    const meters = estimated ? net.wires.filter(w => b.serialMaster
      ? w.serialMaster===b.id && w.conductor==='RS485-A' : w.cresnet && w.busId === b.id && w.conductor === 'Y')
      .reduce((sum, w) => sum + wireLengthMeters(net, w), 0) : Number(b.cableMeters);
    if (meters > 0) {
      const key = `bus|${b.type || b.id || "bus"}|${b.section??""}|${b.cableSpec||""}`;
      const previous=wireMap.get(key);
      wireMap.set(key, {
        section: b.section || "总线",
        color: b.type || "总线",
        meters: (previous?.meters||0)+meters,
        ...(estimated || previous?.estimatedBusLength ? {estimatedBusLength:true} : {}),
        note:(estimated?'整缆按连接端点估算':'总线电缆手动填写长度')+(b.cableSpec?' · '+b.cableSpec:''),
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
