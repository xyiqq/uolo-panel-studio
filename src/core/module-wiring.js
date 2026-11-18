import {buildPortTemplates, dcInputVoltage, hasIndependentLoadFeeds, isCresnetController, isCresnetChainSupply, loadPowerInput, acceptsExternalDaliPower} from './ports.js';
import {isCresnetDataBus, wireCresnetBuses} from './cresnet.js';
import {isCresnetReceiver} from './ports.js';
import {wireSerialMeters} from './serial-rs485.js';
import {loadTopology,hasDryContacts,hasDirectNeutral,wireAnalogFields,wireMotorOutput,wireCommonDimmer} from './crestron-loads.js';
import {wireThreePhaseMeters,isolateMeterLoad} from './sdm630.js';
import {isMainsFedModule} from './module-feeds.js';
import {DALI_LOOPS, daliSourcePin, isDinDali2, isIndexedDaliSupply, wireDaliLoops} from './dali-power.js';
import {wireQs,qsBusIssue} from './qs-link.js';
import {abbDaliLines,isMdtBusSupply,wireDaliFieldLoops} from './abb-dali.js';
import {DIMMER_JUMPER_PARTS, dimmerBridgeLabel, dimmerGroupUsesIncludedJumpers, dimmerOutputGroups, normalizeDimmerBridgeMode} from './dimmer-bridging.js';

