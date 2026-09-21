/** Saved channel assignments and derived physical wires used by delivery views. */
export function circuitModuleChannels(design, circuit) {
  const links = new Map();
  const add = (moduleId, channel) => {
    if (moduleId && channel != null) links.set(`${moduleId}:${channel}`, {moduleId, channel:String(channel)});
  };
  for (const mod of design?.modules || []) {
    for (const [channel, id] of Object.entries(mod.channels || {})) {
      if (id === circuit.id) add(mod.id, channel);
    }
  }
  for (const device of circuit.devices || []) add(device.moduleId, device.channel);
  return [...links.values()];
}

export function moduleDeliveryLinks(design, net = {}) {
  const rows = [], physical = new Set();
  const add = row => rows.push(row);
  for (const wire of net?.wires || []) {
    if (!(wire.moduleFeed || wire.moduleNeutral || wire.terminalConnection || String(wire.id || '').startsWith('module-wire:'))) continue;
    physical.add(`${wire.from}>${wire.to}`);
    const specification = wire.section == null || wire.section === '' ? '线径/规格待核'
      : typeof wire.section === 'number' ? `${wire.section} mm²` : String(wire.section);
    add({from:wire.from, to:wire.to, kind:wire.scope || (wire.terminalConnection ? '模块 → 接线端子' : wire.moduleNeutral ? '负载零线（不经过继电器触点）' : wire.moduleFeed ? '空开 → 模块馈电' : wire.class || '模块链路'),
      detail:[wire.loadName, wire.wireNo && `线号 ${wire.wireNo}`, specification, wire.circuit, wire.connected === false ? '未连接' : '已连接'].filter(Boolean).join(' · ')});
  }
  for (const feed of net?.moduleFeedBindings || []) {
    if (!(net.wires || []).some(w => w.moduleFeed && w.moduleId === feed.moduleId)) {
      add({from:feed.sourceId || feed.breakerId,to:feed.moduleId,kind:'模块馈电关联',detail:`${feed.phase || ''} · 端口接线待核`});
    }
  }
  for (const circuit of design?.circuits || []) {
    for (const {moduleId,channel} of circuitModuleChannels(design,circuit)) {
      add({from:`${moduleId}:CH${channel}`,to:circuit.id,kind:'模块通道 → 回路',detail:circuit.name || ''});
    }
  }
  for (const mod of design?.modules || []) {
    for (const [pole,row] of Object.entries(mod.terminalConnections || {})) {
      if (!row.output) continue;
      // A derived physical wire is authoritative; use saved rows only without one.
      if ((net.wires || []).some(w => w.terminalConnection && (w.from === row.output||w.assignedOutput===row.output) && w.terminalId === mod.id && (w.to === `${mod.id}:${pole}` || w.to === `${mod.id}:P${pole}` || w.pole === Number(pole)))) continue;
      if (physical.has(`${row.output}>${mod.id}:${pole}`)) continue;
      add({from:row.output,to:`${mod.id}:${pole}`,kind:'模块 → 接线端子（保存关联）',detail:[row.loadName,row.wireNo && `线号 ${row.wireNo}`,row.section != null ? `${row.section} mm²` : '线径待核'].filter(Boolean).join(' · ')});
    }
  }
  for (const issue of net?.wiringIssues || []) {
    add({from:'配线待核',to:issue.moduleId || issue.circuit || issue.busId || '—',kind:issue.code || '待核问题',detail:issue.message || issue.text || '请核查配线配置'});
  }
  return rows;
}
