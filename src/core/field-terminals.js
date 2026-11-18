// A feed-through slice has one cabinet-side contact. Different outputs cannot share it.
const signalAssignments = [['daliFieldLoops', 'dali'], ['analogTerminals', 'analog']];

export function fieldTerminalClaims(design) {
  const claims = new Map();
  const claim = (id, moduleId, field) => {
    if (!id) return;
    if (!claims.has(id)) claims.set(id, []);
    claims.get(id).push({moduleId, field});
  };
  for (const mod of design.modules || []) {
    for (const [pole, row] of Object.entries(mod.terminalConnections || {})) {
      if (row?.output) claim(`${mod.id}:${pole}`, mod.id, 'load');
    }
    for (const [property, prefix] of signalAssignments) {
      for (const [channel, pair] of Object.entries(mod[property] || {})) {
        for (const polarity of ['plus', 'minus']) claim(pair?.[polarity], mod.id, `${prefix}-${channel}-${polarity}`);
      }
    }
    for (const [link, group] of Object.entries(mod.qsConfig?.links || {})) {
      if (group?.terminalId) for (const pole of [1,2,3,4]) claim(`${group.terminalId}:${pole}`, mod.id, `qs-${link}-${pole}`);
    }
  }
  // A legacy whole-block load association does not identify a particular slice.
  for (const mod of design.modules || []) for (const block of new Set(Object.values(mod.channelTerminals || {}).filter(Boolean))) {
    for (const id of claims.keys()) if (id.startsWith(block+':') && claims.get(id).some(c=>c.field!=='load')) {
      claim(id, mod.id, 'whole-block-load');
    }
  }
  return claims;
}

export function ensureLoadTerminalFree(design,block) {
  for (const [id,claims] of fieldTerminalClaims(design)) {
    if (id.startsWith(block+':') && claims.some(c=>c.field!=='load')) throw new Error(`${id} 已分配给信号回路，请选择空闲端子排。`);
  }
}

export function fieldTerminalOptions(design, resolveProduct) {
  return (design.modules || []).flatMap(mod => {
    const p = resolveProduct(mod.productId);
    if (p?.kind !== 'terminal' || p.terminalColor !== 'gray') return [];
    return Array.from({length:p.poles || 1}, (_, i) => {
      const id = `${mod.id}:${i + 1}`;
      return {id, label:mod.displayName ? `${id} · ${mod.displayName}` : id};
    });
  });
}

export function fieldTerminalPort(nodes, key, conductor) {
  const match = /^(.*):([1-9]\d*)$/.exec(key || '');
  if (!match) return null;
  const node = nodes.get(match[1]);
  const p = node?.product, pole = Number(match[2]);
  if (p?.kind !== 'terminal' || p.terminalColor !== 'gray' || node.overflow || pole > (p.poles || 1)) return null;
  return {id:key, key:match[2], node:node.id, displayTag:key, conductor, side:'bottom',
    x:node.x - p.width / 2 + (pole - 0.5) * p.width / (p.poles || 1),
    y:node.y - p.height / 2, z:p.depth + 5};
}

export function clearFieldTerminalRefs(mod, deletedId) {
  for (const [ch,id] of Object.entries(mod.channelTerminals || {})) if (id===deletedId) mod.channelTerminals[ch]=null;
  for (const group of Object.values(mod.qsConfig?.links || {})) {
    if (group?.terminalId === deletedId) group.terminalId = '';
  }
  for (const [property] of signalAssignments) {
    for (const pair of Object.values(mod[property] || {})) {
      for (const polarity of ['plus','minus']) {
        if (typeof pair?.[polarity] === 'string' && pair[polarity].slice(0, pair[polarity].lastIndexOf(':')) === deletedId) pair[polarity] = '';
      }
    }
  }
}
