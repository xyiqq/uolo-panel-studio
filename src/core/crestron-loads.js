import {fieldTerminalClaims, fieldTerminalPort} from './field-terminals.js';
import {analogCurrentStatus,normalizeAnalogCurrent} from './analog-current.js';

const types = {
  'crestron-din-8sw8-i':'relay', 'crestron-din-4dimflv4':'analog', 'crestron-din-2mc2':'motor',
  'crestron-din-1dim4':'common', 'crestron-din-1dimu4':'common', 'eastron-sdm630-modbus-v2':'threePhase', 'lutron-lqse-4m-d':'commonMotor',
};
export const loadTopology = product => types[product?.id];
export const isCommonAnalog = product => product?.id==='lutron-lqse-4t10-d';
export const analogClassLabel = value => value==='pelv'?'SELV / IEC PELV':value==='nonPelv'?'非 SELV / IEC PELV':'绝缘类别待核';
export const isAnalogOutput = product => loadTopology(product)==='analog' || isCommonAnalog(product);
export const hasDryContacts = product => ['relay','analog'].includes(loadTopology(product)) || ['lutron-lqse-4t10-d','lutron-lqse-4s10-d'].includes(product?.id);
export const hasDirectNeutral = product => hasDryContacts(product) || loadTopology(product)==='motor';

export function addVerifiedLoadPorts(product, add) {
  const type = loadTopology(product);
  if (!type || type==='commonMotor') return false;
  const pin = (key,conductor,io,channel,marking,offsetX,side='top',details={}) =>
    add(key,conductor,side,io,channel,{marking,offsetX,...(type==='analog'&&conductor==='L'?{minWire:0.2,maxWire:2.5}:{}),...details});
  if (type==='threePhase') {
    for (const [i,phase] of ['L1','L2','L3','N'].entries()) {
      for (const out of [false,true]) pin(phase+(out?'_OUT':'_IN'),phase,out?'out':'in',null,
        (i+(out?5:1))+'-'+phase,(i-1.5)*16,out?'bottom':'top',{minWire:4,maxWire:25});
    }
  } else if (type==='common') {
    // Bottom edge: two LIVE screws, five NEUTRAL, four DIMMED LIVE and five PE.
    pin('L_IN','L','in',null,'LIVE(1)',-23,'bottom');
    pin('L_LINK','L','both',null,'LIVE(2)',-18,'bottom');
    for (let i=0;i<=4;i++) {
      pin(i?'CH'+i+'_N':'N_IN','N',i?'out':'in',i||null,'N('+(i+1)+')',-13+i*5,'bottom');
      pin(i?'CH'+i+'_PE':'PE_IN','PE',i?'out':'in',i||null,'PE('+(i+1)+')',32+i*5,'bottom');
      if (i) pin('CH'+i+'_OUT','L','out',i,'DIM'+i,7+i*5,'bottom');
    }
  } else {
    for(let ch=1;ch<=product.channels;ch++) {
      const x=type==='analog'?[-13,7,40,60][ch-1]:type==='motor'?(ch===1?-31:21):-68+(ch-1)*19;
      pin('CH'+ch+'_IN','L','in',ch,type==='motor'?'M'+ch+'-L':'CH'+ch+'_IN',x);
      if (type==='motor') {
        pin('CH'+ch+'_OP','L','out',ch,'M'+ch+'-OP',x+5);
        pin('CH'+ch+'_CL','L','out',ch,'M'+ch+'-CL',x+10);
      } else pin('CH'+ch+'_OUT','L','out',ch,'CH'+ch+'_OUT',x+5);
      if (type==='analog') {
        const ax=[-67,-59.5,-49.5,-42.5][ch-1];
        pin('CH'+ch+'_PLUS','0-10V+','out',ch,'DIM'+ch+'+',ax,'top',{minWire:0.08,maxWire:2.5});
        pin('CH'+ch+'_MINUS','0-10V-','out',ch,'DIM'+ch+'-',ax+3.5,'top',{minWire:0.08,maxWire:2.5});
      }
    }
  }
  return true;
}

export function loadSettings(raw) {
  const type=loadTopology({id:raw.productId}), count=type==='relay'?8:type==='threePhase'?1:4;
  const settings={};
  if (hasDryContacts({id:raw.productId})||type==='threePhase') {
    settings.seriesStages={};
    for(let ch=1;ch<=count;ch++) {
      const n=Number(raw.seriesStages?.[ch]);
      if(Number.isSafeInteger(n)&&n>=1) settings.seriesStages[ch]=n;
    }
  }
  if(isAnalogOutput({id:raw.productId})) {
    if(isCommonAnalog({id:raw.productId})) settings.analogCircuitClass=['pelv','nonPelv'].includes(raw.analogCircuitClass)?raw.analogCircuitClass:'';
    settings.analogTerminals={};
    for(let ch=1;ch<=4;ch++){
      const pair=raw.analogTerminals?.[ch] || {};
      const clean=v=>typeof v==='string'?v.trim().slice(0,40):'';
      const current=normalizeAnalogCurrent(pair);
      if(pair.plus||pair.minus||Object.keys(current).length) {
        const section=Number(pair.section);
        settings.analogTerminals[ch]={plus:clean(pair.plus),minus:clean(pair.minus),...current,
          ...(Number.isFinite(section)&&section>0?{section}:{})};
      }
    }
  }
  return settings;
}

