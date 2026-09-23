/**
 * 共享模块（P1-4）：纯函数 CRUD / 通道分配 / 器件链同步。
 * 方案仍可保持 version:2；modules/buses 作为可选扩展字段归一化。
 */

import { rowAllows } from './row-zones.js';
import { normalizeSwitchSettings } from './network-switch-settings.js';
import { normalizePduSettings } from './pdu-settings.js';
import {canPlaceFootprint,reserveFootprint,placementY,placementWidth,placementColumns,usePhysicalOccupancy} from './placement-footprint.js';

export const SHARED_MODULE_KINDS = [
  "pdu",
  "relay",
  "dimmer",
  "contactor",
  "timer",
  "meter",
  "gateway",
  "psu",
  "terminal",
];

const KIND_PREFIX = {
  pdu: "PDU",
  relay: "K",
  contactor: "K",
  timer: "K",
  dimmer: "D",
  meter: "WH",
  gateway: "GW",
  psu: "PS",
  terminal: "T",
};

export function isSharedModuleKind(kind) {
  return SHARED_MODULE_KINDS.includes(kind);
}

/** @param {string} kind */
export function moduleIdPrefix(kind) {
  return KIND_PREFIX[kind] || "M";
}

export function validateIpAddress(value) {
  const ip=String(value ?? '').trim();
  if(!ip) return '';
  if(/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ip.split('.').every(n=>Number(n)<=255)) return ip.split('.').map(Number).join('.');
  if(ip.includes(':') && /^[0-9a-f:]+$/i.test(ip)) {
    try { return new URL(`http://[${ip}]/`).hostname.slice(1,-1); } catch { /* Invalid IPv6. */ }
  }
  throw new Error('请输入有效的 IPv4 或 IPv6 地址');
}

export function isNetworkModule(product) {
  return product?.kind==='gateway' || product?.protocol?.includes('rs485');
}

export function moduleAddressMode(module={}) {
  if(['none','id','ip','both'].includes(module.addressMode)) return module.addressMode;
  return module.hardwareId ? (module.ipAddress ? 'both' : 'id') : module.ipAddress ? 'ip' : 'none';
}
export function visibleModuleAddress(module={}) {
  const mode=moduleAddressMode(module);
  return {hardwareId:['id','both'].includes(mode)?module.hardwareId||'':'',ipAddress:['ip','both'].includes(mode)?module.ipAddress||'':''};
}
export function setModuleAddressMode(design,moduleId,mode) {
  if(!['none','id','ip','both'].includes(mode)) throw new Error('无效地址类型');
  const module=design.modules.find(m=>m.id===moduleId);
  if(!module) throw new Error('模块不存在');
  if(['id','both'].includes(mode)) validateHardwareId(design,moduleId,module.hardwareId);
  if(['ip','both'].includes(mode)) validateIpAddress(module.ipAddress);
  module.addressMode=mode;
}

export function validateHardwareId(design, moduleId, value) {
  const id=String(value ?? '').trim().toUpperCase();
  if(!id) return '';
  if(!/^[0-9A-F]{2}$/.test(id)) throw new Error('模块 ID 必须是两位十六进制，例如 01 或 0E');
  const owner=(design.modules || []).find(m=>m.id!==moduleId && ['id','both'].includes(moduleAddressMode(m)) && String(m.hardwareId || '').trim().toUpperCase()===id);
  if(owner) throw new Error(`ID ${id} 已被 ${owner.id}（${owner.label || owner.id}）使用`);
  return id;
}

/**
 * @param {object} design
 * @param {string} kind
 */
export function nextModuleId(design, kind) {
  const prefix = moduleIdPrefix(kind);
  const used = new Set((design?.modules || []).map((m) => m.id));
  for (let i = 1; ; i++) {
    const id = `${prefix}${i}`;
    if (!used.has(id)) return id;
  }
}

/**
 * @param {number} channelCount
 * @param {Record<string|number, string|null>|null} [existing]
 */
export function emptyChannels(channelCount, existing = null) {
  const n = Math.max(0, Math.floor(Number(channelCount) || 0));
  /** @type {Record<number, string|null>} */
  const out = {};
  for (let i = 1; i <= n; i++) {
    const prev = existing?.[i] ?? existing?.[String(i)];
    out[i] = typeof prev === "string" && prev ? prev : null;
  }
  return out;
}

