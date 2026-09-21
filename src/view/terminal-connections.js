const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function terminalConnectionSvg(rows) {
  const width = 800, height = 100 + Math.ceil(Math.max(1,rows.length)/4)*290;
  const cells = rows.map((r,i) => {
    const x = 22 + (i%4)*194, y = 60 + Math.floor(i/4)*290;
    const color = r.color === 'blue' ? '#2576b8' : '#97611e';
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
export { esc };
