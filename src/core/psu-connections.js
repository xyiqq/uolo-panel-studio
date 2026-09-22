import {busDefaults,nextBusId} from './modules.js';

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
  const buses=design.buses ||= [];
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