/**
 * @param {number} channelCount
 * @param {Record<string|number, string>|null} [existing]
 */
export function emptyChannelLabels(channelCount, existing = null) {
  const n = Math.max(0, Math.floor(Number(channelCount) || 0));
  /** @type {Record<number, string>} */
  const out = {};
  for (let i = 1; i <= n; i++) {
    const prev = existing?.[i] ?? existing?.[String(i)];
    out[i] = typeof prev === "string" ? prev.trim().slice(0, 80) : "";
  }
  return out;
}

/**
 * @param {object} raw
 * @param {{ channels?: number }} [product]
 */
export function normalizeModule(raw, product = null) {
  if (!raw || typeof raw !== "object") throw new Error("模块不是对象");
  if (typeof raw.id !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,11}$/.test(raw.id)) {
    throw new Error("模块 id 不合法");
  }
  if (typeof raw.productId !== "string" || !raw.productId) {
    throw new Error("模块缺少 productId");
  }
  const feed = ["shared", "perChannel", "none"].includes(raw.feed) ? raw.feed : "none";
  const chCount = Number.isFinite(product?.channels)
    ? product.channels
    : Object.keys(raw.channels || {}).length || 0;
  const channels = emptyChannels(chCount, raw.channels || {});
  const channelLabels = emptyChannelLabels(chCount, raw.channelLabels || {});
  /** @type {Record<number, string|null>} */
  const channelTerminals = {};
  for (let i = 1; i <= chCount; i++) {
    const prev = raw.channelTerminals?.[i] ?? raw.channelTerminals?.[String(i)];
    channelTerminals[i] = typeof prev === "string" && prev ? prev : null;
  }
  let position = null;
  if (
    raw.position &&
    Number.isInteger(raw.position.row) &&
    Number.isInteger(raw.position.slot)
  ) {
    position = { row: raw.position.row, slot: raw.position.slot };
  }
  return {
    id: raw.id,
    productId: raw.productId,
    ...(product?.networkPorts?normalizeSwitchSettings(raw,product):{}),
    ...(product?.outletCount?normalizePduSettings(raw,product):{}),
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, 40) : raw.id,
    busId: typeof raw.busId === "string" && raw.busId ? raw.busId : null,
    feed,
    feedCircuitId:
      typeof raw.feedCircuitId === "string" && raw.feedCircuitId ? raw.feedCircuitId : null,
    channels,
    channelLabels,
    channelTerminals,
    addressMode: moduleAddressMode(raw),
    displayName: typeof raw.displayName === 'string' ? raw.displayName.trim().slice(0,40) : '',
    hardwareId: typeof raw.hardwareId === 'string' && /^[0-9a-f]{2}$/i.test(raw.hardwareId.trim()) ? raw.hardwareId.trim().toUpperCase() : '',
    ipAddress: typeof raw.ipAddress === 'string' ? raw.ipAddress.trim().slice(0,45) : '',
    terminalConnections: raw.terminalConnections && typeof raw.terminalConnections === 'object'
      ? structuredClone(raw.terminalConnections) : {},
    /** 端子关联的继电器模块通道：{ moduleId, channel } */
    linkModuleId: typeof raw.linkModuleId === "string" && raw.linkModuleId ? raw.linkModuleId : null,
    linkChannel: Number.isFinite(+raw.linkChannel) && +raw.linkChannel > 0 ? +raw.linkChannel : null,
    protectId: typeof raw.protectId === "string" && raw.protectId ? raw.protectId : null,
    position,
  };
}

/**
 * @param {object} design
 * @param {(id:string)=>object|null} findProduct
 */
export function normalizeModules(design, findProduct) {
  if (!Array.isArray(design.modules)) {
    design.modules = [];
    return design.modules;
  }
  const out = [];
  for (const raw of design.modules) {
    try {
      const product = findProduct ? findProduct(raw.productId) : null;
      out.push(normalizeModule(raw, product));
    } catch (err) {
      console.warn(`已丢弃非法模块 ${raw?.id ?? "(无 id)"}：${err?.message || err}`);
    }
  }
  design.modules = out;
  return out;
}


