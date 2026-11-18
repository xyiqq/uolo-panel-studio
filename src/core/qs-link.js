import {fieldTerminalClaims, fieldTerminalPort} from './field-terminals.js';

const processorPrefix = 'lutron-hqp7-';
export const QS_HARNESS = 'lutron-qsps-dh-1-75-h';
export const QS_SUPPLIES = [QS_HARNESS, 'lutron-qsps-dh-1-75'];
export const QS_RECEIVERS = ['lutron-lqse-4t10-d','lutron-lqse-4s10-d','lutron-lqse-2dal-d','lutron-lqse-4m-d'];
export const qsReceiver = product => QS_RECEIVERS.includes(product?.id);
export const qsHardware = product => !!qsLinkCount(product?.id) || qsReceiver(product) || QS_SUPPLIES.includes(product?.id);
export function qsLinkCount(id) {
  return id === processorPrefix + '1' ? 1 : id === processorPrefix + '2' ? 2 : 0;
}

const ref = v => typeof v === 'string' && v.length <= 24 ? v : '';
const number = v => v == null || v === '' ? null : typeof v === 'number' && Number.isFinite(v) ? v : -1;
export function normalizeQsConfig(raw, count) {
  if (!raw || typeof raw !== 'object') return null;
  const links = {};
  for (let n=1;n<=count;n++) {
    const l = raw.links?.[n] || {};
    links[n] = {members:Array.isArray(l.members)?l.members.map(ref):[], meters:number(l.meters),terminalId:ref(l.terminalId),
      fieldSupplyId:ref(l.fieldSupplyId),fieldPdu:number(l.fieldPdu),fieldMa:number(l.fieldMa),
      fieldDevices:number(l.fieldDevices),fieldOutputs:number(l.fieldOutputs)};
  }
  return {supplyId:ref(raw.supplyId), links, nextProcessorId:ref(raw.nextProcessorId), ethernetMeters:number(raw.ethernetMeters)};
}

export function qsTerminalTemplates(product) {
  const id=product?.id, count=qsLinkCount(id), list=[];
  const pin=(key,conductor,marking,x,side='top',io='both',channel)=>list.push({key,conductor,marking,offsetX:x,side,io,...(channel?{channel}:{})});
  if(count) {
    // Spec 3691127f p4: the four-pin power harness is 4,3,2,1 from left to right.
    if(count===2)pin('PWR_L2','DC+','PWR-3-L2',-40);
    pin('PWR_L1','DC+','PWR-4-L1',-45);
    pin('DC+','DC+','PWR-2-P',-35);
    pin('DC-','DC-','PWR-1-COM',-30);
    for(let n=1;n<=count;n++) {
      for (const [i,c] of ['COM','24V','MUX','/MUX'].entries()) {
        pin('QS'+n+'_'+(i+1), c, 'QS'+n+'-'+(i+1)+'-'+c, -47+(n-1)*26+i*5,'bottom');
      }
    }
    pin('ETH1','CAT5e','ETH1',17);
    pin('ETH2','CAT5e','ETH2',40);
  } else if (QS_SUPPLIES.includes(id)) {
    pin('L_IN','L','L',-39,'top','in');pin('N_IN','N','N',-34,'top','in');
    pin('DC+','DC+','OUT+1',24,'top','out');pin('PLUS2','DC+','OUT+2',29,'top','out');
    pin('DC-','DC-','OUT-1',34,'top','out');pin('MINUS2','DC-','OUT-2',39,'top','out');
  } else if(qsReceiver(product)) {
    const motor=id==='lutron-lqse-4m-d';
    const switched=id==='lutron-lqse-4t10-d'||id==='lutron-lqse-4s10-d';
    const mainsX=motor?[-16,-6,4]:switched?[-73,-62,-52]:[-73,-68,-63];
    for(const [i,c] of ['L','N','PE'].entries())pin(c+'_IN',c,c,mainsX[i],'bottom','in');
    if(switched || motor)for(let ch=1;ch<=4;ch++){
      const x=[16,34,49,64][ch-1];
      if(switched){
        pin('CH'+ch+'_IN','L','Z'+ch+'-L',x,'bottom','in',ch);
        pin('CH'+ch+'_OUT','L','Z'+ch+'-SL',x+6,'bottom','out',ch);
      } else {
        for(const [i,s] of ['OP','CL'].entries())pin('CH'+ch+'_'+s,'L','M'+ch+'-'+s,15+(ch-1)*15+i*7,'bottom','out',ch);
      }
      if(id==='lutron-lqse-4t10-d')for(const [i,s] of ['+','-'].entries())pin('CH'+ch+'_'+(i?'MINUS':'PLUS'),'0-10V'+s,'Z'+ch+s,35+(ch-1)*11+i*5,'top','out',ch);
    }
    for (const [i,c] of [[1,'COM'],[3,'MUX'],[4,'/MUX']]) {
      // 369610/369650/369614: no wire on pin 2 of the mains-powered receivers.
      pin('QS_'+i,c,'QS-'+i+'-'+c,(motor?23:switched?20:-5)-(i-1)*5);
    }
  }
  return list;
}