export function wireAnalogFields({design,nodes,ports,wires,port,add,pending}) {
  const claims=fieldTerminalClaims(design);
  for(const mod of design.modules){
    const product=nodes.get(mod.id)?.product;
    if(!isAnalogOutput(product)) continue;
    const common=isCommonAnalog(product), grade=analogClassLabel(mod.analogCircuitClass);
    if(common&&Object.values(mod.analogTerminals||{}).some(pair=>pair?.plus||pair?.minus)&&!['pelv','nonPelv'].includes(mod.analogCircuitClass))
      pending('MODULE_ANALOG_CIRCUIT_CLASS',mod.id+'：四区共用负端，请按全部驱动器铭牌统一确认 SELV/IEC PELV 或非 SELV/IEC PELV。',mod.id);
    for(const [channel,pair] of Object.entries(mod.analogTerminals || {})){
      const budget=analogCurrentStatus(product,pair);
      const label=mod.id+' CH'+channel+' · 0–10 V · '+budget.detail;
      if(budget.error){
        pending('MODULE_ANALOG_INCOMPATIBLE',label+'；'+budget.error+'，不生成本路 DIM 信号对。',mod.id,mod.channels?.[channel],'error');
        continue;
      }
      if(!pair?.plus&&!pair?.minus) continue;
      if(budget.pending)pending('MODULE_ANALOG_CURRENT_UNKNOWN',label+'，请按驱动器铭牌核对。',mod.id,mod.channels?.[channel]);
      const outputs=['plus','minus'].map(polarity=>{
        const target=pair[polarity], sign=polarity==='plus'?'+':'-';
        const endpoint=fieldTerminalPort(nodes,target,'0-10V'+sign);
        const owners=claims.get(target);
        const source=port(mod.id,'CH'+channel+'_'+polarity.toUpperCase());
        return endpoint&&source&&owners?.length===1&&owners[0].field==='analog-'+channel+'-'+polarity?{endpoint,source,sign}:null;
      });
      if(outputs.some(x=>!x)||!wires.some(w=>w.from===mod.id+':CH'+channel+'_OUT')) {
        pending('MODULE_ANALOG_TARGET',mod.id+' CH'+channel+'：0–10V 需有效负载回路及两个独占的灰色端子。',mod.id,mod.channels?.[channel]); continue;
      }
      for(const {endpoint,source,sign} of outputs){
        ports[endpoint.id]=endpoint;
        add(source.id,endpoint.id,null,{class:'signal',conductor:'0-10V'+sign,scope:'0–10V 调光 '+sign+' · '+budget.detail+(common?' · '+grade:''),moduleId:mod.id,circuit:mod.channels[channel],section:Number(pair.section)>0?Number(pair.section):null});
      }
    }
  }
}

