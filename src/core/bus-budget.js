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
    const sources=[...new Set(bus.psuModuleIds||[])], members=[...new Set(bus.deviceModuleIds||[])];
    const singleOutput=sources.length===1?resolve(sources[0])?.psuOutput:null;
    const unit=bus.budgetUnit|| (singleOutput?.watts!=null?'W':singleOutput?.milliamps!=null?'mA':bus.type==='dc'?'W':'mA');
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
    let capacity=Number.isFinite(bus.capacity)&&bus.capacity>=0?bus.capacity:sources.length===1?sourceValues[0]:null;
    if(sources.length>1 && bus.capacity==null)pending.push('多电源容量不能自动相加，请核实分配后填写容量');
    const usage=members.map(id=>{
      const c=resolve(id)?.busConsumption;
      const v=c?convertBudget(c.value,c.unit,unit,busVoltage):null;
      if(v==null)pending.push(`${id} 消耗未知或单位无法换算`);
      return v;
    });
    const usedKnown=usage.every(v=>v!==null),used=usedKnown?usage.reduce((a,b)=>a+b,0):null;
    if(bus.type==='dali' && capacity!=null) {
      const limit=convertBudget(250,'mA',unit,busVoltage);
      if(limit!=null)capacity=Math.min(capacity,limit);
      else {capacity=null;pending.push('DALI 电压未知，无法将 250 mA 上限换算为当前单位');}
    }
    const maxDevices=bus.maxDevices??(['knx','dali'].includes(bus.type)?64:null);
    return {id:bus.id,busId:bus.id,type:bus.type,label:bus.label,unit,capacity,used,capacityKnown:capacity!=null,usedKnown,
      knownUsed:usage.reduce((sum,v)=>sum+(v??0),0),pending,maxDevices,deviceCount:members.length,hasPsu:sources.length>0,psuCount:sources.length,
      overBudget:capacity!=null&&used!=null&&used>capacity,overDevices:maxDevices!=null&&members.length>maxDevices,
      utilization:capacity>0&&used!=null?used/capacity:null};
  });
}
