// Eastron SDM630-Modbus V2, direct-connected 3P4W. B/A/G are on a separate serial link.
import {SDM630_V2} from './serial-rs485.js';

const poles=['L1','L2','L3','N'];

export function isolateMeterLoad(circuit,originalOutput,remove){
  if(circuit.voltage!==380) return;
  for(const key of poles){
    const wire=originalOutput(circuit.id,key);
    if(wire) remove(wire);
  }
}

export function wireThreePhaseMeters({design,circuit,chain,nodes,modules,port,ports,originalOutput,remove,add,internal,bindings,pending}){
  const isMeter=d=>nodes.get(d.moduleId)?.product?.id===SDM630_V2;
  const first=chain.find(isMeter);
  if(!first) return false;
  const reject=(code,msg)=>{
    isolateMeterLoad(circuit,originalOutput,remove);
    pending(code,circuit.id+'：'+msg,first.moduleId,circuit.id);
    return true;
  };
  const breaker=nodes.get(circuit.id), source=nodes.get(circuit.id+'-RCD')||breaker;
  const edges=poles.map(key=>originalOutput(circuit.id,key));
  // A 3-pole MCB can have a branch neutral on the N bar. Downstream of an RCD use only its neutral.
  if(design.supply==='single'||circuit.voltage!==380||!['mcb','rcbo'].includes(breaker?.product?.kind)
      ||breaker.overflow||source.overflow||!(breaker.product.amps>0&&breaker.product.amps<=100)
      ||edges.some((w,i)=>!w||(w.from!==source.id+':'+poles[i]+'_OUT'
        &&!(i===3&&source===breaker&&!ports[source.id+':N_OUT']&&w.from==='N:N-'+circuit.id))))
    return reject('METER_THREE_PHASE_SOURCE','请选择 100 A 以内、有完整三相四线 380 V 保护的直入式馈线。');

  const stage=d=>modules.get(d.moduleId)?.seriesStages?.[1];
  const ordered=[...chain].sort((a,b)=>stage(a)-stage(b));
  const exclusive=d=>{
    const m=modules.get(d.moduleId);
    return isMeter(d)&&!nodes.get(d.moduleId).overflow&&d.role==='meter'&&d.channel===1
      &&m.feed==='perChannel'&&Object.values(m.channels||{}).filter(Boolean).length===1
      &&!design.circuits.some(c=>c.id!==circuit.id&&c.devices?.some(x=>x.moduleId===d.moduleId));
  };
  const saved=(circuit.devices||[]).filter(d=>d.moduleId);
  const badOrder=ordered.length===1 ? (stage(first)!=null&&stage(first)!==1)
    : ordered.some((d,i)=>stage(d)!==i+1) || (saved.length>0&&saved.some((d,i)=>d.moduleId!==ordered[i]?.moduleId));
  if(!ordered.every(exclusive)||new Set(ordered.map(d=>d.moduleId)).size!==ordered.length||badOrder)
    return reject('METER_THREE_PHASE_ORDER','每台 SDM630 仅能占用本馈线一次。多表须从 1 开始逐级指定顺序，逐表核对 1–4 入、5–8 出。');

  const legs=[],internalMeters=[];
  for(const [i,key] of poles.entries()){
    const original=edges[i];
    let from=original.from;
    for(const [index,d] of ordered.entries()){
      const input=port(d.moduleId,key+'_IN',key),output=port(d.moduleId,key+'_OUT',key);
      if(!input||!output)return reject('METER_THREE_PHASE_SOURCE','电表实物端子缺失。');
      legs.push({from,to:input.id,original,moduleId:d.moduleId,
        moduleFeed:index===0,scope:index===0?'三相四线直入电表':'三相电表级间馈电'});
      internalMeters.push({a:input.id,b:output.id,node:d.moduleId,always:true});
      from=output.id;
    }
    legs.push({from,to:original.to,original,moduleId:ordered.at(-1).moduleId,scope:'电表 → 出箱端子'});
  }

  for(const leg of legs){
    const override=design.wireOverrides?.['module-wire:'+leg.from+'>'+leg.to];
    leg.section=override??Math.max(4,leg.original.section||0);
    const ends=[ports[leg.from],ports[leg.to]];
    const min=Math.max(4,...ends.map(p=>p?.minWire||0)),max=Math.min(25,...ends.map(p=>p?.maxWire||25));
    if(!Number.isFinite(leg.section)||leg.section<min||leg.section>max)
      return reject('METER_THREE_PHASE_SECTION','电表强电螺钉接受 4–25 mm²，各段线径还须符合两端接线能力。');
  }
  edges.forEach(remove);
  for(const {from,to,original,moduleId,scope,moduleFeed,section} of legs){
    add(from,to,original,{moduleId,scope,section,moduleFeed:!!moduleFeed,breakerId:circuit.id,circuit:circuit.id});
  }
  internal.push(...internalMeters);
  for(const [i,d] of ordered.entries())bindings.push({moduleId:d.moduleId,sourceId:i?ordered[i-1].moduleId:source.id,
    breakerId:circuit.id,phase:'L1/L2/L3',explicit:true,channel:1});
  return true;
}