/** Explicit saved assignments drive these wires; unspecified electrical links stay pending. */
export function applyModuleWiring(net, design) {
  if (!design.modules?.length) return net;
  const ports = {...net.ports}, wires = [...net.wires], internal = [...net.internal];
  const issues = [], bindings = [...(net.moduleFeedBindings || [])];
  const nodes = new Map(net.nodes.map(n => [n.id, n]));
  const modules = new Map(design.modules.map(m => [m.id, m]));
  const pending = (code, text, moduleId, circuit, level='pending') => issues.push({level, code, text, moduleId, circuit});
  const dimmers = net.nodes.filter(n => n.role === 'module' && hasIndependentLoadFeeds(n.product));
  const dimmerOutputs = new Map(dimmers.map(({id}) => [id, new Map()]));
  const outputTerminals = new Set(design.modules.flatMap(mod => Object.values(mod.terminalConnections || {}).map(row => row?.output)));
  const otherFeedIds = new Set(design.modules.filter(m => isMainsFedModule(nodes.get(m.id)?.product))
    .flatMap(m => [m.protectId, m.feedCircuitId]).filter(Boolean));
  const circuits = design.circuits || [];
  const circuitIds = new Set(circuits.map(c => c.id));
  for (const {id} of dimmers) {
    const mod = modules.get(id);
    const groups = dimmerOutputGroups(mod?.bridgeMode);
    if (!groups) {
      pending('MODULE_DIMMER_BRIDGE_INVALID', `${id}：桥接组合不在厂家配置表中，请重新选择后生成负载接线。`, id);
      continue;
    }
    const assigned = Object.values(mod?.channels || {}).filter(Boolean);
    if (!assigned.length || mod.feed !== 'perChannel') {
      pending('MODULE_INDEPENDENT_FEED_REQUIRED', `${id}：请为使用中的独立通道或桥接组各选一路单相支路。`, id);
    }
    for (const cid of new Set(assigned)) {
      if (!circuitIds.has(cid)) pending('MODULE_INDEPENDENT_FEED_INVALID', `${id}：所选支路 ${cid} 不存在。`, id, cid);
    }
    for (const group of groups) {
      const [leader, ...followers] = group;
      if (!dimmerGroupUsesIncludedJumpers(group)) {
        pending('MODULE_DIMMER_BRIDGE_JUMPER_UNVERIFIED', `${id} ${group.map(ch => `CH${ch}`).join(' + ')}：随附跨接件仅适用相邻通道，本组所需跨接件待厂家确认。`, id, mod?.channels?.[leader]);
        continue;
      }
      const conflicting = followers.find(ch => mod?.channels?.[ch] || outputTerminals.has(`${id}:CH${ch}_OUT`));
      if (conflicting) {
        pending('MODULE_DIMMER_BRIDGE_CHANNEL_CONFLICT', `${id} CH${conflicting}：请解除该通道的独立支路或端子关联，桥接组由 CH${leader} 分配。`, id, mod?.channels?.[leader]);
        continue;
      }
      dimmerOutputs.get(id).set(leader, group);
    }
  }
  const port = (id, key, conductor) => {
    const node = nodes.get(id);
    if (!node) return null;
    const templates = buildPortTemplates(node.product), template = templates.find(p => p.key === key);
    if (!template) return null;
    const side = templates.filter(p => p.side === template.side), index = side.indexOf(template);
    const pid = `${id}:${key}`;
    const hasPosition = template.offsetX != null;
    const existing = ports[pid];
    if (existing && (!hasPosition || existing.displayTag)) return existing;
    return ports[pid] = {id:pid, node:id, key, conductor:conductor || existing?.conductor || template.conductor,
      side:template.side,
      x:node.x + (template.offsetX ?? (index - (side.length - 1) / 2) * Math.min(12, (node.product.width || 18) / (side.length + 1))),
      y:node.y + (template.side === 'top' ? 1 : -1) * ((node.product.height || 86) / 2 - (template.inset ?? (hasPosition ? 5 : 0))),
      z:(node.product.depth || 60) + (hasPosition ? 8 : 3),
      minWire:template.minWire ?? (node.product.minWire || .5), maxWire:template.maxWire ?? (node.product.maxWire || 35),
      ...(template.marking ? {marking:template.marking, displayTag:`${id}.${template.marking}`} : {})};
  };
  const add = (from, to, template, metadata={}) => {
    if (!from || !to) return;
    const {legacyFrom,...properties}=metadata;
    const legacyId=legacyFrom && `module-wire:${legacyFrom}>${to}`;
    const id=legacyId && (design.disconnected?.includes(legacyId) || design.wireOverrides?.[legacyId]!=null)
      ? legacyId : `module-wire:${from}>${to}`;
    if (wires.some(w => w.id === id)) return;
    const {externalSection, ...base} = template || {};
    // Earlier shared dry-contact drawings used an invented L_IN before each channel.
    // Retain saved disconnections/sections when rebuilding their real feeder conductors.
    const saved=modules.get(metadata.moduleId);
    const previous=metadata.moduleFeed && saved?.feed==='shared' && hasDryContacts(nodes.get(saved.id)?.product)
        && /^CH[1-9]\d*_IN$/.test(ports[to]?.key)
      ? ['module-wire:'+saved.id+':L_IN>'+to,'module-wire:'+from+'>'+saved.id+':L_IN'] : [];
    const previousSection=previous.map(old=>design.wireOverrides?.[old]).find(size=>size!=null);
    const section = metadata.bridgeJumper ? null
      : metadata.cresnet ? metadata.section
      : design.wireOverrides?.[id] ?? previousSection ?? (Object.hasOwn(metadata,'section') ? metadata.section : base.section ?? 1.5);
    wires.push({...base, ...properties, id, from, to, class:metadata.class || 'power', lengthKind:'internal',
      section, material:base.material || 'Cu/PVC',
      connected:base.connected !== false && !design.disconnected?.includes(id) && !previous.some(old=>design.disconnected?.includes(old))});
  };
  const remove = wire => { const i=wires.indexOf(wire); if(i>=0) wires.splice(i,1); };
  const originalOutput = (cid, conductor) => net.wires.find(w => w.to === `X-${cid}:${conductor}`);
  function wireDimmerOutput(circuit, device, group) {
    const {moduleId, channel} = device;
    const breaker = nodes.get(circuit.id);
    const rcd = nodes.get(`${circuit.id}-RCD`);
    const source = rcd || breaker;
    const phase = design.supply === 'single' ? 'L1' : circuit.phase;
    if (circuit.voltage !== 220 || !['L1', 'L2', 'L3'].includes(phase)
      || !['mcb', 'rcbo'].includes(breaker?.product?.kind) || breaker.overflow || source.overflow
      || nodes.get(moduleId).overflow) {
      pending('MODULE_INDEPENDENT_FEED_INVALID', `${moduleId} CH${channel}：${circuit.id} 需有可装配的单相 220V 支路保护器和模块。`, moduleId, circuit.id);
      return;
    }

    const line = originalOutput(circuit.id, phase);
    const neutral = originalOutput(circuit.id, 'N');
    const sourceNeutral = `${source.id}:N_OUT`;
    const railNeutral = !rcd && breaker.product.kind === 'mcb' && !ports[sourceNeutral];
    const expectedNeutral = railNeutral ? `N:N-${circuit.id}` : sourceNeutral;
    if (line?.from !== `${source.id}:${phase}_OUT` || neutral?.from !== expectedNeutral) {
      pending('MODULE_INDEPENDENT_NEUTRAL_SOURCE', `${moduleId} CH${channel}：无法核对 ${circuit.id} 的同一支路火线和零线来源，未生成模块接线。`, moduleId, circuit.id);
      return;
    }
    const channelPorts = group.map(ch => ({
      L: port(moduleId, `CH${ch}_IN`, phase),
      N: port(moduleId, `CH${ch}_N`, 'N'),
      D: port(moduleId, `CH${ch}_OUT`, phase),
    }));
    if (channelPorts.some(({L, N, D}) => !L || !N || !D)) {
      pending('MODULE_CHAIN_PORT_MISSING', `${moduleId} CH${channel}：未找到该通道的 L/N/D 端子。`, moduleId, circuit.id);
      return;
    }

    const refs = { moduleId, circuit: circuit.id, breakerId: circuit.id };
    const neutralWire = railNeutral ? { ...neutral, protect: line.protect, section: design.wireOverrides?.[neutral.id] ?? line.section } : neutral;
    const first = channelPorts[0];
    const last = channelPorts.at(-1);
    const bridged = group.length > 1;
    add(line.from, first.L.id, line, { ...refs, moduleFeed: true, scope: bridged ? '桥接组负载火线' : '通道负载火线' });
    add(neutral.from, first.N.id, neutralWire, { ...refs, moduleFeed: true, scope: bridged ? '桥接组负载零线' : '通道负载零线' });
    add(first.D.id, line.to, line, { ...refs, scope: '模块链 → 出箱端子' });
    // The last N is the load takeoff so no pass-through terminal takes three leads.
    add(last.N.id, neutral.to, neutralWire, { ...refs, scope: bridged ? '桥接组零线 → 出箱端子' : '通道零线 → 出箱端子' });
    for (const [index, current] of channelPorts.entries()) {
      internal.push({ a: current.L.id, b: current.D.id, node: moduleId, moduleChannel: group[index] });
      if (index === 0) continue;
      const previous = channelPorts[index - 1];
      for (const terminal of ['L', 'N', 'D']) {
        add(previous[terminal].id, current[terminal].id, { material: `厂家跨接件 ${DIMMER_JUMPER_PARTS[terminal]}` }, {
          ...refs, conductor: current[terminal].conductor, scope: `桥接组 ${terminal} 跨接`,
          bridgeJumper: true, bridgeTerminal: terminal,
        });
      }
    }
    remove(line);
    remove(neutral);
    bindings.push({ moduleId, breakerId: circuit.id, sourceId: source.id, phase, explicit: true, channel });
  }

  for (const circuit of circuits) {
    const assigned = design.modules.flatMap(m => Object.entries(m.channels || {}).filter(([,id]) => id === circuit.id)
      .map(([channel]) => ({moduleId:m.id, channel:Number(channel), role:nodes.get(m.id)?.product?.kind === 'meter' ? 'meter' : 'control'})));
    const saved=(circuit.devices || []).filter(d=>!['protection','rcd'].includes(d.role));
    const chain=saved.length?saved:assigned.sort((a,b)=>(a.role==='meter')-(b.role==='meter'));
    if (!chain.length) continue;
    const independent = assigned.find(d => dimmerOutputs.has(d.moduleId)) || saved.find(d => dimmerOutputs.has(d.moduleId));
    if (!independent && design.uiMode !== 'full' && ![...assigned,...saved].some(d=>loadTopology(nodes.get(d.moduleId)?.product)||hasDryContacts(nodes.get(d.moduleId)?.product))) continue;
    const key=d=>`${d.role}:${d.moduleId}:${Number(d.channel)}`;
    if(chain.length!==assigned.length || new Set(chain.map(key)).size!==chain.length
      || chain.some(d=>!assigned.some(a=>key(a)===key(d)))) {
      if([...chain,...assigned].some(d=>loadTopology(nodes.get(d.moduleId)?.product)==='threePhase'))isolateMeterLoad(circuit,originalOutput,remove);
      pending('MODULE_CHAIN_ASSIGNMENT',`${circuit.id}：已保存的设备链与模块通道归属不一致或重复，请重新确认顺序。`,independent?.moduleId ?? null,circuit.id);continue;
    }
    if(wireThreePhaseMeters({design,circuit,chain,nodes,modules,port,ports,originalOutput,remove,add,internal,bindings,pending})) continue;
    if (independent) {
      const group = dimmerOutputs.get(independent.moduleId).get(independent.channel);
      if (!group) continue;
      if (chain.length !== 1 || otherFeedIds.has(circuit.id)) {
        pending('MODULE_INDEPENDENT_FEED_CONFLICT', `${circuit.id}：同一支路只能分配给一个通道或桥接组，请解除其他占用。`, independent.moduleId, circuit.id);
      } else if (modules.get(independent.moduleId)?.feed === 'perChannel') {
        wireDimmerOutput(circuit, independent, group);
      }
      continue;
    }
    const phase = design.supply === 'single' ? 'L1' : circuit.phase;
    const context={design,circuit,chain,nodes,modules,ports,port,originalOutput,remove,add,internal,bindings,pending,phase};
    if(wireMotorOutput(context)||wireCommonDimmer(context)) continue;
    const controls=chain.filter(d=>d.role==='control');
    const stage=d=>modules.get(d.moduleId)?.seriesStages?.[d.channel];
    const sorted=[...controls].sort((a,b)=>stage(a)-stage(b));
    const series=controls.length>1 && sorted.every((d,i)=>hasDryContacts(nodes.get(d.moduleId)?.product)
      &&modules.get(d.moduleId)?.feed==='perChannel'&&stage(d)===i+1&&!nodes.get(d.moduleId)?.overflow);
    if(series) chain.splice(0,chain.length,...sorted,...chain.filter(d=>d.role!=='control'));
    if(new Set(chain.map(d=>d.moduleId)).size!==chain.length || (controls.length>1&&!series)) {
      pending('MODULE_CHAIN_MULTISTAGE',`${circuit.id}：存在重复模块或多级控制器，须明确级间馈电方式，未自动串联。`,null,circuit.id);continue;
    }
    const sharedNeutral=chain.find(d=>{
      const m=modules.get(d.moduleId),p=nodes.get(d.moduleId)?.product;
      return m.feed==='perChannel' && loadPowerInput(p)==='LN' && !hasDirectNeutral(p)
        && new Set(Object.values(m.channels || {}).filter(Boolean)).size>1;
    });
    if(sharedNeutral) {pending('MODULE_NEUTRAL_UNVERIFIED',`${sharedNeutral.moduleId}：逐通道来自多个保护回路，但目录未确认独立零线端口；请核实端子图后接线，避免混接零线。`,sharedNeutral.moduleId,circuit.id);continue;}
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
      if(mod.feed==='shared' && !meter && device===chain[0] && !hasDryContacts(node.product)) required.push('L_IN');
      if(loadPowerInput(node.product)==='LN' && !hasDirectNeutral(node.product)) required.push('N_IN',...(meter?['N_OUT']:[]));
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
      if (mod.feed==='shared' && !meter && device===chain[0] && !hasDryContacts(node.product)) {
        const common=port(mod.id,'L_IN',phase);
        add(previous,common.id,source,{scope:node.product.loadPowerInput==='LN'?'共用负载供电':'共用模块馈电',moduleFeed:true,moduleId:mod.id,breakerId:sourceCircuit,circuit:circuit.id});
        add(common.id,input.id,source,{scope:'共用馈电 → 通道',moduleId:mod.id,circuit:circuit.id});
      } else add(previous,input.id,source,{scope:series&&device!==chain[0]?'干接点级间馈电':meter?'控制器 → 电表':node.product.loadPowerInput==='LN'?'逐通道负载供电':'逐通道馈电',moduleFeed:!meter,moduleId:mod.id,breakerId:sourceCircuit,circuit:circuit.id});
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
        if(hasDirectNeutral(node.product) || loadPowerInput(node.product)!=='LN') continue;
        const input=port(node.id,'N_IN','N');
        if(input) add(n,input.id,neutral,{scope:node.product.loadPowerInput==='LN'?'负载零线':'模块零线',moduleFeed:true,moduleId:node.id,breakerId:sourceCircuit,circuit:circuit.id});
        if(device.role==='meter') {
          const output=port(node.id,'N_OUT','N');
          internal.push({a:input.id,b:output.id,node:node.id,always:true}); n=output.id;
        }
      }
      const relay=chain.find(d=>hasDirectNeutral(nodes.get(d.moduleId)?.product));
      const metadata=relay?{moduleNeutral:true,moduleId:relay.moduleId,breakerId:sourceCircuit}:{};
      if(n!==oldNeutral.from || sourceCircuit!==circuit.id) {remove(oldNeutral); add(n,oldNeutral.to,{...neutral,section:oldNeutral.section},{...metadata,scope:'负载零线',circuit:circuit.id});}
      else if(relay) {const index=wires.indexOf(oldNeutral);if(index>=0) wires[index]={...oldNeutral,...metadata};}
    }
  }
  for (const node of dimmers) {
    const mod = modules.get(node.id);
    const mode = normalizeDimmerBridgeMode(mod?.bridgeMode);
    if (mode !== '0000') {
      const assigned = new Set(Object.values(mod?.channels || {}).filter(Boolean));
      // An unresolved bridge must not appear as a direct mains connection to the load.
      for (const wire of net.wires) {
        if (assigned.has(wire.circuit) && wire.conductor !== 'PE' && ports[wire.to]?.node === `X-${wire.circuit}`) remove(wire);
      }
    }
    if (bindings.some(binding => binding.moduleId === node.id)) {
      if (mode === '0000') {
        pending('MODULE_INDEPENDENT_JUMPERS', `${node.id}：独立馈电前，须按厂家资料移除出厂的 L/N 共接跳线，各路 DIM 输出分别接负载。`, node.id);
      } else {
        pending('MODULE_DIMMER_BRIDGE_SETUP', `${node.id}：桥接配置 ${mode}（${dimmerBridgeLabel(mode)}）。按厂家资料配置设备并核对跨接件，各组只接自己的相线和零线，组间保持隔离。`, node.id);
      }
    }
  }

  for(const node of nodes.values()) {
    if(node.overflow || !loadTopology(node.product)) continue;
    if(['relay','common'].includes(loadTopology(node.product)) && bindings.some(b=>b.moduleId===node.id)
       && !Object.values(modules.get(node.id)?.channels||{}).some(Boolean))
      pending('MODULE_OUTPUT_UNASSIGNED',node.id+'：当前只接入负载电源，尚未指定通道与现场回路。',node.id);
    for(const pin of buildPortTemplates(node.product)) port(node.id,pin.key);
    if(loadTopology(node.product)==='common'){
      internal.push({a:node.id+':L_IN',b:node.id+':L_LINK',node:node.id,always:true});
      for(const key of ['N','PE']) for(let ch=1;ch<=4;ch++)
        internal.push({a:node.id+':'+key+'_IN',b:node.id+':CH'+ch+'_'+key,node:node.id,always:true});
    }
  }
  const busDevices = bus => [...new Set([...(bus.deviceModuleIds || []),...design.modules.filter(m=>m.busId===bus.id).map(m=>m.id)])]
    .filter(id=>!bus.psuModuleIds?.includes(id));
  // Resolve all saved buses together before drawing any wire: separate buses must
  // not silently parallel power supplies at the same receiver terminals.
  const receiverSources = new Map();
  const receiverKey = (bus, id) => `${id}:${abbDaliLines(nodes.get(id)?.product) ? bus.type : bus.type==='dc'?'DC':'BUS'}`;
  for(const bus of design.buses || []) {
    if(!['dc','knx','dali'].includes(bus.type)) continue;
    for(const id of busDevices(bus)) {
      const key=receiverKey(bus,id), sources=receiverSources.get(key) || new Set();
      for(const source of bus.psuModuleIds || []) sources.add(source);
      receiverSources.set(key,sources);
    }
  }
  for(const bus of design.buses || []) {
    if (isCresnetDataBus(bus)) continue;
    const qsIssue=qsBusIssue(design,bus);
    if(qsIssue){pending('QS_BUS_CONFLICT',(bus.label||bus.id)+'：'+qsIssue);continue;}
    const sources=[...new Set(bus.psuModuleIds || [])].map(id=>nodes.get(id)).filter(Boolean);
    const devices=busDevices(bus);
    if(!devices.length) continue;
    if(bus.type==='rs485') {
      pending('BUS_PINOUT_UNVERIFIED',`${bus.label || bus.id}：RS-485 端子待核。有端子资料的 SDM630-Modbus V2 可在 DIN-AP4 的 COM1 中配置。`);
      continue;
    }
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
      const outputKey=key=>bus.type==='dali'?daliSourcePin(source.product,source.module,key):key;
      if(!compatible || keys.some(key=>!outputKey(key) || !port(source.id,outputKey(key)) || !port(id,key))) {pending('BUS_DEVICE_UNVERIFIED',`${id}：${bus.label || bus.id} 电压、协议或端口不匹配，未自动接线。`,id);continue;}
      const section=Number.isFinite(bus.section) && bus.section>0?bus.section:null;
      if(section===null) pending('BUS_SECTION_UNVERIFIED',`${bus.label || bus.id} → ${id}：线径尚未填写，请按厂家端子和线缆要求确认。`,id);
      for(const key of keys) add(`${source.id}:${outputKey(key)}`,`${id}:${key}`,null,{legacyFrom:source.id+':'+key,scope:dc?`${voltage}V 模块控制供电`:`${bus.type.toUpperCase()} 总线`,class:dc?'dc':'comms',conductor:key,busId:bus.id,moduleId:id,section});
    }
  }
  for (const node of nodes.values()) {
    const receiver = isCresnetReceiver(node.product);
    const chainSupply = isCresnetChainSupply(node.product);
    const dali2 = isDinDali2(node.product);
    const supply = isIndexedDaliSupply(node.product) || isMdtBusSupply(node.product);
    if (node.overflow || (!receiver && !chainSupply && !isCresnetController(node.product) && !supply)) continue;
    for (const template of buildPortTemplates(node.product)) port(node.id, template.key);
    if (supply) continue;
    const daliLoops = dali2 ? DALI_LOOPS : node.product?.id === 'crestron-din-dli' ? [1] : [];
    for (const loop of daliLoops) {
      for (const pin of ['PLUS','MINUS']) {
        const key = `${node.id}:DALI${loop}_${pin}`;
        internal.push({a:key, b:`${key}_2`, node:node.id, always:true});
      }
    }
    for (const pin of ['24', 'Y', 'Z', 'G']) {
      const legacyPower = receiver || chainSupply;
      const key = legacyPower && pin === '24' ? 'DC+' : legacyPower && pin === 'G' ? 'DC-' : `NET_${pin}`;
      internal.push({a:`${node.id}:${key}`, b:`${node.id}:NET2_${pin}`, node:node.id, always:true, cresnetParallel:true});
      if (chainSupply) internal.push({a:`${node.id}:${key}`, b:`${node.id}:NET3_${pin}`, node:node.id, always:true, cresnetParallel:true});
    }
    if (chainSupply) for (const pin of ['L','N','PE']) {
      internal.push({a:`${node.id}:${pin}_IN`, b:`${node.id}:${pin}_THRU`, node:node.id, always:true});
    }
  }
  wireCresnetBuses(design, nodes, wires, port, add, pending);
  wireSerialMeters({design, nodes, port, add, pending});
  wireAnalogFields({design,nodes,ports,wires,port,add,pending});
  wireDaliLoops({design, nodes, port, add, pending});
  wireQs({design,nodes,ports,port,add,pending,internal});
  wireDaliFieldLoops({design,nodes,ports,port,add,pending});
  return {...net,ports,wires,internal,moduleFeedBindings:bindings,wiringIssues:issues};
}
