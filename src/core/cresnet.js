import {isCresnetReceiver, isCresnetController, isCresnetChainSupply} from './ports.js';
import {isDinDali2, daliPowerMode, daliCresnetWatts} from './dali-power.js';

// Older Cresnet entries describe PSU budgets. Only an explicitly configured
// processor establishes a data network, independent of the 24 V assignment.
export function isCresnetDataBus(bus) {
  return bus?.type === 'cresnet' && Object.hasOwn(bus, 'controllerModuleId');
}

export function isCresnetChainBus(bus) {
  return isCresnetDataBus(bus) && Object.hasOwn(bus, 'chainSupplyModuleId');
}

// Old projects can store an assignment on the module, on the bus, or both.
export function chainPowerOverlap(design, chain, other, includeSavedMembers = true) {
  if (!isCresnetChainBus(chain) || !['dc', 'cresnet'].includes(other.type) || !other.psuModuleIds?.length) return false;
  const sources = new Set(other.psuModuleIds);
  const savedMembers = includeSavedMembers ? design.modules.filter(m => m.busId === other.id).map(m => m.id) : [];
  const targets = [...(other.deviceModuleIds || []), ...savedMembers]
    .filter(id => !sources.has(id));
  return targets.length > 0 && (sources.has(chain.chainSupplyModuleId) || targets.some(id => chain.deviceModuleIds?.includes(id)));
}

const cable = {
  Y: {section: 0.33, material: '标准 Cresnet 屏蔽双绞线 · 白芯', scope: 'Cresnet Y 数据'},
  Z: {section: 0.33, material: '标准 Cresnet 屏蔽双绞线 · 蓝芯', scope: 'Cresnet Z 数据'},
  G: {section: 0.82, material: '标准 Cresnet · 黑芯；屏蔽泄流线仅在源端接 G', scope: 'Cresnet G 通信参考'},
  'DC+': {section: 0.82, material: '标准 Cresnet · 红芯', scope: 'Cresnet 24V 控制供电'},
  'DC-': {section: 0.82, material: '标准 Cresnet · 黑芯', scope: 'Cresnet G 控制回流与通信参考'},
};

function wireChain({bus, design, nodes, memberships, controller, wires, port, add, pending}) {
  const supply = nodes.get(bus.chainSupplyModuleId);
  const issue = (code, text, id) => pending(code, `${bus.label || bus.id}：${text}`, id || controller.id);
  if (!isCresnetChainSupply(supply?.product) || supply.overflow || memberships.get(supply.id) !== 1) {
    issue('CRESNET_CHAIN_SUPPLY_UNRESOLVED', '请选择柜内唯一归属于本网段的 DIN-PWS50。');
    return;
  }
  if (design.buses.some(other => other !== bus && chainPowerOverlap(design, bus, other))) {
    issue('CRESNET_CHAIN_POWER_CONFLICT', '级联成员或电源出线已分配给另一供电回路，请核对并解除重复连接。', supply.id);
    return;
  }
  const ids = bus.deviceModuleIds || [];
  if (!ids.length) return;
  if (!['L_IN','N_IN','PE_IN'].every(key => wires.some(w => w.to === `${supply.id}:${key}` && w.connected))) {
    issue('CRESNET_CHAIN_AC_FEED', '请核对 DIN-PWS50 上游保护支路及 AC 输入 L、N、PE 的连接。', supply.id);
  }
  const invalid = ids.findIndex(id => !isCresnetReceiver(nodes.get(id)?.product) || nodes.get(id).overflow || memberships.get(id) !== 1);
  if (invalid !== -1 || new Set(ids).size !== ids.length) {
    issue('CRESNET_CHAIN_MEMBER_UNRESOLVED', '成员型号、安装位置、顺序或总线归属待核。请确认整条级联路径。', ids[invalid]);
    return;
  }
  const loads = ids.map(id => {
    const node = nodes.get(id);
    return isDinDali2(node.product) ? daliCresnetWatts(node.product, daliPowerMode(node.module)) : node.product.busConsumption?.value;
  });
  if (loads.some(w => !Number.isFinite(w) || w <= 0)) {
    issue('CRESNET_CHAIN_BUDGET_UNRESOLVED', '请确认成员拨档和 Cresnet 功耗后重新计算供电距离。', supply.id);
    return;
  }
  const watts = Number(loads.reduce((sum, value) => sum + value, 0).toFixed(2));
  if (watts > supply.product.psuOutput.watts || ids.length > 25) {
    issue('CRESNET_CHAIN_CAPACITY', `已选 ${ids.length} 台，控制功耗 ${watts} W；请核对电源 ${supply.product.psuOutput.watts} W 总额定和每段 25 台上限。`, supply.id);
    return;
  }
  // Doc. 9272: R < 40,000 / (length in ft × total power), R = 6 for 18 AWG.
  const maxPowerMeters = 40000 * 0.3048 / (6 * watts);
  if (bus.chainPowerMeters != null && (bus.chainPowerMeters >= maxPowerMeters ||
    bus.chainPowerMeters > 457 || (bus.cableMeters != null && bus.chainPowerMeters > bus.cableMeters))) {
    issue('CRESNET_CHAIN_POWER_LENGTH', '电源到末端的长度超过供电或网段范围，请重新核对供电距离与总线长度。', supply.id);
    return;
  }
  if (bus.chainPowerMeters == null && !(bus.cableMeters > 0 && bus.cableMeters < maxPowerMeters)) {
    issue('CRESNET_CHAIN_LENGTH_REVIEW', `请核对电源至末台的四芯线长度，按 18 AWG 与 ${watts} W 计算需小于 ${Math.floor(maxPowerMeters * 10) / 10} m，网段累计不超过 457 m。`, supply.id);
  } else if (!(bus.cableMeters > 0)) {
    issue('CRESNET_CHAIN_LENGTH_REVIEW', '请核对主机至电源和电源至末台的累计线长，单网段上限为 457 m。', supply.id);
  }
  const connect = (from, fromKey, to, toKey, conductor, material) => {
    const spec = cable[conductor];
    add(port(from, fromKey).id, port(to, toKey).id, {material:material || spec.material}, {
      section:spec.section, scope:spec.scope, conductor, class:conductor.startsWith('DC')?'dc':'comms',
      cresnet:true, cresnetChain:true, busId:bus.id, moduleId:to,
    });
  };
  for (const pin of ['Y','Z','G']) {
    connect(controller.id, `NET_${pin}`, supply.id, pin === 'G' ? 'DC-' : `NET_${pin}`, pin,
      pin === 'G' ? '标准 Cresnet · 黑芯，主机至电源三线段' : null);
  }
  let previous = supply.id;
  for (const id of ids) {
    connect(previous,'NET2_24',id,'DC+','DC+');
    connect(previous,'NET2_Y',id,'NET_Y','Y');
    connect(previous,'NET2_Z',id,'NET_Z','Z');
    connect(previous,'NET2_G',id,'DC-','DC-', previous === supply.id ? '标准 Cresnet · 黑芯，泄流线在供电端接 G' : '标准 Cresnet · 黑芯，级联屏蔽按厂家图延续');
    previous = id;
  }
}