/** Place automatic modules in the first available slots, independent of wiring links. */
export function compactModulePlacement(assembly, design) {
  if (!assembly?.nodes || !assembly?.box) return assembly;
  const nodes = assembly.nodes.filter((node) => node.role === "module" && node.module);
  if (!nodes.length) return assembly;
  const byId = new Map(nodes.map(node => [node.id,node]));
  const ordered = [...(design?.modules || []).map(m=>byId.get(m.id)),...nodes].filter((n,i,list)=>n&&list.indexOf(n)===i);
  const {box,occupied}=assembly;
  usePhysicalOccupancy(occupied,new Set(nodes.map(n=>n.id)));
  const placed=[];
  const sameGroup=(a,b)=>!a.product.outletCount&&!b.product.outletCount&&(a.product.kind==='terminal')===(b.product.kind==='terminal');
  const can=(n,pos)=>canPlaceFootprint(design,n.product,box,occupied,pos,n.id);
  const adjacent=(n,pos)=>{
    if(occupied.footprints.some(f=>!byId.has(f.id)&&f.row===pos.row&&f.left<pos.slot*18+placementWidth(n.product)&&f.right>pos.slot*18))return pos;
    const previous=placed.findLast(p=>p.row===pos.row&&p.slot+placementColumns(p.product)===pos.slot&&sameGroup(p,n));
    if(!previous)return pos;
    const packed={...pos,left:previous.x+placementWidth(previous.product)/2+box.slots*9};
    return can(n,packed)?packed:pos;
  };
  const put=(n,pos,pinned)=>{
    reserveFootprint(n.product,box,occupied,pos,n.id);
    Object.assign(n,{row:pos.row,slot:pos.slot,x:(pos.left??pos.slot*18)-box.slots*9+placementWidth(n.product)/2,y:placementY(n.product,box,pos.row),pinned,overflow:false,placementError:false});
    placed.push(n);
  };
  // Complete each old adjacent run before inserting a new anchor into space it released.
  // Sorting roots preserves runs even if the module list is not in installation order.
  const fixed=ordered.map(n=>({n,pos:design.positions?.[n.id]||n.module.position||(n.pinned?{row:n.row,slot:n.slot}:null)})).filter(f=>f.pos);
  const successors=f=>fixed.filter(next=>next.pos.row===f.pos.row&&next.pos.slot===f.pos.slot+placementColumns(f.n.product)&&sameGroup(f.n,next.n));
  const lengths=new Map();
  const runLength=f=>{
    if(!lengths.has(f))lengths.set(f,1+Math.max(0,...successors(f).map(runLength)));
    return lengths.get(f);
  };
  const pending=new Set(fixed);
  for(const root of [...fixed].sort((a,b)=>a.pos.row-b.pos.row||a.pos.slot-b.pos.slot||runLength(b)-runLength(a))){
    let current=root;
    while(current&&pending.has(current)){
      pending.delete(current);
      const {n,pos:saved}=current,pos=adjacent(n,saved);
      if(can(n,pos))put(n,pos,true);
      current=successors(current).filter(f=>pending.has(f)).sort((a,b)=>runLength(b)-runLength(a))[0];
    }
  }
  for(const n of ordered){
    if(placed.includes(n))continue;
    let found=null;
    for(let row=0;row<box.rows&&!found;row++)for(let slot=0;slot<box.slots&&!found;slot++){
      if(placed.some(p=>p.row===row&&p.slot===slot))continue;
      const pos=adjacent(n,{row,slot});
      if(can(n,pos))found=pos;
    }
    if(found)put(n,found,false);
    else Object.assign(n,{row:box.rows,slot:0,overflow:true,placementError:true,pinned:false});
  }
  // Terminals share a physical rail strip. Integer anchors must not introduce
  // gaps between adjacent gray/blue groups after free-space placement.
  for(let row=0;row<box.rows;row++){
    const line=placed.filter(n=>n.row===row).sort((a,b)=>a.x-b.x);
    for(let i=1;i<line.length;i++){
      const previous=line[i-1],current=line[i];
      if(previous.product.kind!=='terminal'||current.product.kind!=='terminal')continue;
      const left=previous.x+placementWidth(previous.product)/2+box.slots*9;
      const oldLeft=current.x-placementWidth(current.product)/2+box.slots*9;
      const blocked=occupied.footprints.some(f=>f.row===row&&f.id!==current.id&&f.id!==previous.id&&f.left<oldLeft-1e-7&&f.right>left+1e-7);
      const pos={row,slot:current.slot,left};
      if(!blocked&&can(current,pos)){
        reserveFootprint(current.product,box,occupied,pos,current.id);
        current.x=left-box.slots*9+placementWidth(current.product)/2;
      }
    }
  }
  return assembly;
}

