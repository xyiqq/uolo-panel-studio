// Each PT2.5 slice has one field connection and one panel connection.
export const OUTPUT_KINDS = ['relay', 'dimmer', 'contactor', 'timer'];
export function terminalRows(design, resolve) {
  return (design.modules || []).flatMap(m => {
    const p = resolve(m.productId);
    if (p?.kind !== 'terminal') return [];
    return Array.from({length: p.poles || p.channels || 1}, (_, i) => ({
      loadName: '', loadType: 'light', output: '', section: '', wireNo: '',
      ...m.terminalConnections?.[i + 1],
      terminalId: m.id, pole: i + 1, color: p.terminalColor,
    }));
  });
}
export function outputOptions(design, resolve) {
  return (design.modules || []).flatMap(m => {
    const p = resolve(m.productId);
    if (!OUTPUT_KINDS.includes(p?.kind)) return [];
    return Array.from({length: p.channels || 0}, (_, i) => ({
      value: `${m.id}:CH${i + 1}_OUT`, label: `${m.id} · CH${i + 1} · ${m.label}`,
    }));
  });
}
export function saveTerminalRows(design, rows, resolve) {
  const known = new Map(terminalRows(design, resolve).map(r => [`${r.terminalId}:${r.pole}`,r]));
  const outputs = new Set(outputOptions(design, resolve).map(o => o.value));
  const used = new Set();
  const cleaned = rows.map(r => {
    if (!known.has(`${r.terminalId}:${r.pole}`)) throw new Error('端子不存在或节号超出范围');
    if (r.output && !outputs.has(r.output)) throw new Error('所选输出通道已不存在');
    if (r.output && used.has(r.output)) throw new Error(`${r.output} 已连接其他端子，请选择空闲通道`);
    if (r.output && known.get(`${r.terminalId}:${r.pole}`).color === 'blue') throw new Error('蓝色零线端子不能连接相线输出');
    if (r.output) used.add(r.output);
    const section = r.section === '' || r.section == null ? null : Number(r.section);
    if (section !== null && (![0.5,0.75,1,1.5,2.5,4,6].includes(section))) throw new Error('请选择有效线径');
    return {...r, loadName: String(r.loadName || '').trim().slice(0,80),
      loadType: ['light','motor','other'].includes(r.loadType) ? r.loadType : 'other',
      wireNo: String(r.wireNo || '').trim().slice(0,40), section};
  });
  for (const r of cleaned) {
    const m = design.modules.find(m => m.id === r.terminalId);
    m.terminalConnections ||= {};
    m.terminalConnections[r.pole] = {loadName:r.loadName, loadType:r.loadType, output:r.output, section:r.section, wireNo:r.wireNo};
  }
}
export function terminalCsv(rows) {
  const quote = v => '"' + (/^[=+@\-\t\r]/.test(String(v ?? '')) ? "'" : '') + String(v ?? '').replaceAll('"','""') + '"';
  return '\uFEFF' + [['端子','上端设备','设备类型','下端通道','线号','截面 mm²'],
    ...rows.map(r => [`${r.terminalId}:${r.pole}`,r.loadName,r.loadType,r.output,r.wireNo,r.section])]
    .map(r => r.map(quote).join(',')).join('\r\n');
}

// Dedicated design wires: do not invent feed, neutral, motor interlocks or energization.
export function terminalWireSegments(design, assembly, resolve) {
  const nodes = new Map(assembly.nodes.map(n => [n.id,n]));
  const segments = [];
  for (const r of terminalRows(design, resolve)) {
    const term = nodes.get(r.terminalId);
    const match = /^(.*):CH(\d+)_OUT$/.exec(r.output || '');
    const output = match && nodes.get(match[1]);
    if (!term || term.overflow || !output || output.overflow) continue;
    const count = term.product.poles || term.product.channels || 1;
    const x = term.x - term.product.width/2 + (r.pole-.5)*term.product.width/count;
    const y = term.y;
    const ch = +match[2];
    if (ch < 1 || ch > output.product.channels || r.color === 'blue') continue;
    const source = {x:output.x-output.product.width/2+ch*output.product.width/(output.product.channels+1),y:output.y-output.product.height/2,z:output.product.depth+5};
    const target = {x,y:y-term.product.height/2,z:term.product.depth+5};
    const circuit=design.circuits?.find(c=>c.id===output.module?.channels?.[ch]);
    const fieldName=output.module?.channelLabels?.[ch] || circuit?.name || r.loadName || `${output.module?.displayName||output.label||output.id} CH${ch}`;
    segments.push({id:`${r.terminalId}:${r.pole}`, ...r, fieldName, source, target,
      field:{x,y:y+term.product.height/2,z:term.product.depth+5}});
  }
  return segments;
}
