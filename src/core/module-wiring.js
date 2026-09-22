import {buildPortTemplates, dcInputVoltage, loadPowerInput, acceptsExternalDaliPower} from './ports.js';

/** Explicit saved assignments drive these wires; unspecified electrical links stay pending. */
export function applyModuleWiring(net, design) {
  if (!design.modules?.length) return net;
  const ports = {...net.ports}, wires = [...net.wires], internal = [...net.internal];
  const issues = [], bindings = [...(net.moduleFeedBindings || [])];
  const nodes = new Map(net.nodes.map(n => [n.id, n]));
  const modules = new Map(design.modules.map(m => [m.id, m]));
  const pending = (code, text, moduleId, circuit) => issues.push({level:'pending', code, text, moduleId, circuit});
  const port = (id, key, conductor) => {
    const node = nodes.get(id);
    if (!node) return null;
    const templates = buildPortTemplates(node.product), template = templates.find(p => p.key === key);
    if (!template) return null;
    const side = templates.filter(p => p.side === template.side), index = side.indexOf(template);
    const pid = `${id}:${key}`;
    return ports[pid] ||= {id:pid, node:id, key, conductor:conductor || template.conductor,
      side:template.side, x:node.x + (index - (side.length - 1) / 2) * Math.min(12, (node.product.width || 18) / (side.length + 1)),
      y:node.y + (template.side === 'top' ? 1 : -1) * (node.product.height || 86) / 2,
      z:(node.product.depth || 60) + 3, minWire:node.product.minWire || .5, maxWire:node.product.maxWire || 35};
  };
  const add = (from, to, template, metadata={}) => {
    if (!from || !to) return;
    const id = `module-wire:${from}>${to}`;
    if (wires.some(w => w.id === id)) return;
    const {externalSection, ...base} = template || {};
    wires.push({...base, ...metadata, id, from, to, class:metadata.class || 'power', lengthKind:'internal',
      section:design.wireOverrides?.[id] ?? (Object.hasOwn(metadata,'section') ? metadata.section : base.section ?? 1.5), material:base.material || 'Cu/PVC',
      connected:base.connected !== false && !design.disconnected?.includes(id)});
  };
  const remove = wire => { const i=wires.indexOf(wire); if(i>=0) wires.splice(i,1); };
  const originalOutput = (cid, conductor) => net.wires.find(w => w.to === `X-${cid}:${conductor}`);
  if (design.uiMode === 'full') for (const circuit of design.circuits || []) {
    const assigned = design.modules.flatMap(m => Object.entries(m.channels || {}).filter(([,id]) => id === circuit.id)
      .map(([channel]) => ({moduleId:m.id, channel:Number(channel), role:nodes.get(m.id)?.product?.kind === 'meter' ? 'meter' : 'control'})));
    const saved=(circuit.devices || []).filter(d=>!['protection','rcd'].includes(d.role));
    const chain=saved.length?saved:assigned.sort((a,b)=>(a.role==='meter')-(b.role==='meter'));
    if (!chain.length) continue;
    const key=d=>`${d.role}:${d.moduleId}:${Number(d.channel)}`;
    if(chain.length!==assigned.length || new Set(chain.map(key)).size!==chain.length
      || chain.some(d=>!assigned.some(a=>key(a)===key(d)))) {
      pending('MODULE_CHAIN_ASSIGNMENT',`${circuit.id}：已保存的设备链与模块通道归属不一致或重复，请重新确认顺序。`,null,circuit.id);continue;
    }
    if(new Set(chain.map(d=>d.moduleId)).size!==chain.length || chain.filter(d=>d.role==='control').length>1) {
      pending('MODULE_CHAIN_MULTISTAGE',`${circuit.id}：存在重复模块或多级控制器，须明确级间馈电方式，未自动串联。`,null,circuit.id);continue;
    }
    const sharedNeutral=chain.find(d=>{
      const m=modules.get(d.moduleId),p=nodes.get(d.moduleId)?.product;
      return m.feed==='perChannel' && loadPowerInput(p)==='LN' && p.id!=='crestron-din-8sw8-i'
        && new Set(Object.values(m.channels || {}).filter(Boolean)).size>1;
    });
    if(sharedNeutral) {pending('MODULE_NEUTRAL_UNVERIFIED',`${sharedNeutral.moduleId}：逐通道来自多个保护回路，但目录未确认独立零线端口；请核实端子图后接线，避免混接零线。`,sharedNeutral.moduleId,circuit.id);continue;}
    const phase = design.supply === 'single' ? 'L1' : circuit.phase;
    const original = originalOutput(circuit.id, phase);
    if (!original || circuit.voltage !== 220) { pending('MODULE_CHAIN_PHASE',`${circuit.id}：当前模块链仅支持单相回路，请核对相制。`,null,circuit.id); continue; }
    const invalid = chain.find(d => !['relay','dimmer','contactor','timer','meter'].includes(nodes.get(d.moduleId)?.product?.kind)
      || (d.role !== 'meter' && !['shared','perChannel'].includes(modules.get(d.moduleId)?.feed)));
    if (invalid) { pending('MODULE_FEED_UNSET',`${invalid.moduleId}：请设置共用或逐通道馈电后生成接线。`,invalid.moduleId,circuit.id); continue; }
    let sourceCircuit=circuit.id;
    const first=modules.get((chain.find(d=>d.role==='control') || chain[0]).moduleId);
    if (first.feed === 'shared') sourceCircuit=first.feedCircuitId || first.protectId;
    const source=originalOutput(sourceCircuit,phase);
    if (!source || chain.some(d => {
      const m=modules.get(d.moduleId);
      return m.feed==='shared' && (m.feedCircuitId || m.protectId)!==sourceCircuit;
    })) { pending('MODULE_FEED_CONFLICT',`${circuit.id}：共用馈电未指定、相别不符或链路电源冲突，请核对。`,first.id,circuit.id); continue; }
    const missing=chain.find(device=>{
      const node=nodes.get(device.moduleId), mod=modules.get(device.moduleId), meter=device.role==='meter';
      const required=[meter?'L_IN':`CH${device.channel}_IN`,meter?'L_OUT':`CH${device.channel}_OUT`];
      if(mod.feed==='shared' && !meter && device===chain[0]) required.push('L_IN');
      if(loadPowerInput(node.product)==='LN' && node.product.id!=='crestron-din-8sw8-i') required.push('N_IN',...(meter?['N_OUT']:[]));
      return required.some(key=>!buildPortTemplates(node.product).some(p=>p.key===key));
    });
    if(missing || !originalOutput(sourceCircuit,'N') || !originalOutput(circuit.id,'N')) {
      pending('MODULE_CHAIN_PORT_MISSING',`${circuit.id}：链路端子或零线来源不完整，保留原接线并待核。`,missing?.moduleId,circuit.id);continue;
    }
    let previous=source.from;
    for (const device of chain) {
      const node=nodes.get(device.moduleId), mod=modules.get(device.moduleId), meter=device.role==='meter';
      const input=port(mod.id,meter?'L_IN':`CH${device.channel}_IN`,phase);
      const output=port(mod.id,meter?'L_OUT':`CH${device.channel}_OUT`,phase);
      if (mod.feed==='shared' && !meter && device===chain[0]) {
        const common=port(mod.id,'L_IN',phase);
        add(previous,common.id,source,{scope:node.product.loadPowerInput==='LN'?'共用负载供电':'共用模块馈电',moduleFeed:true,moduleId:mod.id,breakerId:sourceCircuit,circuit:circuit.id});
        add(common.id,input.id,source,{scope:'共用馈电 → 通道',moduleId:mod.id,circuit:circuit.id});
      } else add(previous,input.id,source,{scope:meter?'控制器 → 电表':node.product.loadPowerInput==='LN'?'逐通道负载供电':'逐通道馈电',moduleFeed:!meter,moduleId:mod.id,breakerId:sourceCircuit,circuit:circuit.id});
      internal.push({a:input.id,b:output.id,node:mod.id,always:meter,moduleChannel:device.channel});
      if (!bindings.some(b => b.moduleId===mod.id && b.breakerId===sourceCircuit)) bindings.push({moduleId:mod.id,breakerId:sourceCircuit,sourceId:ports[source.from]?.node,phase,explicit:true});
      previous=output.id;
    }
    remove(original);
    add(previous,original.to,{...source,section:original.section},{scope:'模块链 → 出箱端子',circuit:circuit.id});
    const neutral=originalOutput(sourceCircuit,'N'), oldNeutral=originalOutput(circuit.id,'N');
    if(neutral && oldNeutral) {
      let n=neutral.from;
      for(const device of chain) {
        const node=nodes.get(device.moduleId);
        if(node.product.id==='crestron-din-8sw8-i' || loadPowerInput(node.product)!=='LN') continue;
        const input=port(node.id,'N_IN','N');
        if(input) add(n,input.id,neutral,{scope:node.product.loadPowerInput==='LN'?'负载零线':'模块零线',moduleFeed:true,moduleId:node.id,breakerId:sourceCircuit,circuit:circuit.id});
        if(device.role==='meter') {
          const output=port(node.id,'N_OUT','N');
          internal.push({a:input.id,b:output.id,node:node.id,always:true}); n=output.id;
        }
      }
      const relay=chain.find(d=>nodes.get(d.moduleId)?.product?.id==='crestron-din-8sw8-i');
      const metadata=relay?{moduleNeutral:true,moduleId:relay.moduleId,breakerId:sourceCircuit}:{};
      if(n!==oldNeutral.from || sourceCircuit!==circuit.id) {remove(oldNeutral); add(n,oldNeutral.to,{...neutral,section:oldNeutral.section},{...metadata,scope:'负载零线',circuit:circuit.id});}
      else if(relay) {const index=wires.indexOf(oldNeutral);if(index>=0) wires[index]={...oldNeutral,...metadata};}
    }
  }
  const busDevices = bus => [...new Set([...(bus.deviceModuleIds || []),...design.modules.filter(m=>m.busId===bus.id).map(m=>m.id)])]
    .filter(id=>!bus.psuModuleIds?.includes(id));
  // Resolve all saved buses together before drawing any wire: separate buses must
  // not silently parallel power supplies at the same receiver terminals.
  const receiverSources = new Map();
  const receiverKey = (bus, id) => `${id}:${bus.type==='dc'?'DC':'BUS'}`;
  for(const bus of design.buses || []) {
    if(!['dc','knx','dali'].includes(bus.type)) continue;
    for(const id of busDevices(bus)) {
      const key=receiverKey(bus,id), sources=receiverSources.get(key) || new Set();
      for(const source of bus.psuModuleIds || []) sources.add(source);
      receiverSources.set(key,sources);
    }
  }
  for(const bus of design.buses || []) {
    const sources=[...new Set(bus.psuModuleIds || [])].map(id=>nodes.get(id)).filter(Boolean);
    const devices=busDevices(bus);
    if(!devices.length) continue;
    if(sources.length!==1 || new Set(bus.psuModuleIds || []).size!==1) {pending('BUS_SOURCE_UNRESOLVED',`${bus.label || bus.id}：需要明确一个电源，不能自动并联或猜测电源。`);continue;}
    const source=sources[0], dc=bus.type==='dc';
    if(!dc && !['knx','dali'].includes(bus.type)) {pending('BUS_PINOUT_UNVERIFIED',`${bus.label || bus.id}：${bus.type} 端子定义尚待核实，未自动生成通信线。`);continue;}
    for(const id of devices) {
      if(receiverSources.get(receiverKey(bus,id))?.size>1) {
        pending('BUS_DEVICE_SOURCE_CONFLICT',`${id}：下端端子关联了多个电源，请保留一个供电来源；未自动并联接线。`,id);continue;
      }
      const node=nodes.get(id);
      if(bus.type==='dali' && !acceptsExternalDaliPower(node?.product)) {
        pending('DALI_INTERNAL_SUPPLY_CONFLICT',`${id}：模块带内置 DALI 电源，尚未确认关闭或隔离；未连接外置 DALI 电源。`,id);continue;
      }
      const voltage=source.product.psuOutput?.voltage;
      const compatible=dc ? [12,24].includes(voltage) && (bus.voltage==null || bus.voltage===voltage) && dcInputVoltage(node?.product)===voltage
        : source.product.protocol?.includes(bus.type) && node?.product?.protocol?.includes(bus.type);
      const keys=dc?['DC+','DC-']:['BUS+','BUS-'];
      if(!compatible || keys.some(key=>!port(source.id,key) || !port(id,key))) {pending('BUS_DEVICE_UNVERIFIED',`${id}：${bus.label || bus.id} 电压、协议或端口不匹配，未自动接线。`,id);continue;}
      const section=Number.isFinite(bus.section) && bus.section>0?bus.section:null;
      if(section===null) pending('BUS_SECTION_UNVERIFIED',`${bus.label || bus.id} → ${id}：线径尚未填写，请按厂家端子和线缆要求确认。`,id);
      for(const key of keys) add(`${source.id}:${key}`,`${id}:${key}`,null,{scope:dc?`${voltage}V 模块控制供电`:`${bus.type.toUpperCase()} 总线`,class:dc?'dc':'comms',conductor:key,busId:bus.id,moduleId:id,section});
    }
  }
  return {...net,ports,wires,internal,moduleFeedBindings:bindings,wiringIssues:issues};
}