/** Direct or separately powered daisy-chain topology (Crestron 8559, 9454 and 9272). */
export function wireCresnetBuses(design, nodes, wires, port, add, pending) {
  const buses = (design.buses || []).filter(b => b.type === 'cresnet');
  const memberships = new Map();
  for (const bus of buses) {
    const ids = new Set([bus.controllerModuleId, bus.chainSupplyModuleId, ...(bus.deviceModuleIds || []),
      ...design.modules.filter(m => m.busId === bus.id).map(m => m.id)]);
    for (const id of ids) memberships.set(id, (memberships.get(id) || 0) + 1);
  }
  for (const bus of buses.filter(isCresnetDataBus)) {
    const controller = nodes.get(bus.controllerModuleId);
    const label = bus.label || bus.id;
    if (!isCresnetController(controller?.product) || controller.overflow || bus.psuModuleIds?.length) {
      pending('CRESNET_CONTROLLER_UNRESOLVED', `${label}：请选择已安装的 DIN-AP4 作为通信主机，控制电源请在独立 24V 回路配置。`, bus.controllerModuleId || bus.id);
      continue;
    }
    if (memberships.get(controller.id) > 1) {
      pending('CRESNET_MEMBERSHIP_CONFLICT', `${controller.id} 的两个 NET 插座内部并联，请在同一条 Cresnet 总线上配置直连设备。`, controller.id);
      continue;
    }
    if (bus.cableMeters > 457) {
      pending('CRESNET_LENGTH_LIMIT', `${label}：已录入总长超过厂家单网段 457 m 上限，需分段设计。`, controller.id);
      continue;
    }
    if (isCresnetChainBus(bus)) {
      wireChain({bus, design, nodes, memberships, controller, wires, port, add, pending});
      continue;
    }
    const members = [...new Set(bus.deviceModuleIds || [])];
    for (const [index, id] of members.entries()) {
      const receiver = nodes.get(id);
      if (!isCresnetReceiver(receiver?.product) || receiver.overflow || memberships.get(id) > 1) {
        pending('CRESNET_MEMBER_UNRESOLVED', `${label} → ${id}：请核对型号、安装位置和唯一的 Cresnet 网络归属。`, id);
        continue;
      }
      if (index >= 2) {
        pending('CRESNET_DISTRIBUTION_REQUIRED', `${id}：两个直连插口已预留，可选 DIN-PWS50 配置级联并确认成员顺序。`, id);
        continue;
      }
      const prefix = index === 0 ? 'NET' : 'NET2';
      for (const conductor of ['Y','Z','G']) {
        const spec = cable[conductor];
        const from = port(controller.id, `${prefix}_${conductor}`);
        const to = port(id, `NET2_${conductor}`);
        add(from.id, to.id, spec, {...spec, conductor, class:'comms', cresnet:true, busId:bus.id, moduleId:id});
      }
      if (!['DC+', 'DC-'].every(key => wires.some(w => w.class === 'dc' && w.to === `${id}:${key}` && w.connected))) {
        pending('CRESNET_CONTROL_POWER_REQUIRED', `${id}：请在电源模块的下端连接中配置 24VDC，并核对 NET-24、NET-G 两根供电线。`, id);
      }
    }
  }
}
