import {busDefaults,nextBusId} from './modules.js';
import {isCresnetChainBus} from './cresnet.js';
import {daliSupplyOwners, isDinDali2} from './dali-power.js';
import {abbDaliLines} from './abb-dali.js';
import {qsPowerReserved} from './qs-link.js';

export function psuConnectionType(product) {
  if(product?.kind!=='psu') return null;
  return product.protocol?.find(p=>['dali','knx'].includes(p)) || (product.psuOutput?.voltage ? 'dc' : null);
}

export function psuConnections(design,id) {
  return [...new Set((design.buses||[]).filter(b=>b.psuModuleIds?.includes(id)).flatMap(b=>[
    ...(b.deviceModuleIds||[]),...(design.modules||[]).filter(m=>m.busId===b.id&&m.id!==id).map(m=>m.id)
  ]))];
}

/** Save output assignments in the existing bus model, shared by wiring and delivery. */
export function savePsuConnections(design,id,product,targets) {
  const type=psuConnectionType(product);
  if(!type) return;
  const selected=[...new Set(targets)].filter(target=>target!==id&&design.modules.some(m=>m.id===target));
  if(type==='dc' && selected.length && [id,...selected].some(target=>qsPowerReserved(design,target)))throw new Error('该处理器或电源已有 QS 电源组分配，请先在 HQP7 接线设置中解除');
  if (selected.length && type === 'dali') {
    if (daliSupplyOwners(design, id).length) throw new Error('该电源出线已分配给 DIN-DALI-2 的 DALI 回路');
    const receivers = design.modules.filter(m => selected.includes(m.id));
    if (receivers.some(m => abbDaliLines({id:m.productId}))) throw new Error('ABB DG/S Premium 的 DALI 输出只使用内置电源');
    if (receivers.some(m => m.productId === 'lutron-lqse-2dal-d')) throw new Error('LQSE-2DAL-D 的 DALI 输出只使用内置电源');
    if (receivers.some(m => m.productId === 'crestron-din-dli')) throw new Error('DIN-DLI 仅使用内置 DALI 电源');
    if (receivers.some(m => isDinDali2({id:m.productId}))) {
      throw new Error('请在 DIN-DALI-2 的整机拨档设置中按回路配置外置 DALI 电源');
    }
  }
  const buses=design.buses ||= [];
  if (selected.length && type==='dc' && buses.some(b=>isCresnetChainBus(b) &&
    (b.chainSupplyModuleId===id || selected.some(target=>b.deviceModuleIds?.includes(target))))) {
    throw new Error('级联电源和成员已在 Cresnet 总线中分配 24/G，请先解除重复出线');
  }
  const owned=buses.filter(b=>b.psuModuleIds?.includes(id));
  if(owned.some(b=>b.psuModuleIds.length!==1)) throw new Error('该电源所在总线有多个电源，请先在总线设置中明确电源归属。');
  if(buses.some(b=>!owned.includes(b)&&b.type===type&&b.psuModuleIds?.length&&selected.some(target=>b.deviceModuleIds?.includes(target)||design.modules.some(m=>m.id===target&&m.busId===b.id)))) {
    throw new Error('所选模块已有同类电源供电，请先取消原电源的下端连接。');
  }
  let bus=owned.find(b=>b.type===type);
  if(!bus&&selected.length){bus=busDefaults(type,nextBusId(design,type));buses.push(bus);}
  for(const old of owned){
    old.deviceModuleIds=[];
    for(const mod of design.modules) if(mod.id!==id&&mod.busId===old.id) mod.busId=null;
    if(old!==bus) old.psuModuleIds=old.psuModuleIds.filter(source=>source!==id);
  }
  if(bus){
    bus.psuModuleIds=[id];bus.deviceModuleIds=selected;
    bus.voltage=product.psuOutput?.voltage??bus.voltage;
    bus.label=`${id} ${type==='dc'?`${bus.voltage}V 直流出线`:`${type.toUpperCase()} 出线`}`;
  }
}