/**
 * @param {object} design
 */
export function normalizeBuses(design) {
  if (!Array.isArray(design.buses)) {
    design.buses = [];
    return design.buses;
  }
  design.buses = design.buses
    .filter((b) => b && typeof b.id === "string" && b.id)
    .map((b) => ({
      id: b.id,
      type: b.type || "dc",
      label: typeof b.label === "string" && b.label ? b.label : b.id,
      psuModuleIds: Array.isArray(b.psuModuleIds) ? b.psuModuleIds.filter(Boolean) : [],
      deviceModuleIds: Array.isArray(b.deviceModuleIds) ? b.deviceModuleIds.filter(Boolean) : [],
      voltage: Number.isFinite(b.voltage) ? b.voltage : null,
      section: typeof b.section==='string'?b.section.trim().slice(0,80):Number.isFinite(b.section)&&b.section>0?b.section:null,
      cableSpec:typeof b.cableSpec==='string'?b.cableSpec.trim().slice(0,100):'',
      cableMeters:Number.isFinite(b.cableMeters)&&b.cableMeters>=0?b.cableMeters:null,
      budgetUnit: b.budgetUnit === "W" ? "W" : "mA",
      capacity: Number.isFinite(b.capacity) ? b.capacity : null,
      maxDevices: Number.isFinite(b.maxDevices) ? b.maxDevices : null,
      segregation: ["SELV", "FELV", "none"].includes(b.segregation) ? b.segregation : "none",
    }));
  return design.buses;
}

/**
 * 按产品 kind 把模块通道写入回路 devices（保留 protection/rcd）。
 * @param {object} design
 * @param {(id:string)=>object|null} findProduct
 */
export function syncCircuitDevices(design, findProduct) {
  const modules = design.modules || [];
  const byCircuit = new Map();
  for (const mod of modules) {
    const product = findProduct?.(mod.productId);
    if (product?.kind === "terminal") continue;
    const role = product?.kind === "meter" ? "meter" : "control";
    for (const [ch, circuitId] of Object.entries(mod.channels || {})) {
      if (!circuitId) continue;
      const channel = Number(ch);
      if (!Number.isFinite(channel)) continue;
      if (!byCircuit.has(circuitId)) byCircuit.set(circuitId, []);
      byCircuit.get(circuitId).push({ role, moduleId: mod.id, channel });
    }
  }
  for (const c of design.circuits || []) {
    let base = Array.isArray(c.devices)
      ? c.devices.filter((d) => d.role === "protection" || d.role === "rcd")
      : null;
    if (!base) {
      base = [{ role: "protection", productId: c.productId ?? null }];
      if (c.rcdProductId) base.push({ role: "rcd", productId: c.rcdProductId });
    }
    const extras = byCircuit.get(c.id) || [];
    const saved=new Map((c.devices||[]).filter(d=>d.moduleId).map((d,i)=>[`${d.moduleId}:${d.channel}`,i]));
    extras.sort((a,b)=>(saved.get(`${a.moduleId}:${a.channel}`)??Infinity)-(saved.get(`${b.moduleId}:${b.channel}`)??Infinity)
      || (a.role==='meter')-(b.role==='meter') || a.channel-b.channel || a.moduleId.localeCompare(b.moduleId));
    c.devices = [...base, ...extras];
  }
  return design;
}

/**
 * 删除回路时释放所有通道引用，并清 feedCircuitId。
 * @param {object} design
 * @param {string} circuitId
 */
export function releaseCircuitFromModules(design, circuitId) {
  if (!Array.isArray(design.modules)) return design;
  for (const mod of design.modules) {
    if (mod.feedCircuitId === circuitId) mod.feedCircuitId = null;
    for (const ch of Object.keys(mod.channels || {})) {
      if (mod.channels[ch] === circuitId) mod.channels[ch] = null;
    }
  }
  return design;
}

/**
 * 删除模块时从总线索引与回路 devices 摘除。
 * @param {object} design
 * @param {string} moduleId
 */