function genericPowerConflict(design, id) {
  return (design.buses||[]).some(b => b.type==='dc' && b.psuModuleIds?.length && (b.deviceModuleIds?.includes(id) ||
    design.modules.some(m=>m.id===id && m.busId===b.id && !b.psuModuleIds.includes(id)) ||
    (b.psuModuleIds.includes(id) && (b.deviceModuleIds?.length || design.modules.some(m=>m.busId===b.id && !b.psuModuleIds.includes(m.id))))));
}
function sourceRefs(mod) {
  const cfg = mod.qsConfig;
  return cfg ? [cfg.supplyId,...Object.values(cfg.links||{}).filter(l=>l.terminalId && l.fieldSupplyId !== '@link').map(l=>l.fieldSupplyId)].filter(Boolean) : [];
}
export function qsPowerReserved(design,id){
  return (design.modules||[]).some(mod=>qsLinkCount(mod.productId)&&mod.qsConfig&&(mod.id===id||sourceRefs(mod).includes(id)));
}
export function qsBusIssue(design,bus){
  if(!['dc','qslink'].includes(bus.type))return '';
  const sources=bus.psuModuleIds||[],members=[...(bus.deviceModuleIds||[]),...(design.modules||[]).filter(m=>m.busId===bus.id && !sources.includes(m.id)).map(m=>m.id)];
  const ids=[...sources,...members];
  if(bus.type==='dc' && sources.length && members.length && ids.some(id=>qsPowerReserved(design,id)))return '直流总线中的处理器或电源已在 HQP7 接线中分配';
  if(bus.type==='qslink' && design.modules.some(m=>m.qsConfig && [m.id,...sourceRefs(m),...Object.values(m.qsConfig.links).flatMap(l=>l.members)].some(id=>ids.includes(id))))return '同一设备的 QS 接口已在 HQP7 链路中分配';
  return '';
}
export function clearQsReferences(mod,id){
  const cfg=mod.qsConfig;
  if(!cfg)return;
  // A broken chain must be deliberately rewired before reconnecting its neighbours.
  const removed='!'+id;
  if(cfg.supplyId===id)cfg.supplyId=removed;
  if(cfg.nextProcessorId===id)cfg.nextProcessorId=removed;
  for(const link of Object.values(cfg.links)){
    link.members=link.members.map(member=>member===id?removed:member);
    if(link.fieldSupplyId===id)link.fieldSupplyId=removed;
  }
}
export function qsMainsIssue(design,mod){
  if(!qsReceiver({id:mod.productId}))return '';
  const commonMotor=mod.productId==='lutron-lqse-4m-d';
  const id=mod.protectId || (commonMotor && mod.feedCircuitId);
  if(!id)return '请选择本机市电 L/N/PE 的保护支路';
  if(!(design.circuits||[]).some(c=>c.id===id && c.voltage===220))return '本机市电保护支路须为 220 V';
  if(design.modules.some(m=>(!commonMotor || m.id!==mod.id) && (Object.values(m.channels||{}).includes(id) || (m.id!==mod.id && (m.protectId===id || m.feedCircuitId===id)))))return '本机市电保护支路已分配给负载通道或另一台设备';
  return '';
}

