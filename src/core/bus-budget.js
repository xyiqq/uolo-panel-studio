import {isCresnetChainBus,isCresnetDataBus} from './cresnet.js';
import {isCresnetChainSupply} from './ports.js';
import {isDinDali2, daliCresnetWatts, daliPowerMode} from './dali-power.js';
import {abbDaliLines} from './abb-dali.js';

/** 不同预算单位只在电压已知时换算。 */
export function convertBudget(value, from, to, voltage) {
  if (!Number.isFinite(value) || value < 0) return null;
  if (from === to) return value;
  if (!(Number.isFinite(voltage) && voltage > 0)) return null;
  if (from === 'mA' && to === 'W') return value * voltage / 1000;
  if (from === 'W' && to === 'mA') return value / voltage * 1000;
  return null;
}
export function computeBusBudgets(design, products = []) {
  const byId = products instanceof Map ? products : new Map(Array.isArray(products) ? products.map(p=>[p.id,p]) : Object.entries(products||{}));
  const modules = new Map((design?.modules||[]).map(m=>[m.id,m]));
  const resolve = id => byId.get(modules.get(id)?.productId);
  return (design?.buses||[]).map(bus=>{
    const chain = isCresnetChainBus(bus);
    const sources = chain ? [bus.chainSupplyModuleId].filter(Boolean) : [...new Set(bus.psuModuleIds||[])];
    // Legacy control feeds may name the gateway only through its module.busId.
    const legacyGateways = [...modules.values()].filter(m => m.busId===bus.id && (
      (['dc','cresnet'].includes(bus.type) && !isCresnetDataBus(bus) && isDinDali2(resolve(m.id)))
      || (bus.type==='knx' && abbDaliLines(resolve(m.id))))).map(m=>m.id);
    const members = [...new Set([...(bus.deviceModuleIds||[]), ...legacyGateways])];
    if (isCresnetDataBus(bus) && !chain) {
      const maxDevices = Math.min(25, bus.maxDevices ?? 25);
      return {id:bus.id, busId:bus.id, type:bus.type, label:bus.label, dataOnly:true, deviceCount:members.length,
        maxDevices, overDevices:members.length > maxDevices, hasPsu:false, psuCount:0, pending:[],
        unit:null, used:null, knownUsed:0, capacity:null, usedKnown:false, capacityKnown:false, overBudget:false, utilization:null};
    }
    const singleOutput=sources.length===1?resolve(sources[0])?.psuOutput:null;
    const unit=chain?'W':bus.budgetUnit|| (singleOutput?.watts!=null?'W':singleOutput?.milliamps!=null?'mA':bus.type==='dc'?'W':'mA');
    const busVoltage=bus.voltage??singleOutput?.voltage;
    const pending=[];
    const sourceValues=sources.map(id=>{
      const out=resolve(id)?.psuOutput;
      if(!out) {pending.push(`${id} 电源输出未知`);return null;}
      const voltage=out.voltage??bus.voltage;
      let value=null;
      if(out.watts!=null) value=convertBudget(out.watts,'W',unit,voltage);
      else if(out.milliamps!=null) value=convertBudget(out.milliamps,'mA',unit,voltage);
      else if(Number.isFinite(out.amps)) value=convertBudget(out.amps*1000,'mA',unit,voltage);
      if(value==null)pending.push(`${id} 输出单位无法换算`);
      return value;
    });
    let capacity=chain ? isCresnetChainSupply(resolve(bus.chainSupplyModuleId)) ? singleOutput?.watts : null
      : Number.isFinite(bus.capacity)&&bus.capacity>=0?bus.capacity:sources.length===1?sourceValues[0]:null;
    if(sources.length>1 && bus.capacity==null)pending.push('多电源容量不能自动相加，请核实分配后填写容量');
    const usage=members.map(id=>{
      const product = resolve(id);
      let c = product?.busConsumption;
      if (abbDaliLines(product) && bus.type !== 'knx') c = null;
      if (isDinDali2(product)) {
        const controlFeed = ['dc','cresnet'].includes(bus.type);
        c = controlFeed ? {value:daliCresnetWatts(product, daliPowerMode(modules.get(id))), unit:'W'} : null;
      }
      const v=c?convertBudget(c.value,c.unit,unit,busVoltage):null;
      if(v==null)pending.push(`${id} 消耗未知或单位无法换算`);
      return v;
    });
    const sumUsed=usage.reduce((sum,v)=>sum+(v??0),0);
    const knownUsed=chain?Number(sumUsed.toFixed(2)):sumUsed;
    const usedKnown=usage.every(v=>v!==null),used=usedKnown?knownUsed:null;
    if(bus.type==='dali' && capacity!=null) {
      const limit=convertBudget(250,'mA',unit,busVoltage);
      if(limit!=null)capacity=Math.min(capacity,limit);
      else {capacity=null;pending.push('DALI 电压未知，无法将 250 mA 上限换算为当前单位');}
    }
    const maxDevices=chain?Math.min(25,bus.maxDevices??25):bus.maxDevices??(['knx','dali'].includes(bus.type)?64:null);
    return {id:bus.id,busId:bus.id,type:bus.type,label:bus.label,...(chain?{cresnetChain:true}:{}),unit,capacity,used,capacityKnown:capacity!=null,usedKnown,
      knownUsed,pending,maxDevices,deviceCount:members.length,hasPsu:sources.length>0,psuCount:sources.length,
      overBudget:capacity!=null&&knownUsed>capacity,overDevices:maxDevices!=null&&members.length>maxDevices,
      utilization:capacity>0&&used!=null?used/capacity:null};
  });
}
