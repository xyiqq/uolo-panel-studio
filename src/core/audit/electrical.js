import {resolveModuleFeedBindings,isMainsFedModule} from '../module-feeds.js';
import {rowZoneIssues} from '../row-zones.js';
import {loadPowerInput} from '../ports.js';

/** 根据方案已知数据做预检查；未知额定与未录入负荷保留待核。 */
export function auditElectrical(design,assembly,net,budgets=[]) {
  const issues=[], nodes=new Map((assembly.nodes||[]).map(n=>[n.id,n]));
  const bindings=net?.moduleFeedBindings||resolveModuleFeedBindings(assembly,design);
  const add=(code,level,ref,message)=>issues.push({code,level,ref,message});
  const liveWires=(net?.wires||[]).filter(w=>w.connected!==false&&!(design.disconnected||[]).includes(w.id));
  const positive=value=>Number.isFinite(value)&&value>0;
  for(const mod of design.modules||[]){
    const node=nodes.get(mod.id),p=node?.product;if(!p)continue;
    if(p.outletCount&&!p.dimensionsVerified)add('PDU_DIMENSIONS_PENDING','pending',mod.id,`${mod.id} PDU部分尺寸为示意初值，请在属性栏按实物修订；插位备注不代表已核实供电连接`);
    let total=0;
    const circuits=new Map((design.circuits||[]).map(c=>[c.id,c]));
    for(const [ch,id] of Object.entries(mod.channels||{})){
      if(!id)continue;
      const c=circuits.get(id),loads=(design.loads||[]).filter(l=>c?.loadIds?.includes(l.id)&&l.enabled!==false&&!l.metadata);
      if(!c||!loads.length||loads.some(l=>!Number.isFinite(l.watts)||l.watts<0)||!positive(c.pf)||c.pf>1||![220,380].includes(c.voltage)) {add('CHANNEL_LOAD_UNKNOWN','pending',mod.id,`${mod.id} 通道 ${ch}（${id}）负荷、电压或功率因数未完整有效录入`);continue;}
      const watts=loads.reduce((sum,l)=>sum+l.watts,0),amps=watts/((c.voltage===380?Math.sqrt(3)*380:220)*c.pf);total+=amps;
      if(positive(p.channelAmps)) {if(amps>p.channelAmps)add('CHANNEL_OVERCURRENT','error',mod.id,`${mod.id} 通道 ${ch}（${id}）估算 ${amps.toFixed(2)} A，超过通道额定 ${p.channelAmps} A`);}
      else add('CHANNEL_RATING_UNKNOWN','pending',mod.id,`${mod.id} 通道 ${ch}（${id}）适用负载类型的额定电流待核`);
      if(positive(p.channelWatts)&&watts>p.channelWatts)add('CHANNEL_OVERPOWER','error',mod.id,`${mod.id} 通道 ${ch}（${id}）${watts} W 超过额定 ${p.channelWatts} W`);
    }
    const rating=p.totalAmps??p.amps;
    if(Object.values(mod.channels||{}).some(Boolean)) {
      if(positive(rating)&&total>rating)add('MODULE_TOTAL_OVERCURRENT','error',mod.id,`${mod.id} 已知负荷通道合计至少 ${total.toFixed(2)} A，超过模块总额定 ${rating} A`);
      if(!positive(rating))add('MODULE_TOTAL_UNKNOWN','pending',mod.id,`${mod.id} 模块总额定电流待核`);
    }
    if(isMainsFedModule(p)){
      const feeds=bindings.filter(b=>b.moduleId===mod.id);
      if(!feeds.length)add('MODULE_PROTECTION_MISSING','pending',mod.id,`${mod.id} 未确定上游保护回路`);
      for(const feed of feeds){
        const breaker=nodes.get(feed.breakerId),amps=breaker?.product?.amps;
        const allowed=p.maxUpstreamAmps??(mod.feed==='perChannel'?p.channelAmps:rating);
        if(positive(allowed)&&positive(amps)&&amps>allowed)add('MODULE_PROTECTION_RATING','error',mod.id,`${mod.id} 上游 ${feed.breakerId} 为 ${amps} A，超过已录入配合额定 ${allowed} A`);
        else if(!positive(allowed)||!positive(amps))add('MODULE_PROTECTION_UNKNOWN','pending',mod.id,`${mod.id} 与 ${feed.breakerId} 的上游保护器或模块配合额定待核`);
        const rcd=nodes.get(`${feed.breakerId}-RCD`);
        if(!breaker?.product?.residual&&!rcd)add('ELECTRONIC_RCD_REVIEW','warning',mod.id,`${mod.id} / ${feed.breakerId} 未配置漏保，请按厂家和现场要求核对适用性与类型`);
      }
      if(loadPowerInput(p)==='LN'&&p.id!=='crestron-din-8sw8-i'&&!liveWires.some(w=>(w.to===`${mod.id}:N_IN`||w.from===`${mod.id}:N_IN`)&&(!w.conductor||w.conductor==='N')&&(!net?.ports?.[w.from]||net.ports[w.from].conductor==='N')))add('MODULE_NEUTRAL_MISSING','error',mod.id,`${mod.id} 负载侧需要 N 输入，当前没有有效零线接入`);
    }
    if(p.mounting==='shelf')add('SWITCH_MOUNT_REVIEW','pending',mod.id,`${mod.id} 为非 DIN 交换机，需核实托板固定、${p.powerInput==='ac-inlet'?'交流电源线':'适配器'}及网线弯曲空间`);
    if(p.protocol?.some(v=>['wifi','zigbee','bluetooth','thread'].includes(v)))add('METAL_CABINET_RADIO','warning',mod.id,`${mod.id} 含无线协议，金属箱内需实测信号或外置天线方案`);
  }
  for(const b of budgets){
    if(!b.usedKnown||!b.capacityKnown)add('BUS_PARAMETERS_UNKNOWN','pending',b.id,`${b.label||b.id} 预算待核：${b.pending?.join('；')||'容量未确认'}`);
    if(b.type==='dc'&&b.utilization>.8)add('DC_RESERVE','warning',b.id,`${b.label||b.id} 使用率 ${(b.utilization*100).toFixed(1)}%，超过本工具 80% 设计余量提醒值（非厂家硬性额定）`);
  }
  for(const bus of design.buses||[]){
    if(bus.segregation!=='SELV')continue;
    for(const id of [...(bus.psuModuleIds||[]),...(bus.deviceModuleIds||[])]){
      const n=nodes.get(id);if(!n||n.overflow)continue;
      if([...nodes.values()].some(other=>!other.overflow&&other.row===n.row&&other.product?.zone!=='control'))add('SELV_ROW_REVIEW','warning',id,`${id} 的 SELV 总线与强电器件同排，需核实隔板及线路隔离；分排不代替绝缘核验`);
    }
  }
  return [...issues,...rowZoneIssues(design,assembly)];
}