export function qsProblems(design, host, resolve) {
  const cfg=host.qsConfig, errors=[], pending=[];
  if(!cfg)return {errors,pending};
  const hosts=design.modules.filter(m=>qsLinkCount(m.productId) && m.qsConfig);
  const product=id=>resolve(design.modules.find(m=>m.id===id)?.productId);
  const occurrences=(id,list)=>list.filter(v=>v===id).length;
  const allSources=hosts.flatMap(sourceRefs);
  const allMembers=hosts.flatMap(m=>Object.values(m.qsConfig.links||{}).flatMap(l=>l.members||[]));
  const claims=fieldTerminalClaims(design);
  const ownIds=new Set([host.id,...sourceRefs(host),...Object.values(cfg.links).flatMap(l=>l.members)]);
  if((design.buses||[]).some(b=>b.type==='qslink' && [...(b.deviceModuleIds||[]),...(b.psuModuleIds||[]),...design.modules.filter(m=>m.busId===b.id).map(m=>m.id)].some(id=>ownIds.has(id))))errors.push('柜内设备已关联通用 QS 总线，请先解除重复链路');
  if(product(cfg.supplyId)?.id!==QS_HARNESS)errors.push('处理器应选用柜内的 QSPS-DH-1-75-H 线束电源');
  if(genericPowerConflict(design,host.id))errors.push('处理器已有其他电源或旧总线分配，请先解除重复供电');
  for(const id of sourceRefs(host)) {
    if(occurrences(id,allSources)!==1 || genericPowerConflict(design,id))errors.push(id+' 已有其他电源组或直流出线');
  }
  let mainPdu=8,mainMa=250;
  for(const [n,l] of Object.entries(cfg.links)) {
    const tag='QS L'+n+' ';
    const active=l.members.length||l.terminalId;
    if(!active)continue;
    const maxMeters=l.members.some(id=>['lutron-lqse-4t10-d','lutron-lqse-4s10-d'].includes(product(id)?.id))?600:610;
    if(l.meters===null)pending.push(tag+'总线长度待核');
    else if(l.meters<=0 || l.meters>maxMeters)errors.push(tag+'累计线长须大于 0 且不超过 '+maxMeters+' m');
    for(const id of l.members) if(!QS_RECEIVERS.includes(product(id)?.id)||occurrences(id,allMembers)!==1)errors.push(tag+id+' 型号或链路归属冲突');
    const withDali=l.members.some(id=>product(id)?.id==='lutron-lqse-2dal-d');
    let fieldDevices=0;
    if(l.terminalId) {
      const t=product(l.terminalId);
      if(t?.kind!=='terminal'||t.terminalColor!=='gray'||t.poles<4)errors.push(tag+'出柜需要四个独立灰色端子');
      for(let p=1;p<=4;p++)if((claims.get(l.terminalId+':'+p)||[]).some(c=>c.moduleId!==host.id||c.field!=='qs-'+n+'-'+p))errors.push(tag+'端子 '+l.terminalId+':'+p+' 已被占用');
      const viaProcessor=l.fieldSupplyId==='@link';
      if(!viaProcessor && !QS_SUPPLIES.includes(product(l.fieldSupplyId)?.id))errors.push(tag+'请选择现场组的 24V 电源');
      for(const [key,max] of [['fieldPdu',75],['fieldMa',viaProcessor?1000:2500],['fieldDevices',99]]) {
        const v=l[key];
        const msg={fieldPdu:'现场负载 PDU',fieldMa:'现场负载电流 mA',fieldDevices:'现场设备数'}[key];
        if(v===null)pending.push(tag+msg+' 待核');
        else if(v<0||v>max||(key==='fieldDevices' && !Number.isInteger(v)))errors.push(tag+msg+' 超出范围');
      }
      fieldDevices=l.fieldDevices||0;
      if(viaProcessor){mainPdu+=l.fieldPdu||0;mainMa+=l.fieldMa||0;}
    }
    if(l.members.length+fieldDevices>99)errors.push(tag+'设备数超过 99');
    if((withDali||l.terminalId)&&l.fieldOutputs===null)pending.push(tag+'现场负载及可寻址 DALI 驱动器的实际输出数待核');
    const legs=l.members.reduce((sum,id)=>sum+(product(id)?.id==='lutron-lqse-2dal-d'?0:4),0);
    if(l.fieldOutputs<0 || (l.fieldOutputs!=null && !Number.isInteger(l.fieldOutputs)) || legs+(l.fieldOutputs||0)>512)errors.push(tag+'可控输出须为整数且合计不超过 512');
  }
  if(mainPdu>75||mainMa>2500)errors.push('处理器线束组超过 75 PDU 或 2.5 A 总额定');
  return {errors:[...new Set(errors)],pending};
}

