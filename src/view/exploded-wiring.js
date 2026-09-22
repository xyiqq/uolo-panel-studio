export function nodeExplosionOffset(node, amount, options, levels) {
  if (!node) return 0;
  if (options.explodeScope === 'selected' || options.isolate) {
    const level=levels?.get(node.id) ?? (node.id===options.selected?0:undefined);
    return level===undefined?0:(192+level*110)*amount;
  }
  if (node.product) return amount * (178 + (node.row || 0) * 14);
  return amount * (node.role === 'service' ? -20 : 85);
}

// Follow only explicit downstream module feeds. Shared N/PE ports are context,
// never graph traversal roots, so another branch cannot enter this inspection.
export function connectionInspection(net, segments, selected) {
  const levels=new Map(selected?[[selected,0]]:[]);
  const node=net.nodes?.find(n=>n.id===selected);
  const breaker=['mcb','rcbo','rccb'].includes(node?.product?.kind);
  if(breaker) {
    for(const wire of net.wires) {
      if(!wire.moduleFeed) continue;
      const source=net.ports[wire.from]?.node,target=net.ports[wire.to]?.node;
      if(source!==selected&&wire.breakerId!==selected) continue;
      if(!target) continue;
      const sourceNode=net.nodes?.find(n=>n.id===source);
      const hasRcd=source!==selected&&['mcb','rcbo','rccb'].includes(sourceNode?.product?.kind);
      if(hasRcd) levels.set(source,1);
      levels.set(target,Math.max(levels.get(target)||0,hasRcd?2:1));
    }
  }
  if(breaker) {
    let changed=true;
    while(changed) {
      changed=false;
      for(const w of net.wires) {
        if(!w.id?.startsWith('module-wire:')) continue;
        const a=net.ports[w.from]?.node,b=net.ports[w.to]?.node;
        if(!levels.has(a)||levels.has(b)||!net.nodes?.find(n=>n.id===b)?.product) continue;
        levels.set(b,levels.get(a)+1);changed=true;
      }
    }
  }
  const moduleIds=new Set(levels.keys());
  const segmentIds=new Set();
  for(const s of segments) {
    const output=(s.physicalOutput||s.output).split(':')[0];
    if(moduleIds.has(output)||moduleIds.has(s.output.split(':')[0])||s.terminalId===selected) {
      segmentIds.add(s.id);
      if(breaker&&moduleIds.has(output)) levels.set(s.terminalId,Math.max(levels.get(s.terminalId)||0,(levels.get(output)||0)+1));
    }
  }
  const context=new Set(levels.keys()),wireIds=new Set();
  const chain=breaker&&levels.size>1;
  for(const wire of net.wires) {
    const a=net.ports[wire.from]?.node,b=net.ports[wire.to]?.node;
    if(wire.moduleNeutral&&levels.has(wire.moduleId)) {
      wireIds.add(wire.id);context.add(a);
      continue;
    }
    if(!levels.has(a)&&!levels.has(b)) continue;
    // A breaker chain is a downstream inspection, not the incoming cabinet bus.
    if(chain&&!wire.moduleFeed&&!(levels.has(a)&&levels.has(b))) continue;
    wireIds.add(wire.id);context.add(a);context.add(b);
  }
  for(const s of segments) if(segmentIds.has(s.id)) {context.add((s.physicalOutput||s.output).split(':')[0]);context.add(s.output.split(':')[0]);context.add(s.terminalId);}
  context.delete(undefined);
  return {levels,context,wireIds,segmentIds,chain};
}
export function connectedNodeIds(net, segments, selected) {
  const ids = new Set(selected ? [selected] : []);
  for (const wire of net.wires) {
    const a = net.ports[wire.from]?.node, b = net.ports[wire.to]?.node;
    if (a === selected || b === selected) { ids.add(a); ids.add(b); }
  }
  for (const s of segments) {
    const a = s.output.split(':')[0], b = s.terminalId;
    if (a === selected || b === selected) { ids.add(a); ids.add(b); }
  }
  ids.delete(undefined);
  return ids;
}
export function wireTouchesSelection(net, wire, selected) {
  return !!selected && [net.ports[wire.from]?.node, net.ports[wire.to]?.node].includes(selected);
}
