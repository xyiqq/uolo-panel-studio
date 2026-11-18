import {busDefaults,nextBusId} from './modules.js';
import {qsBusIssue} from './qs-link.js';
import {chainPowerOverlap,isCresnetChainBus,isCresnetDataBus} from './cresnet.js';
import {isCresnetReceiver,isCresnetController,isCresnetChainSupply} from './ports.js';
import {daliSupplyOwners, isDinDali2} from './dali-power.js';
export const BUS_TYPES=['dc','knx','dali','cresnet','qslink','rs485','0-10v'];
export function saveBus(design,input,resolve) {
  if(!BUS_TYPES.includes(input.type))throw new Error('请选择有效总线类型');
  const id=input.id||nextBusId(design,input.type),existing=(design.buses||[]).find(b=>b.id===id);
  const b={...busDefaults(input.type,id),...existing,...input,id};
  if (b.type !== 'cresnet') delete b.controllerModuleId;
  const dataOnly = isCresnetDataBus(b);
  if (!dataOnly || b.chainSupplyModuleId === undefined) delete b.chainSupplyModuleId;
  const chain = isCresnetChainBus(b);
  if (!chain) delete b.chainPowerMeters;
  else {
    b.chainPowerMeters = b.chainPowerMeters == null || b.chainPowerMeters === '' ? null : Number(b.chainPowerMeters);
    if (b.chainPowerMeters !== null && !(Number.isFinite(b.chainPowerMeters) && b.chainPowerMeters > 0)) throw new Error('电源至末端的长度应为正数或留空待核');
    if (b.chainSupplyModuleId !== null && !isCresnetChainSupply(resolve(design.modules?.find(m => m.id === b.chainSupplyModuleId)?.productId))) throw new Error('级联电源请选择柜内的 DIN-PWS50');
  }
  b.label=String(b.label||'').trim();if(!b.label||b.label.length>80)throw new Error('总线名称应为 1–80 个字符');
  for(const key of ['voltage','capacity','maxDevices','section','cableMeters']) {
    const value=b[key];b[key]=value==null||value===''?null:Number(value);
    if(b[key]!==null&&(!Number.isFinite(b[key])||b[key]<0||(['voltage','section','capacity','maxDevices'].includes(key)&&b[key]===0)))throw new Error(`${key} 必须留空待核或填写有效正数（长度可为零）`);
  }
  if(b.maxDevices!==null&&!Number.isInteger(b.maxDevices))throw new Error('设备上限必须是整数');
  if(!['W','mA'].includes(b.budgetUnit)||!['SELV','FELV','none'].includes(b.segregation))throw new Error('预算单位或隔离类型无效');
  b.cableSpec=String(b.cableSpec||'').trim().slice(0,100);
  b.psuModuleIds=[...new Set(b.psuModuleIds||[])];b.deviceModuleIds=[...new Set(b.deviceModuleIds||[])];
  // saveBus replaces all legacy module.busId entries for this bus on commit.
  const qsIssue=qsBusIssue({...design,modules:design.modules?.map(m=>m.busId===id?{...m,busId:null}:m)||[]},b);
  if(qsIssue)throw new Error(qsIssue);
  if (b.type === 'dali' && b.psuModuleIds.length && b.deviceModuleIds.length) {
    if (b.psuModuleIds.some(source => daliSupplyOwners(design, source).length)) throw new Error('电源出线已分配给 DIN-DALI-2 回路');
    const receivers = b.deviceModuleIds.map(id => design.modules?.find(m => m.id === id)).filter(Boolean);
    if (receivers.some(m => resolve(m.productId)?.daliPowerSupply === 'internal-only' || isDinDali2(resolve(m.productId)))) {
      throw new Error('内置电源模块不能在通用总线并联外源，DIN-DALI-2 请按具体 DALI 回路配置');
    }
  }
  if (dataOnly) {
    const controller = design.modules?.find(m => m.id === b.controllerModuleId);
    if (!controller || !isCresnetController(resolve(controller.productId))) throw new Error('请选择已安装的 DIN-AP4 通信主机');
    if (b.psuModuleIds.length) throw new Error('请选择专用级联电源，或在直连模式中单独配置 24/G');
    if (b.deviceModuleIds.some(id => !isCresnetReceiver(resolve(design.modules.find(m => m.id === id)?.productId)))) {
      throw new Error('请选择已核实双 NET 端子的 Cresnet 成员');
    }
    b.section = null;
    b.capacity = null;
    b.cableSpec = chain ? '标准 Cresnet · Y/Z 22 AWG，24/G 18 AWG' : '标准 Cresnet · Y/Z 22 AWG，G 18 AWG';
    b.segregation = 'SELV';
  }
  const chosen=[...b.psuModuleIds,...b.deviceModuleIds,...(dataOnly?[b.controllerModuleId]:[]),...(b.chainSupplyModuleId?[b.chainSupplyModuleId]:[])];
  if (b.type === 'rs485' && design.modules.some(m=>m.rs485Meters?.length && [m.id,...m.rs485Meters].some(id=>chosen.includes(id)))) {
    throw new Error('请先解除 DIN-AP4 的 COM1 电表分配。');
  }
  const others=(design.buses||[]).filter(other=>other.id!==id);
  if (others.some(other => chainPowerOverlap(design,b,other) || chainPowerOverlap(design,other,b,false))) {
    throw new Error('级联电源或成员已有控制供电关联，请先解除重复出线');
  }
  if(new Set(chosen).size!==chosen.length)throw new Error('同一模块不能同时作为电源和成员');
  for(const moduleId of chosen){
    const m=(design.modules||[]).find(m=>m.id===moduleId),p=m&&resolve(m.productId);
    if(!p)throw new Error(`模块 ${moduleId} 不存在`);
    if(p.networkPorts||p.outletCount||p.kind==='terminal')throw new Error(`${moduleId} 不能作为此类总线成员`);
    if(b.psuModuleIds.includes(moduleId)&&p.kind!=='psu')throw new Error(`${moduleId} 不是电源模块`);
    // A DC feed and a data run occupy different sockets, regardless of edit order.
    const sharesTerminals = other => !(dataOnly && other.type === 'dc' || b.type === 'dc' && isCresnetDataBus(other));
    const conflict = others.some(other => sharesTerminals(other) &&
      (m.busId === other.id || other.controllerModuleId === moduleId || other.chainSupplyModuleId === moduleId || other.psuModuleIds?.includes(moduleId) || other.deviceModuleIds?.includes(moduleId)));
    if(conflict)throw new Error(`${moduleId} 已属于其他总线，请先解除原关联`);
  }
  // 所有验证通过后才修改原方案，避免半保存。
  design.buses=(design.buses||[]).filter(v=>v.id!==id).concat(b);
  for(const m of design.modules||[]) {if(m.busId===id)m.busId=null;if(!dataOnly&&chosen.includes(m.id))m.busId=id;}
  return b;
}
export function deleteBus(design,id) {
  design.buses=(design.buses||[]).filter(b=>b.id!==id);
  for(const m of design.modules||[])if(m.busId===id)m.busId=null;
}