export function removeModule(design, moduleId) {
  design.modules = (design.modules || []).filter((m) => m.id !== moduleId);
  for (const bus of design.buses || []) {
    bus.psuModuleIds = (bus.psuModuleIds || []).filter((id) => id !== moduleId);
    bus.deviceModuleIds = (bus.deviceModuleIds || []).filter((id) => id !== moduleId);
  }
  for (const c of design.circuits || []) {
    if (Array.isArray(c.devices)) {
      c.devices = c.devices.filter((d) => d.moduleId !== moduleId);
    }
  }
  if (design.positions && typeof design.positions === "object") {
    delete design.positions[moduleId];
  }
  if (Array.isArray(design.protectGroups)) {
    for (const g of design.protectGroups) {
      g.moduleIds = (g.moduleIds || []).filter((id) => id !== moduleId);
    }
    design.protectGroups = design.protectGroups.filter(
      (g) => (g.moduleIds || []).length > 0 || g.breakerNodeId
    );
  }
  return design;
}

/**
 * 建议的智控电源回路草稿（不自动写入）。
 */
export function suggestSmartFeedCircuit(design) {
  const used = new Set((design.circuits || []).map((c) => c.id));
  let id = "C-SMART";
  if (used.has(id)) {
    for (let i = 1; i < 100; i++) {
      id = `C-SMART${i}`;
      if (!used.has(id)) break;
    }
  }
  return {
    id,
    name: "智控电源",
    group: "smart",
    path: "智能控制 / 模块取电",
    loadIds: [],
    voltage: 220,
    phase: "L1",
    pf: 0.8,
    method: "B2",
    ambient: 30,
    bunched: 1,
    length: 5,
    wire: null,
    productId: null,
    rcdProductId: null,
    on: true,
    position: null,
  };
}

/**
 * @param {string[]} protocols
 */
export function inferBusType(protocols = []) {
  const p = (protocols || []).map((x) => String(x).toLowerCase());
  if (p.includes("knx")) return "knx";
  if (p.includes("dali")) return "dali";
  if (p.includes("cresnet")) return "cresnet";
  if (p.includes("qslink")) return "qslink";
  if (p.includes("rs485")) return "rs485";
  if (p.includes("0-10v") || p.includes("0_10v")) return "0-10v";
  return "dc";
}

export function busDefaults(type, id) {
  const segregation =
    type === "knx" || type === "cresnet" || type === "qslink"
      ? "SELV"
      : type === "dali"
        ? "FELV"
        : "none";
  return {
    id,
    type,
    label: type.toUpperCase(),
    psuModuleIds: [],
    deviceModuleIds: [],
    voltage: type === "knx" ? 30 : type === "dali" ? null : 24,
    budgetUnit: "mA",
    capacity: null,
    maxDevices: type === "knx" || type === "dali" ? 64 : null,
    segregation,
  };
}

export function nextBusId(design, type) {
  const prefix = `B-${(type || "BUS").toUpperCase()}`;
  const used = new Set((design.buses || []).map((b) => b.id));
  if (!used.has(prefix)) return prefix;
  for (let i = 2; ; i++) {
    const id = `${prefix}-${i}`;
    if (!used.has(id)) return id;
  }
}

function nextProtectGroupId(design) {
  const used = new Set((design.protectGroups || []).map((g) => g.id));
  for (let i = 1; ; i++) {
    const id = `PG${i}`;
    if (!used.has(id)) return id;
  }
}

/**
 * 从 module.protectId 重建/归一化 protectGroups。
 * protectId = 空开节点 id（回路 id 或 Q0）；可选 rcd 存在时挂在组上。
 */