export function ethernetProblem(design, host) {
  const next=host.qsConfig?.nextProcessorId;
  if(!next)return '';
  const nodes=design.modules.filter(m=>qsLinkCount(m.productId)), get=id=>nodes.find(m=>m.id===id);
  if(!get(next))return '下一级须为柜内 HQP7-1 或 HQP7-2';
  // Walk the entire connected component so an invalid chain does not emit a valid-looking prefix.
  const todo=[host.id],seen=new Set();
  while(todo.length){
    const id=todo.pop();
    if(seen.has(id))continue;
    seen.add(id);
    const downstream=get(id)?.qsConfig?.nextProcessorId;
    const parents=nodes.filter(m=>m.qsConfig?.nextProcessorId===id);
    if(parents.length>1)return '同一处理器 ETH1 被多个上游占用';
    if(downstream){
      if(!get(downstream))return '级联含缺失的处理器';
      const length=get(id).qsConfig.ethernetMeters;
      if(length!=null && (length<=0||length>100))return '每段以太网长度须大于 0 且不超过 100 m';
      todo.push(downstream);
    }
    todo.push(...parents.map(m=>m.id));
  }
  if(seen.size>5)return '以太网直接级联最多五台处理器';
  const ends=[...seen].filter(id=>!get(id).qsConfig?.nextProcessorId);
  return ends.length?'':'以太网级联不能成环';
}

export function validateQsConfig(design, host, resolve) {
  const {errors}=qsProblems(design, host, resolve);
  const ethernet=ethernetProblem(design,host);
  if(errors.length || ethernet)throw new Error(errors[0]||ethernet);
}
export function qsSummary(mod){
  const cfg=mod.qsConfig;
  if(!cfg)return [];
  const load=Object.values(cfg.links).filter(l=>l.terminalId && l.fieldSupplyId==='@link');
  const total=(key,base)=>load.some(l=>l[key]==null)?'待核':base+load.reduce((n,l)=>n+l[key],0);
  const lines=[{from:cfg.supplyId||'电源待选',to:mod.id+' P / COM',kind:'QS 处理器线束',
    detail:'处理器按典型 8 PDU、额定 250 mA 计；本组 '+total('fieldPdu',8)+' / 75 PDU，'+total('fieldMa',250)+' / 2500 mA'}];
  for(const [n,l] of Object.entries(cfg.links)){
    if(!(l.members.length||l.terminalId))continue;
    const group=l.terminalId?'；现场 '+(l.fieldSupplyId==='@link'?'本链路':l.fieldSupplyId)+' '+(l.fieldPdu??'待核')+' PDU / '+(l.fieldMa??'待核')+' mA':'';
    lines.push({from:mod.id+' QS L'+n,to:[...l.members,l.terminalId].filter(Boolean).join(' → '),kind:'QS 链路',
      detail:(l.meters??'待核')+' m；1 COM、3 MUX、4 MUX̅'+group});
  }
  return lines;
}

