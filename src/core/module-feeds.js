import {isIndexedDaliSupply} from './dali-power.js';
import {hasIndependentLoadFeeds, isCresnetChainSupply, loadPowerInput, supportsLoadWiring} from './ports.js';
import {loadTopology,hasDryContacts} from './crestron-loads.js';
import {normalizeDimmerBridgeMode} from './dimmer-bridging.js';
import {abbDaliLines,isMdtBusSupply} from './abb-dali.js';
import {qsReceiver,qsHardware,qsMainsIssue} from './qs-link.js';

/** Derived wiring: saved module/circuit assignments are never changed here. */
export function isMainsFedModule(product) {
  if (['analog','motor','threePhase'].includes(loadTopology(product)) || hasIndependentLoadFeeds(product) || !supportsLoadWiring(product)) return false;
  return product?.kind !== 'terminal' && (loadPowerInput(product) === 'LN'
    || ['relay', 'dimmer', 'contactor', 'timer'].includes(product?.kind));
}

const physicalOrder = (a, b) => (a.row ?? Infinity) - (b.row ?? Infinity)
  || (a.slot ?? Infinity) - (b.slot ?? Infinity);

export function resolveModuleFeedBindings(assemblyOrNet, design) {
  const nodes = assemblyOrNet?.nodes || [];
  const breakers = nodes.filter(n => n.role === 'branch'
    && ['mcb', 'rcbo'].includes(n.product?.kind)
    && n.circuit?.voltage !== 380).sort(physicalOrder);
  const modules = nodes.filter(n => n.role === 'module' && isMainsFedModule(n.product)).sort(physicalOrder);
  const saved = new Map((design.modules || []).map(m => [m.id, m]));
  const assignments = new Map();
  const used = new Set(nodes.filter(n => n.role === 'module' && hasIndependentLoadFeeds(n.product))
    .flatMap(n => {
      const mod = saved.get(n.id) || n.module;
      const bridgeRequested = normalizeDimmerBridgeMode(mod?.bridgeMode) !== '0000';
      return mod && (mod.feed === 'perChannel' || bridgeRequested) ? Object.values(mod.channels || {}).filter(Boolean) : [];
    }));
  for(const node of nodes) {
    const m=saved.get(node.id);
    if(m && (loadTopology(node.product)||hasDryContacts(node.product)) && ['shared','perChannel'].includes(m.feed)
        &&Object.values(m.channels||{}).some(Boolean)){
      for(const id of Object.values(m.channels||{})) if(id) used.add(id);
      if(m.feed==='shared' && m.feedCircuitId) used.add(m.feedCircuitId);
    }
  }
  // Reserve explicit choices first so earlier automatic modules cannot steal them.
  for (const node of modules) {
    const mod = saved.get(node.id) || node.module || {};
    if(qsMainsIssue(design,mod))continue;
    if(loadTopology(node.product)==='commonMotor' && Object.values(mod.channels||{}).some(Boolean)) continue;
    if (!qsReceiver(node.product) && (design.uiMode === 'full' || loadTopology(node.product) || hasDryContacts(node.product)) && ['shared', 'perChannel'].includes(mod.feed)
      && Object.values(mod.channels || {}).some(Boolean)) continue;
    const explicitId = mod.protectId || (!qsReceiver(node.product) && mod.feedCircuitId);
    if (!explicitId) continue;
    const breaker = breakers.find(n => n.id === explicitId);
    if (breaker && !used.has(breaker.id)) {
      assignments.set(node.id, breaker);
      used.add(breaker.id);
    }
  }
  for (const node of modules) {
    const mod = saved.get(node.id) || node.module || {};
    if (qsReceiver(node.product) || ((loadTopology(node.product)||hasDryContacts(node.product))&&Object.values(mod.channels||{}).some(Boolean)&&mod.feed!=='none') || design.uiMode === 'full' || mod.protectId || assignments.has(node.id)) continue;
    const breaker = breakers.find(n => !used.has(n.id));
    if (breaker) {
      assignments.set(node.id, breaker);
      used.add(breaker.id);
    }
  }
  return modules.flatMap(node => {
    const breaker = assignments.get(node.id);
    if (!breaker) return [];
    const rcd = nodes.find(n => n.id === `${breaker.id}-RCD` && n.role === 'branchRcd');
    return [{moduleId: node.id, breakerId: breaker.id, sourceId: rcd?.id || breaker.id,
      phase: design.supply === 'single' ? 'L1' : breaker.circuit?.phase || 'L1',
      explicit: !!(saved.get(node.id) || node.module)?.protectId}];
  });
}