export function wireMotorOutput({design,circuit,chain,nodes,modules,ports,port,originalOutput,add,remove,pending,bindings,phase}){
  const motor=chain.find(d=>['motor','commonMotor'].includes(loadTopology(nodes.get(d.moduleId)?.product)));
  if(!motor) return false;
  const {moduleId:id,channel}=motor, node=nodes.get(id), mod=modules.get(id);
  const common=loadTopology(node.product)==='commonMotor';
  const shared=mod.feed==='shared';
  const feederId=shared?(mod.feedCircuitId||mod.protectId):circuit.id;
  const source=nodes.get(feederId+'-RCD')||nodes.get(feederId);
  const feeder=design.circuits.find(c=>c.id===feederId);
  const phaseFeed=originalOutput(feederId,phase), neutralFeed=originalOutput(feederId,'N'), earthFeed=originalOutput(feederId,'PE');
  const line=originalOutput(circuit.id,phase), neutral=originalOutput(circuit.id,'N'), earth=originalOutput(circuit.id,'PE');
  const input=port(id,common?'L_IN':'CH'+channel+'_IN',phase),open=port(id,'CH'+channel+'_OP',phase),close=port(id,'CH'+channel+'_CL',phase);
  const otherFeederOwner=common && design.modules.some(m=>m.id!==id && (m.protectId===feederId || m.feedCircuitId===feederId || Object.values(m.channels||{}).includes(feederId)));
  if(chain.length!==1||circuit.voltage!==220||(common?!shared:!['shared','perChannel'].includes(mod.feed))||!source||source.overflow||node.overflow
      ||!input||!open||!close||!line||!neutral||!phaseFeed||!neutralFeed||feeder?.voltage!==220||phaseFeed.from!==source.id+':'+phase+'_OUT'
      ||(common&&(!earthFeed||!earth||otherFeederOwner||(mod.protectId&&mod.feedCircuitId&&mod.protectId!==mod.feedCircuitId)))){
    pending('MODULE_MOTOR_FEED',id+(common?'：四个电机由同一受保护的单相 L/N/PE 馈电，各路取电相别须一致。':'：每个双向电机须单独指定有保护的单相回路。'),id,circuit.id);
    return true;
  }
  const target=ports[line.to], closing=target.node+':CL';
  ports[line.to]={...target,displayTag:target.node+'.OP'};
  ports[closing]={...target,id:closing,key:'CL',x:target.x-4,displayTag:target.node+'.CL'};
  const meta={moduleId:id,circuit:circuit.id,breakerId:feederId};
  remove(line);
  add(phaseFeed.from,input.id,phaseFeed,{...meta,moduleFeed:true,scope:common?'共用电机电源 L':'电机通道负载火线'});
  add(open.id,target.id,{...phaseFeed,section:line.section},{...meta,scope:'电机开向 OP'});
  add(close.id,closing,{...phaseFeed,section:line.section},{...meta,scope:'电机关向 CL'});
  if(common){
    // Lutron 369614b p.4: each zone has two direction screws. N branches before the module.
    add(neutralFeed.from,port(id,'N_IN','N').id,neutralFeed,{...meta,moduleFeed:true,scope:'共用电机电源 N'});
    add(earthFeed.from,port(id,'PE_IN','PE').id,earthFeed,{...meta,moduleFeed:true,scope:'电机控制器保护地'});
  }
  if(neutral.from!==neutralFeed.from){
    remove(neutral);add(neutralFeed.from,neutral.to,{...neutralFeed,section:neutral.section},{...meta,scope:'保护支路 N 分配 → 电机'});
  }
  // Both contacts are open at rest. A run command needs an explicit direction.
  if(!bindings.some(b=>b.moduleId===id&&b.breakerId===feederId)) bindings.push({...meta,sourceId:source.id,phase,explicit:true,channel});
  return true;
}
export function wireCommonDimmer({circuit,chain,nodes,modules,port,originalOutput,add,remove,internal,pending,bindings,phase,design}){
  const dimmer=chain.find(d=>loadTopology(nodes.get(d.moduleId)?.product)==='common');
  if(!dimmer) return false;
  const {moduleId:id,channel}=dimmer,mod=modules.get(id),sourceId=mod.feedCircuitId||mod.protectId;
  const source=nodes.get(sourceId+'-RCD')||nodes.get(sourceId);
  const feeder=design.circuits.find(c=>c.id===sourceId);
  const wanted=['L','N','PE'];
  const legs=wanted.map(key=>{
    const conductor=key==='L'?phase:key;
    return {key,src:originalOutput(sourceId,conductor),load:originalOutput(circuit.id,conductor),
      input:port(id,key+'_IN',conductor),out:port(id,'CH'+channel+'_'+(key==='L'?'OUT':key),conductor)};
  });
  if(chain.length!==1||mod.feed!=='shared'||feeder?.voltage!==220||circuit.voltage!==220||!source||source.overflow||nodes.get(id).overflow
     ||legs.some(leg=>!leg.src||!leg.load||!leg.input||!leg.out)||legs[0].src.from!==source.id+':'+phase+'_OUT'){
    pending(mod.feed==='perChannel'?'MODULE_NEUTRAL_UNVERIFIED':'MODULE_FEED_CONFLICT',id+'：该型号只有一组共用市电输入，请为所有通道选同相的一路保护支路。',id,circuit.id);return true;
  }
  const refs={moduleId:id,breakerId:sourceId,circuit:circuit.id};
  for(const {key,src,load,input,out} of legs){
    remove(load);
    add(src.from,input.id,src,{...refs,moduleFeed:true,scope:'共用负载 '+key});
    add(out.id,load.to,{...src,section:load.section},{...refs,scope:key==='L'?'模块链 → 出箱端子':'通道 '+key+' → 出箱端子'});
    if(key==='L') internal.push({a:input.id,b:out.id,node:id,moduleChannel:channel});
  }
  if(!bindings.some(b=>b.moduleId===id)) bindings.push({...refs,sourceId:source.id,phase,explicit:true});
  return true;
}