export function wireQs({design,nodes,ports,port,add,pending,internal}) {
  const resolve=productId=>[...nodes.values()].find(n=>n.product?.id===productId)?.product;
  const connect=(from,to,conductor,scope,wireClass,section,host)=>{
    const material=wireClass==='network'?'Cat5e 或更高':scope.includes('线束')?'QSPS-DH-1-75-H 线束':
      conductor==='MUX'||conductor==='/MUX'?'QS 屏蔽双绞线':'QS 供电或公共导线';
    add(from,to,{material},{conductor,class:wireClass,scope,moduleId:host,section,qsLink:true});
  };
  for(const node of nodes.values()) {
    const pins=qsTerminalTemplates(node.product);
    if(!pins.length||node.overflow)continue;
    for(const p of pins)port(node.id,p.key);
    if(QS_SUPPLIES.includes(node.product.id)){
      internal.push({a:node.id+':DC+',b:node.id+':PLUS2',always:true,node:node.id},{a:node.id+':DC-',b:node.id+':MINUS2',always:true,node:node.id});
    }
    const links=qsLinkCount(node.product.id);
    for(let n=1;n<=links;n++){
      internal.push({a:node.id+':DC-',b:node.id+':QS'+n+'_1',always:true,node:node.id},
        {a:node.id+':PWR_L'+n,b:node.id+':QS'+n+'_2',always:true,node:node.id});
    }
    if(qsReceiver(node.product)){
      const issue=qsMainsIssue(design,node.module);
      if(issue)pending('QS_DEVICE_MAINS',node.id+'：'+issue,node.id);
    }
    if(node.product?.id==='lutron-lqse-4t10-d')for(const ch of [2,3,4]){
      internal.push({a:node.id+':CH1_MINUS',b:node.id+':CH'+ch+'_MINUS',always:true,node:node.id});
    }
  }
  for(const host of design.modules.filter(m=>qsLinkCount(m.productId)&&m.qsConfig)){
    const cfg=host.qsConfig;
    if(nodes.get(host.id)?.overflow)continue;
    const next=cfg.nextProcessorId;
    if(next){
      const error=ethernetProblem(design,host);
      if(error || nodes.get(next)?.overflow)pending('QS_ETHERNET_INVALID',host.id+'：'+(error||'下级处理器未装入柜内'),host.id);
      else {
        if(!cfg.ethernetMeters)pending('QS_ETHERNET_LENGTH',host.id+' 至 '+next+' 的 Cat5e 线长待核',host.id);
        connect(host.id+':ETH2',next+':ETH1','Cat5e','HQP7 以太网级联 · Cat5e 或更高','network',null,host.id);
      }
    }
    const {errors,pending:notes}=qsProblems(design,host,resolve);
    if([...sourceRefs(host),...Object.values(cfg.links).flatMap(l=>[...l.members,l.terminalId].filter(Boolean))].some(id=>nodes.get(id)?.overflow))errors.push('QS 设备或端子在柜外溢出');
    for(const text of [...errors,...notes])pending('QS_LINK_REVIEW',host.id+'：'+text,host.id);
    if(errors.length)continue;
    const supply=cfg.supplyId;
    // 037260 Rev C fig. 1B: the factory black lead occupies the rightmost negative screw.
    connect(supply+':MINUS2', host.id+':DC-', 'DC-', 'HQP7 线束 · 处理器 COM','dc',null,host.id);
    connect(supply+':DC+', host.id+':DC+', 'DC+', 'HQP7 线束 · 处理器 P','dc',null,host.id);
    for(const [n,l] of Object.entries(cfg.links)){
      const prefix=host.id+':QS'+n+'_',scope='QS L'+n;
      let previous=prefix;
      const signals=[[1,'COM'],[3,'MUX'],[4,'/MUX']];
      // 369610, 369614 and 369650 use shielded twisted data pairs; longer common conductors need a splice at the connector.
      const section=c=>c==='COM'?null:0.5;
      const wire=(from,to,c)=>connect(from,to,c,scope+' · '+c,'comms',section(c),host.id);
      for(const id of l.members){
        for(const [pin,c] of signals)wire(previous+pin,id+':QS_'+pin,c);
        previous=id+':QS_';
      }
      if(!l.terminalId)continue;
      const field=(pin,c)=>{
        const contact=fieldTerminalPort(nodes,l.terminalId+':'+pin,c);
        ports[contact.id]=contact;
        return contact.id;
      };
      for(const [pin,c] of signals.filter(([pin])=>pin!==1))wire(previous+pin,field(pin,c),c);
      if(l.fieldSupplyId==='@link'){
        connect(supply+':PLUS2',host.id+':PWR_L'+n,'DC+',scope+' · 线束链路电源','dc',null,host.id);
        wire(previous+1,field(1,'COM'),'COM');
        connect(prefix+'2',field(2,'DC+'),'DC+',scope+' · 现场链路电源','dc',section('COM'),host.id);
      } else {
        const group=l.fieldSupplyId;
        wire(previous+1,group+':DC-','COM');
        wire(group+':MINUS2',field(1,'COM'),'COM');
        connect(group+':DC+',field(2,'DC+'),'DC+',scope+' · 独立现场电源组','dc',section('COM'),host.id);
      }
    }
  }
}