export function normalizeProtectGroups(design) {
  const modules = design.modules || [];
  /** @type {Map<string, {id:string,label:string,breakerNodeId:string,rcdNodeId:string|null,moduleIds:string[]}>} */
  const byBreaker = new Map();

  for (const raw of design.protectGroups || []) {
    if (!raw || typeof raw.breakerNodeId !== "string" || !raw.breakerNodeId) continue;
    const id = typeof raw.id === "string" && raw.id ? raw.id : nextProtectGroupId(design);
    byBreaker.set(raw.breakerNodeId, {
      id,
      label: typeof raw.label === "string" && raw.label ? raw.label : `保护 ${raw.breakerNodeId}`,
      breakerNodeId: raw.breakerNodeId,
      rcdNodeId: typeof raw.rcdNodeId === "string" && raw.rcdNodeId ? raw.rcdNodeId : null,
      moduleIds: Array.isArray(raw.moduleIds) ? [...new Set(raw.moduleIds.filter(Boolean))] : [],
    });
  }

  for (const mod of modules) {
    const pid = mod.protectId;
    if (!pid) continue;
    if (!byBreaker.has(pid)) {
      byBreaker.set(pid, {
        id: nextProtectGroupId({ protectGroups: [...byBreaker.values()] }),
        label: `保护 ${pid}`,
        breakerNodeId: pid,
        rcdNodeId: null,
        moduleIds: [],
      });
    }
    const g = byBreaker.get(pid);
    if (!g.moduleIds.includes(mod.id)) g.moduleIds.push(mod.id);
  }

  // 去掉已删模块
  const modIds = new Set(modules.map((m) => m.id));
  for (const g of byBreaker.values()) {
    g.moduleIds = g.moduleIds.filter((id) => modIds.has(id));
  }

  design.protectGroups = [...byBreaker.values()].filter(
    (g) => g.moduleIds.length > 0 || g.breakerNodeId
  );
  return design.protectGroups;
}

/**
 * 将模块挂到空开（可附带漏保节点 id）。
 */
export function setModuleProtect(design, moduleId, breakerNodeId, rcdNodeId = null) {
  const mod = (design.modules || []).find((m) => m.id === moduleId);
  if (!mod) throw new Error("模块不存在");
  mod.protectId = breakerNodeId || null;
  // 从其它组移除
  for (const g of design.protectGroups || []) {
    g.moduleIds = (g.moduleIds || []).filter((id) => id !== moduleId);
  }
  if (!breakerNodeId) {
    normalizeProtectGroups(design);
    return design;
  }
  let group = (design.protectGroups || []).find((g) => g.breakerNodeId === breakerNodeId);
  if (!group) {
    group = {
      id: nextProtectGroupId(design),
      label: `保护 ${breakerNodeId}`,
      breakerNodeId,
      rcdNodeId: rcdNodeId || null,
      moduleIds: [],
    };
    design.protectGroups = Array.isArray(design.protectGroups) ? design.protectGroups : [];
    design.protectGroups.push(group);
  }
  if (rcdNodeId) group.rcdNodeId = rcdNodeId;
  if (!group.moduleIds.includes(moduleId)) group.moduleIds.push(moduleId);
  normalizeProtectGroups(design);
  return design;
}

/**
 * 通道清单行（导出 / 预览）。
 * @param {object} design
 * @param {(id:string)=>object|null} [findProduct]
 */
export function buildChannelRows(design, findProduct = null) {
  const groups = design.protectGroups || [];
  const rows = [];
  for (const mod of design.modules || []) {
    const product = findProduct?.(mod.productId);
    if (product?.kind === "terminal") continue;
    const group = groups.find((g) => (g.moduleIds || []).includes(mod.id))
      || (mod.protectId ? { breakerNodeId: mod.protectId, rcdNodeId: null } : null);
    const n = Math.max(
      Object.keys(mod.channels || {}).length,
      Object.keys(mod.channelLabels || {}).length,
      Number(product?.channels) || 0
    );
    if (n === 0) {
      rows.push({
        moduleId: mod.id,
        moduleLabel: mod.label,
        productName: product?.name || mod.productId,
        channel: "",
        label: "",
        terminal: "",
        breaker: group?.breakerNodeId || "",
        rcd: group?.rcdNodeId || "",
      });
      continue;
    }
    for (let i = 1; i <= n; i++) {
      const connection = (design.modules || []).flatMap(t => Object.entries(t.terminalConnections || {})
        .filter(([,c])=>c.output===`${mod.id}:CH${i}_OUT`).map(([pole,c])=>({...c,terminal:`${t.id}:${pole}`})))[0];
      rows.push({
        moduleId: mod.id,
        moduleLabel: mod.label,
        productName: product?.name || mod.productId,
        channel: i,
        label: connection?.loadName || (mod.channelLabels && mod.channelLabels[i]) || "",
        terminal: connection?.terminal || (mod.channelTerminals && mod.channelTerminals[i]) || "",
        circuitId: (mod.channels && mod.channels[i]) || "",
        breaker: group?.breakerNodeId || "",
        rcd: group?.rcdNodeId || "",
      });
    }
  }
  return rows;
}

