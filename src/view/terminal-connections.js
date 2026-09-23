import {escapeHtml as esc} from '../core/escape.js';
export function terminalConnectionSvg(rows, {orientation = 'landscape'} = {}) {
  if (orientation === 'portrait') return portraitTerminalConnections(rows);
  const width = 800, height = 100 + Math.ceil(Math.max(1,rows.length)/4)*290;
  const cells = rows.map((r,i) => {
    const x = 22 + (i%4)*194, y = 60 + Math.floor(i/4)*290;
    const color = r.color === 'blue' ? '#2576b8' : '#d93636';
    const label = (text, yy) => `<text x="${x+84}" y="${yy}" text-anchor="middle" font-size="12" fill="#263b36">${esc(text)}</text>`;
    const name = r.loadName || '未命名设备';
    return `<g><title>${esc(name)} · ${esc(r.output || '下端未连接')}</title>
      <rect x="${x}" y="${y}" width="168" height="46" rx="4" fill="#f3f6f5" stroke="#cad7d0"/>
      ${label(name.slice(0,12), y+20)}${label(name.slice(12,24),y+36)}
      <path d="M${x+84} ${y+46}V${y+95}" stroke="${color}" stroke-width="2" stroke-dasharray="${r.loadName?'':'4 4'}" fill="none"/>
      <rect x="${x+54}" y="${y+95}" width="60" height="54" rx="3" fill="${r.color==='blue'?'#dceaf6':'#e3e7e5'}" stroke="#81978a"/>
      <circle cx="${x+84}" cy="${y+98}" r="4" fill="#fff" stroke="${color}"/>
      ${label(`${r.terminalId}:${r.pole}`,y+126)}
      <circle cx="${x+84}" cy="${y+146}" r="4" fill="#fff" stroke="${color}"/>
      <path d="M${x+84} ${y+150}V${y+206}" stroke="${color}" stroke-width="2" stroke-dasharray="${r.output?'':'4 4'}" fill="none"/>
      <text x="${x+92}" y="${y+177}" font-size="10" fill="#64756d">${esc(r.wireNo || '')}</text>
      <rect x="${x}" y="${y+206}" width="168" height="40" rx="4" fill="#eef4f0" stroke="#b8cbc0"/>
      ${label(r.output || '下端未连接',y+231)}
      ${label(r.section ? `${r.section} mm²` : '线径待核',y+266)}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="PT2.5逐节接线图" style="background:white;font-family:Arial,sans-serif"><text x="22" y="28" font-size="16" fill="#244537">设备 → PT2.5 上端 / 下端 → 输出通道</text>${cells}</svg>`;
}

/** Six connections per A4 portrait page; the assembly preview keeps its wide layout. */
function portraitTerminalConnections(rows) {
  const width = 600, height = Math.max(800, 110 + Math.ceil(rows.length / 2) * 220);
  const wrap = value => {
    const lines = []; let line = '', used = 0;
    for (const character of String(value || '—')) {
      const advance = /[\u0000-\u007f]/.test(character) ? .6 : 1;
      if (line && used + advance > 19) { lines.push(line); line = ''; used = 0; }
      line += character; used += advance;
    }
    lines.push(line);
    return lines.length > 3 ? [...lines.slice(0,2), `${lines[2].slice(0,17)}…`] : lines;
  };
  const cells = rows.map((row,index) => {
    const x = 20 + index % 2 * 290, y = 88 + Math.floor(index / 2) * 220;
    const center = x + 130, color = row.color === 'blue' ? '#2576b8' : '#ad3434';
    const text = (value, yy, size = 12, fill = '#263b36') => `<text x="${center}" y="${yy}" text-anchor="middle" font-size="${size}" fill="${fill}">${esc(value)}</text>`;
    const box = (value, yy, fill) => `<rect x="${x+8}" y="${yy}" width="244" height="52" rx="5" fill="${fill}" stroke="#cad7d0"/>${wrap(value).map((line,i)=>text(line,yy+15+i*15)).join('')}`;
    return `<g data-terminal="${esc(row.terminalId)}:${esc(row.pole)}"><title>${esc(row.loadName || '未填写设备')} → ${esc(row.output || '未连接')}</title>
      <rect x="${x}" y="${y}" width="260" height="208" rx="7" fill="#fff" stroke="#cad7d0"/>
      ${box(row.loadName || '设备名称未填写',y+8,'#f3f6f5')}
      <path d="M${center} ${y+60}V${y+82}" stroke="${color}" stroke-width="2"${row.loadName ? '' : ' stroke-dasharray="4 4"'}/>
      <rect x="${x+8}" y="${y+82}" width="244" height="28" rx="4" fill="${row.color==='blue'?'#dceaf6':'#e3e7e5'}" stroke="#81978a"/>
      ${text(`端子 ${row.terminalId}:${row.pole}`,y+100)}
      <path d="M${center} ${y+110}V${y+136}" stroke="${color}" stroke-width="2"${row.output ? '' : ' stroke-dasharray="4 4"'}/>
      ${box(row.output || '输出通道未连接',y+136,'#eef4f0')}
      ${text([row.wireNo ? `线号 ${row.wireNo}` : '线号未填',row.section ? `${row.section} mm²` : '线径待核'].join(' · '),y+201,11,'#52675c')}
    </g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="端子连接示意图，A4纵向" style="background:white;font-family:Microsoft YaHei,PingFang SC,Arial,sans-serif">
    <rect width="100%" height="100%" fill="white"/>
    <text x="20" y="29" font-size="19" font-weight="700" fill="#244537">端子连接示意 · 按编号查找接线</text>
    <text x="20" y="52" font-size="12" fill="#52675c">从上往下看：用电设备 → 中间接线端子 → 控制模块输出通道。</text>
    <text x="20" y="70" font-size="12" fill="#52675c">实线表示已填写关联；虚线表示尚未填写，仍需现场核对实际接线。</text>
    ${cells}<text x="20" y="${height-18}" font-size="11" fill="#52675c">CH = 模块通道；mm² = 电线截面积。此图为关联示意，不代表现场已完成接线。</text></svg>`;
}
export { esc };
