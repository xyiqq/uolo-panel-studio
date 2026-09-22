import {busDefaults,nextBusId} from './modules.js';
export const BUS_TYPES=['dc','knx','dali','cresnet','qslink','rs485','0-10v'];
export function saveBus(design,input,resolve) {
  if(!BUS_TYPES.includes(input.type))throw new Error('请选择有效总线类型');
  const id=input.id||nextBusId(design,input.type),existing=(design.buses||[]).find(b=>b.id===id);
  const b={...busDefaults(input.type,id),...existing,...input,id};
  b.label=String(b.label||'').trim();if(!b.label||b.label.length>80)throw new Error('总线名称应为 1–80 个字符');
  for(const key of ['voltage','capacity','maxDevices','section','cableMeters']) {
    const value=b[key];b[key]=value==null||value===''?null:Number(value);
    if(b[key]!==null&&(!Number.isFinite(b[key])||b[key]<0||(['voltage','section','capacity','maxDevices'].includes(key)&&b[key]===0)))throw new Error(`${key} 必须留空待核或填写有效正数（长度可为零）`);
  }
  if(b.maxDevices!==null&&!Number.isInteger(b.maxDevices))throw new Error('设备上限必须是整数');
  if(!['W','mA'].includes(b.budgetUnit)||!['SELV','FELV','none'].includes(b.segregation))throw new Error('预算单位或隔离类型无效');
  b.cableSpec=String(b.cableSpec||'').trim().slice(0,100);
  b.psuModuleIds=[...new Set(b.psuModuleIds||[])];b.deviceModuleIds=[...new Set(b.deviceModuleIds||[])];
  const chosen=[...b.psuModuleIds,...b.deviceModuleIds];
  if(new Set(chosen).size!==chosen.length)throw new Error('同一模块不能同时作为电源和成员');
  for(const moduleId of chosen){
    const m=(design.modules||[]).find(m=>m.id===moduleId),p=m&&resolve(m.productId);
    if(!p)throw new Error(`模块 ${moduleId} 不存在`);
    if(p.networkPorts||p.outletCount||p.kind==='terminal')throw new Error(`${moduleId} 不能作为此类总线成员`);
    if(b.psuModuleIds.includes(moduleId)&&p.kind!=='psu')throw new Error(`${moduleId} 不是电源模块`);
    if((design.buses||[]).some(other=>other.id!==id&&[...(other.psuModuleIds||[]),...(other.deviceModuleIds||[])].includes(moduleId))||m.busId&&m.busId!==id)throw new Error(`${moduleId} 已属于其他总线，请先解除原关联`);
  }
  // 所有验证通过后才修改原方案，避免半保存。
  design.buses=(design.buses||[]).filter(v=>v.id!==id).concat(b);
  for(const m of design.modules||[]) {if(m.busId===id)m.busId=null;if(chosen.includes(m.id))m.busId=id;}
  return b;
}
export function deleteBus(design,id) {
  design.buses=(design.buses||[]).filter(b=>b.id!==id);
  for(const m of design.modules||[])if(m.busId===id)m.busId=null;
}