export function channelRowsToCsv(rows) {
  const header = ["模块", "名称", "型号", "通道", "备注", "端子", "共用空开", "共用漏保", "关联回路"];
  const body = rows.map((r) => [
    r.moduleId,
    r.moduleLabel,
    r.productName,
    r.channel === "" ? "" : `CH${r.channel}`,
    r.label,
    r.terminal || "",
    r.breaker,
    r.rcd,
    r.circuitId || "",
  ]);
  const esc = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [header, ...body].map((line) => line.map(esc).join(",")).join("\r\n");
}

/**
 * 保护连线示意数据（装配页 SVG）。
 */
export function buildProtectLinkSchematic(design, assembly) {
  const nodes = new Map((assembly?.nodes || []).map((n) => [n.id, n]));
  const groups = design.protectGroups || [];
  return groups
    .filter((g) => (g.moduleIds || []).length)
    .map((g) => {
      const breaker = nodes.get(g.breakerNodeId);
      const rcd = g.rcdNodeId ? nodes.get(g.rcdNodeId) : null;
      const mods = (g.moduleIds || []).map((id) => nodes.get(id)).filter(Boolean);
      return {
        id: g.id,
        label: g.label,
        breakerNodeId: g.breakerNodeId,
        breakerLabel: breaker?.label || g.breakerNodeId,
        rcdNodeId: g.rcdNodeId,
        rcdLabel: rcd?.label || g.rcdNodeId,
        modules: mods.map((m) => ({ id: m.id, label: m.label || m.id })),
      };
    });
}

/**
 * 灯线 → 端子 → 继电器通道示意（简易布置）。
 * @param {object} design
 * @param {(id:string)=>object|null} [findProduct]
 */
export function buildChannelWireSchematic(design, findProduct = null) {
  const rows = [];
  for (const mod of design.modules || []) {
    const product = findProduct?.(mod.productId);
    if (!product || product.kind === "terminal") continue;
    const n = Math.max(
      Object.keys(mod.channelLabels || {}).length,
      Object.keys(mod.channelTerminals || {}).length,
      Number(product.channels) || 0,
    );
    for (let ch = 1; ch <= n; ch++) {
      const label = mod.channelLabels?.[ch] || "";
      const tid = mod.channelTerminals?.[ch] || null;
      if (!label && !tid) continue;
      const term = tid ? (design.modules || []).find((m) => m.id === tid) : null;
      const termProd = term ? findProduct?.(term.productId) : null;
      rows.push({
        moduleId: mod.id,
        moduleLabel: mod.label,
        channel: ch,
        loadLabel: label || `CH${ch}`,
        terminalId: tid,
        terminalLabel: term?.label || tid || "",
        terminalColor: termProd?.terminalColor || (termProd?.conductor === "N" ? "blue" : "gray"),
        path: tid
          ? `灯线 → ${tid} → ${mod.id}·CH${ch}`
          : `灯线（待装端子）→ ${mod.id}·CH${ch}`,
      });
    }
  }
  return rows;
}

/**
 * 将继电器通道挂到端子；同步端子侧 link。
 */
export function linkChannelTerminal(design, moduleId, channel, terminalId) {
  const mod = (design.modules || []).find((m) => m.id === moduleId);
  if (!mod) throw new Error("模块不存在");
  const ch = +channel;
  mod.channelTerminals = mod.channelTerminals || {};
  // 清掉其它模块对该端子的占用
  if (terminalId) {
    for (const other of design.modules || []) {
      if (other.id === moduleId) continue;
      for (const k of Object.keys(other.channelTerminals || {})) {
        if (other.channelTerminals[k] === terminalId) other.channelTerminals[k] = null;
      }
    }
  }
  const prev = mod.channelTerminals[ch];
  if (prev && prev !== terminalId) {
    const oldTerm = (design.modules || []).find((m) => m.id === prev);
    if (oldTerm && oldTerm.linkModuleId === moduleId && +oldTerm.linkChannel === ch) {
      oldTerm.linkModuleId = null;
      oldTerm.linkChannel = null;
    }
  }
  mod.channelTerminals[ch] = terminalId || null;
  if (terminalId) {
    const term = (design.modules || []).find((m) => m.id === terminalId);
    if (term) {
      term.linkModuleId = moduleId;
      term.linkChannel = ch;
    }
  }
  return design;
}
