import {loadPowerInput} from './ports.js';

/** Derived wiring: saved module/circuit assignments are never changed here. */
export function isMainsFedModule(product) {
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
  const assignments = new Map(), used = new Set();
  const saved = new Map((design.modules || []).map(m => [m.id, m]));
  // Reserve explicit choices first so earlier automatic modules cannot steal them.
  for (const node of modules) {
    const mod = saved.get(node.id) || node.module || {};
    if (design.uiMode === 'full' && ['shared', 'perChannel'].includes(mod.feed)
      && Object.values(mod.channels || {}).some(Boolean)) continue;
    const explicitId = mod.protectId || mod.feedCircuitId;
    if (!explicitId) continue;
    const breaker = breakers.find(n => n.id === explicitId);
    if (breaker && !used.has(breaker.id)) {
      assignments.set(node.id, breaker);
      used.add(breaker.id);
    }
  }
  for (const node of modules) {
    const mod = saved.get(node.id) || node.module || {};
    if (design.uiMode === 'full' || mod.protectId || assignments.has(node.id)) continue;
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
    for (const conductor of [binding.phase, 'N']) {
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
      if (!from || (conductor !== 'N' && from.node !== binding.sourceId)) continue;
      if (conductor === 'N' && from.node !== binding.sourceId && from.node !== 'N') continue;
      // Reuse the domain's phase port rather than creating a parallel fake input.
      const phaseKey = ports[`${node.id}:L_IN`] ? 'L_IN' : ports[`${node.id}:L1_IN`] ? 'L1_IN' : 'L_IN';
      const target = modulePort(node, conductor === 'N' ? 'N_IN' : phaseKey, conductor);
      // A single-phase module can be fed by L2/L3 without changing its L input name.
      ports[target.id] = {...target, conductor};
      const id = `module-feed:${from.id}>${target.id}`;
      const {externalSection, ...internalTemplate} = template;
      additions.push({...internalTemplate, id, from: from.id, to: target.id, class: 'power', lengthKind: 'internal',
        section: design.wireOverrides?.[id] ?? template.section,
        connected: template.connected && !design.disconnected?.includes(id),
        scope: node.product.loadPowerInput === 'LN'
          ? conductor === 'N' ? '空开 → 负载零线' : '空开 → 负载供电'
          : conductor === 'N' ? '空开 → 模块零线' : '空开 → 模块火线',
        moduleFeed: true, moduleId: binding.moduleId, breakerId: binding.breakerId});
      removed.add(template.id);
      // X represents the existing circuit supply status, not a switched output.
      internal.push({a: target.id, b: template.to, node: node.id, always: true,
        logicalReference: true, moduleFeed: true});
    }
  }
  return {...net, ports, internal, wires: [...net.wires.filter(w => !removed.has(w.id)).map(w=>neutralLoads.get(w.id)||w), ...additions], moduleFeedBindings: bindings};
}
