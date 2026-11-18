/** Crestron DIN-DALI-2 has one physical DALI POWER switch for both loops. */
export const DALI_LOOPS = [1, 2];

export function isIndexedDaliSupply(product) {
  return ['lunatone-dali-ps-24033444','meanwell-dlp-04r','tridonic-dali-ps2'].includes(product?.id);
}

export function daliSourcePin(product, module, conductor) {
  if (product?.id !== 'tridonic-dali-ps2') return conductor;
  // 28000876 labels both screws DA. Record the actual positive side before
  // mapping either screw to a signed DALI connection.
  const side=module?.daliPositiveSide;
  if (!['left','right'].includes(side)) return null;
  return (conductor==='BUS+')===(side==='left')?'DA_LEFT':'DA_RIGHT';
}

export function isDinDali2(product) {
  return product?.id === 'crestron-din-dali-2';
}

export function daliPowerMode(module) {
  return module?.daliPowerMode ?? 'INT';
}

export function daliCresnetWatts(product, mode) {
  return product?.busConsumption?.byMode?.[mode] ?? null;
}

export function normalizeDaliPower(module) {
  const mode = daliPowerMode(module);
  const supplies = {};
  for (const loop of DALI_LOOPS) {
    const id = module.daliLoopSupplies?.[loop];
    supplies[loop] = typeof id === 'string' && id ? id : null;
  }
  return {daliPowerMode: ['INT', 'EXT'].includes(mode) ? mode : 'unknown', daliLoopSupplies:supplies};
}

/** The editor models a separate single-output DALI supply per enabled external loop. */
export function isDaliLoopSupply(product) {
  const output = product?.psuOutput;
  const current = output?.milliamps ?? output?.amps * 1000;
  return product?.kind === 'psu' && !product.networkPorts && !product.outletCount
    && product.protocol?.includes('dali') && current > 0 && current <= 250;
}

export function daliSupplyOwners(design, sourceId) {
  if (!sourceId) return [];
  return (design.modules || []).filter(m => isDinDali2({id:m.productId}) && daliPowerMode(m) === 'EXT')
    .flatMap(m => DALI_LOOPS.filter(loop => m.daliLoopSupplies?.[loop] === sourceId)
      .map(loop => ({moduleId:m.id, loop})));
}

function hasOtherOutputs(design, sourceId) {
  return (design.buses || []).some(b => b.psuModuleIds?.includes(sourceId) &&
    (b.deviceModuleIds?.length || design.modules.some(m => m.busId === b.id && !b.psuModuleIds.includes(m.id))));
}

export function daliLoopSupplyCandidates(design, moduleId, loop, resolveProduct) {
  return design.modules.filter(m => isDaliLoopSupply(resolveProduct(m.productId)) &&
    !hasOtherOutputs(design, m.id) && daliSupplyOwners(design, m.id).every(owner =>
      owner.moduleId === moduleId && owner.loop === Number(loop)));
}

export function saveDaliPower(design, moduleId, {mode, loopSupplies = {}}, resolveProduct) {
  const gateway = design.modules.find(m => m.id === moduleId);
  if (!isDinDali2(resolveProduct(gateway?.productId)) || !['INT','EXT'].includes(mode)) {
    throw new Error('请选择 DIN-DALI-2 的整机 DALI POWER 拨档');
  }
  const next = normalizeDaliPower({daliPowerMode:mode, daliLoopSupplies:loopSupplies});
  const ids = Object.values(next.daliLoopSupplies).filter(Boolean);
  if (mode === 'INT' && ids.length) throw new Error('INT 拨档使用内置电源，请移除外置 DALI 电源');
  if (new Set(ids).size !== ids.length) throw new Error('两条 DALI 回路不能共用同一组电源输出');
  for (const id of ids) {
    const source = design.modules.find(m => m.id === id);
    if (!isDaliLoopSupply(source && resolveProduct(source.productId))) throw new Error(`${id} 需要有明确输出额定的 DALI 总线电源`);
    if (hasOtherOutputs(design, id) || daliSupplyOwners(design, id).some(owner => owner.moduleId !== moduleId)) {
      throw new Error(`${id} 出线已分配给其他回路`);
    }
  }
  Object.assign(gateway, next);
  return gateway;
}

export function wireDaliLoops({design, nodes, port, add, pending}) {
  for (const gateway of design.modules.filter(m => isDinDali2(nodes.get(m.id)?.product))) {
    const mode = daliPowerMode(gateway);
    if (!['INT','EXT'].includes(mode)) {
      pending('DALI_POWER_MODE_UNKNOWN', `${gateway.id}：请确认整机 DALI POWER 的 INT / EXT 拨档。`, gateway.id);
      continue;
    }
    for (const loop of DALI_LOOPS) {
      const sourceId = gateway.daliLoopSupplies?.[loop];
      const label = `${gateway.id} DALI ${loop}`;
      if (mode === 'INT') {
        if (sourceId) pending('DALI_INTERNAL_SUPPLY_CONFLICT', `${label}：INT 与已记录的外置电源冲突，请重新确认拨档和电源。`, gateway.id);
        continue;
      }
      const source = nodes.get(sourceId);
      if (!isDaliLoopSupply(source?.product) || source.overflow || nodes.get(gateway.id).overflow) {
        pending('DALI_LOOP_SUPPLY_REQUIRED', `${label}：EXT 拨档，请为使用中的回路选择柜内额定明确的外置 DALI 电源。`, gateway.id);
        continue;
      }
      if (daliSupplyOwners(design, sourceId).length !== 1 || hasOtherOutputs(design, sourceId)) {
        pending('DALI_LOOP_SUPPLY_CONFLICT', `${label}：${sourceId} 的同一组输出已分配给多个回路。`, gateway.id);
        continue;
      }
      const conductors = [['BUS+', 'PLUS'], ['BUS-', 'MINUS']].map(([conductor, pin]) => {
        const sourceKey=daliSourcePin(source.product,source.module,conductor);
        return {conductor, from:sourceKey && port(sourceId,sourceKey), to:port(gateway.id, `DALI${loop}_${pin}`)};
      });
      if (conductors.some(({from, to}) => !from?.id || !to?.id)) {
        pending('DALI_LOOP_PORT_UNRESOLVED', `${label}：请核对外置电源和本回路的 DA+、DA− 两极端子。`, gateway.id);
        continue;
      }
      for (const {conductor, from, to} of conductors) {
        add(from.id, to.id, {material:'DALI 双线'}, {scope:`DALI ${loop} · EXT 外置总线电源`, class:'comms',
          legacyFrom:sourceId+':'+conductor, conductor, moduleId:gateway.id, daliLoop:loop, daliPowerMode:mode, section:null});
      }
    }
  }
}