export function applyModuleFeeds(net, design) {
  if (!design.modules?.length) return net;
  const bindings = resolveModuleFeedBindings(net, design);
  if (!bindings.length) return net;
  const ports = {...net.ports}, additions = [], removed = new Set(), neutralLoads = new Map(), internal = [...net.internal];
  function modulePort(node, key, conductor) {
    const existing = ports[`${node.id}:${key}`];
    if (existing) return existing;
    const port = {id: `${node.id}:${key}`, node: node.id, key, conductor,
      x: node.x + (conductor === 'N' ? 7 : -7),
      y: node.y + (node.product.height || 86) / 2,
      z: (node.product.depth || 60) + 3, side: 'top',
      minWire: node.product.minWire || .5, maxWire: node.product.maxWire || 35};
    ports[port.id] = port;
    return port;
  }
  for (const binding of bindings) {
    const node = net.nodes.find(n => n.id === binding.moduleId);
    const chainSupply = isCresnetChainSupply(node.product);
    for (const conductor of (chainSupply || loadTopology(node.product)==='common' || isMdtBusSupply(node.product) || qsReceiver(node.product) ? [binding.phase,'N','PE'] : [binding.phase,'N'])) {
      // DIN-8SW8-I switches independent load contacts; its controller uses Cresnet.
      if(conductor==='N'&&node.product.id==='crestron-din-8sw8-i') {
        const loadNeutral=net.wires.find(w=>w.to===`X-${binding.breakerId}:N`);
        if(loadNeutral) neutralLoads.set(loadNeutral.id,{...loadNeutral,moduleNeutral:true,moduleId:binding.moduleId,breakerId:binding.breakerId});
        continue;
      }
      if (conductor === 'N' && (loadPowerInput(node.product) !== 'LN'
        || node.product.id === 'crestron-din-8sw8-i')) continue;
      const template = net.wires.find(w => w.to === `X-${binding.breakerId}:${conductor}`);
      if (!template) continue;
      const from = ports[template.from];
      if (!from || (conductor === binding.phase && from.node !== binding.sourceId)) continue;
      if (conductor === 'N' && from.node !== binding.sourceId && from.node !== 'N') continue;
      // Reuse the domain's phase port rather than creating a parallel fake input.
      const phaseKey = loadTopology(node.product)==='relay'?'CH1_IN':ports[`${node.id}:L_IN`] ? 'L_IN' : ports[`${node.id}:L1_IN`] ? 'L1_IN' : 'L_IN';
      const target = modulePort(node, conductor === binding.phase ? phaseKey : `${conductor}_IN`, conductor);
      // A single-phase module can be fed by L2/L3 without changing its L input name.
      ports[target.id] = {...target, conductor};
      const physicalId = `module-feed:${from.id}>${target.id}`;
      // Earlier generic power-supply faces used a phase-specific input key.
      const previousId = (chainSupply || loadTopology(node.product) || isIndexedDaliSupply(node.product) || abbDaliLines(node.product) || isMdtBusSupply(node.product) || qsHardware(node.product)) && conductor === binding.phase ? `module-feed:${from.id}>${node.id}:L1_IN` : physicalId;
      const id = design.disconnected?.includes(previousId) || design.wireOverrides?.[previousId] != null ? previousId : physicalId;
      const {externalSection, ...internalTemplate} = template;
      additions.push({...internalTemplate, id, from: from.id, to: target.id, class: 'power', lengthKind: 'internal',
        section: design.wireOverrides?.[id] ?? template.section,
        connected: template.connected && !design.disconnected?.includes(id),
        scope: conductor==='PE'?'支路保护地 → 电源 PE':node.product.loadPowerInput === 'LN'
          ? conductor === 'N' ? '空开 → 负载零线' : '空开 → 负载供电'
          : conductor === 'N' ? '空开 → 模块零线' : '空开 → 模块火线',
        moduleFeed: true, moduleId: binding.moduleId, breakerId: binding.breakerId});
      removed.add(template.id);
      // A verified load controller's energized input alone cannot power a field load.
      if(loadTopology(node.product) || hasDryContacts(node.product)) continue;
      // Other legacy devices use X to track their branch supply status.
      internal.push({a: target.id, b: template.to, node: node.id, always: true,
        logicalReference: true, moduleFeed: true});
    }
  }
  return {...net, ports, internal, wires: [...net.wires.filter(w => !removed.has(w.id)).map(w=>neutralLoads.get(w.id)||w), ...additions], moduleFeedBindings: bindings};
}
