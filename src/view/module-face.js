/** 装配模块的矢量原稿。SVG 与同步 Canvas 贴图共用图元，不依赖图片加载或网络。 */
const FONT = 'Arial,Microsoft YaHei,sans-serif';
const ACCENTS = { Crestron: '#76b8e4', Lutron: '#ceb67a', MDT: '#75b4db', ABB: '#df5347', 明纬: '#ddbb68', 涂鸦DIN: '#ed9470' };
const NAMES = { relay: 'RELAY', dimmer: 'DIMMER', gateway: 'INTERFACE', psu: 'POWER', meter: 'METER', contactor: 'ACTUATOR', timer: 'TIMER', terminal: 'TERMINAL', mcb: 'MCB', rcbo: 'RCBO', rccb: 'RCCB', spd: 'SPD' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const safeColor = c => /^#[\da-f]{6}$/i.test(c || '') ? c : '#79968d';
const finite = (n, fallback) => Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : fallback;
const textWidth = (s, size) => [...String(s)].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 1 : 0.64) * size, 0);

export function moduleFaceSize(product, protection = false) {
  return { width: Math.max(5, finite(product.width, 36) - 7), height: protection ? 37 : Math.max(24, finite(product.height, 90) * 0.54) };
}

export function moduleFaceScene(product = {}, width = 600, height = 240) {
  const W = finite(width, 600), H = finite(height, 240), w = W / H * 300, h = 300;
  const shapes = [], p = product, kind = p.kind || 'gateway';
  const protection = ['mcb', 'rcbo', 'rccb', 'spd'].includes(kind);
  const light = protection || p.brand === 'Lutron' || p.brand === 'ABB' || p.brand === 'MDT';
  const paper = light ? '#f1f0e9' : '#242c32', ink = light ? '#253933' : '#e6edea';
  const muted = light ? '#596b63' : '#a6b6ba', edge = light ? '#c4cdc5' : '#46535a';
  const accent = ACCENTS[p.brand] || safeColor(p.color), pad = Math.min(16, w * 0.09), cw = w - 2 * pad;
  const narrow = w < 190;
  const rect = (x,y,width,height,fill,stroke='none',rx=0) => shapes.push({tag:'rect',x,y,width,height,fill,stroke,rx});
  const line = (x1,y1,x2,y2,stroke=edge,sw=1.5) => shapes.push({tag:'line',x1,y1,x2,y2,stroke,'stroke-width':sw});
  const circle = (cx,cy,r,fill,stroke=edge) => shapes.push({tag:'circle',cx,cy,r,fill,stroke});
  const text = (value,x,y,size=12,fill=ink,max=cw,anchor='start') => {
    let t = String(value ?? ''), fitted = size;
    if (textWidth(t,size) > max) fitted = Math.max(size * 0.7, Math.min(size,max / Math.max(1,textWidth(t,1))));
    while (textWidth(t,fitted) > max && t.length > 1) t = t.slice(0,-2) + '…';
    shapes.push({tag:'text',x,y,fill,'font-size':fitted,'font-weight':600,'text-anchor':anchor,text:t});
  };
  if (p.faceRole === 'terminal-marker') {
    rect(0,0,w,h,'#eef0e4');
    text(p.marker ?? '',w/2,170,80,'#243733',cw,'middle');
    return { width:W,height:H,w,h,shapes,kind,title:`端子 ${p.marker ?? ''} · 位置标识` };
  }
  rect(0,0,w,h,paper); rect(2,2,w-4,h-4,'none',edge,5); rect(pad,10,cw,4,accent);
  const model = String(p.name || p.sku || p.id || 'DIN MODULE');
  if (w > 450) {
    text(p.brand || 'CUSTOM',pad,48,28,ink,cw*.38);
    text(model,pad+cw*.42,48,32,ink,cw*.58);
  } else {
    text(p.brand || 'CUSTOM',pad,35,narrow?12:16,ink);
    text(model,pad,58,narrow?12:19,ink);
  }
  line(pad,72,w-pad,72);
  const protocols = (Array.isArray(p.protocol) ? p.protocol : p.protocol ? [p.protocol] : []).map(v=>String(v).toUpperCase());
  const dali = protocols.includes('DALI');
  text(dali && kind === 'gateway' ? 'DALI INTERFACE' : NAMES[kind] || 'MODULE',pad,94,narrow?10:16,muted);

  if (protection) {
    rect(pad,108,cw,56,light?'#fffef8':'#111a20',edge,3);
    const rating = p.amps != null ? `${p.curve || ''}${p.amps} A` : '— A';
    text(kind==='spd' ? 'SPD' : rating,w/2,144,narrow?22:30,ink,cw-8,'middle');
    // 图形只表示器件种类；不补造厂家型号、分断能力或浪涌等级。
    const cx=w/2;
    line(cx,178,cx,192,muted,2); circle(cx,194,2.5,paper,muted);
    line(cx,194,cx+Math.min(14,cw/4),211,muted,2); circle(cx,218,2.5,paper,muted); line(cx,220,cx,233,muted,2);
    if (kind==='spd') { line(cx-10,183,cx+8,197,accent,3); line(cx+8,197,cx-6,208,accent,3); }
    text(p.residual ? `${p.rcdType || '—'} / ${p.residual} mA` : p.poles ? `${p.poles} POLE` : '参数待核',w/2,253,11,muted,cw,'middle');
  } else if (kind==='psu') {
    for(let i=0;i<7;i++) { rect(pad,111+i*10,cw,3,'#11191d'); line(pad,115+i*10,w-pad,115+i*10,edge,1); }
    circle(pad+6,205,4,'#64776d'); text('DC',pad+17,209,11,muted,Math.max(10,cw-18));
    rect(pad,224,cw,31,light?'#d6ddd1':'#182025',edge,3);
    text('OUTPUT',w/2,244,11,muted,cw-6,'middle');
  } else if (kind==='meter' || kind==='timer') {
    rect(pad,111,cw,88,'#101b1a',edge,5); rect(pad+4,115,cw-8,80,'#c4d0b2','none',3);
    text(kind==='timer' ? '--:--' : '— —',w/2,154,narrow?22:36,'#334b3c',cw-14,'middle');
    text(kind==='timer' ? 'PROGRAM' : 'kWh',w/2,184,12,'#334b3c',cw-14,'middle');
    for(let i=0;i<3;i++) { const x=pad+cw*(i+0.5)/3; circle(x,228,Math.min(12,cw/8),paper,edge); text(['−','○','+'][i],x,232,12,muted,cw/3,'middle'); }
  } else if (kind==='terminal') {
    const n=Math.max(1,Math.min(24,Number(p.poles)||1)), cell=cw/n;
    for(let i=0;i<n;i++) { const x=pad+i*cell; rect(x,110,cell,139,p.terminalColor==='blue'?'#407fac':'#7d888e',edge,1); rect(x+cell*.25,128,cell*.5,15,'#da9551','none',2); circle(x+cell/2,172,Math.min(8,cell*.23),'#18252b'); rect(x+cell*.22,201,cell*.56,22,'#e4e8dd','none',1); text(i+1,x+cell/2,217,11,'#253933',cell*.5,'middle'); }
  } else {
    const count = Number.isFinite(Number(p.channels)) && Number(p.channels)>0 ? Math.floor(Number(p.channels)) : 0;
    if(count) {
      const visible = Math.min(32,count), cols=Math.max(1,Math.min(8,visible,Math.floor(cw/46))), rows=Math.ceil(visible/cols);
      const cellW=cw/cols, cellH=145/rows;
      for(let i=0;i<visible;i++) {
        const x=pad+(i%cols)*cellW, y=107+Math.floor(i/cols)*cellH;
        rect(x+2,y+2,cellW-4,cellH-5,light?'#e4e7df':'#1a2329',edge,3);
        text(`${dali?'BUS':'CH'} ${i+1}`,x+cellW/2,y+cellH*.27,Math.min(18,cellH*.2,cellW*.2),muted,cellW-8,'middle');
        circle(x+cellW/2,y+cellH*.45,Math.min(3,cellH*.08),'#667a70');
        if(kind==='dimmer') { for(let j=0;j<4;j++) rect(x+cellW*.22+j*cellW*.14,y+cellH*.78-j*cellH*.035,cellW*.08,cellH*(.06+j*.035),edge); }
        else if(kind==='contactor') { text('↑ ↓',x+cellW/2,y+cellH*.82,Math.min(14,cellH*.2),ink,cellW-8,'middle'); }
        else if(kind==='gateway') { rect(x+cellW*.22,y+cellH*.64,cellW*.56,cellH*.2,paper,edge,2); line(x+cellW*.35,y+cellH*.74,x+cellW*.65,y+cellH*.74,accent,1.5); }
        else { circle(x+cellW/2,y+cellH*.75,Math.min(9,cellH*.16),paper,edge); line(x+cellW/2-3,y+cellH*.75,x+cellW/2+3,y+cellH*.75,muted); }
      }
    } else {
      rect(pad,114,cw,108,light?'#e4e7df':'#1a2329',edge,4);
      for(let i=0;i<3;i++) { circle(pad+cw*.18,137+i*31,3,'#667a70'); text(['PWR','BUS','LINK'][i],pad+cw*.32,141+i*31,11,muted,cw*.6); }
      text('接口示意',w/2,246,11,muted,cw,'middle');
    }
  }
  line(pad,266,w-pad,266);
  const footer = protocols.join(' · ') || (p.modules ? `${p.modules}M · DIN` : 'DIN');
  text(footer,pad,284,narrow?9:16,muted,p.hardwareId?cw*.65:cw);
  if(p.hardwareId) text(`ID ${p.hardwareId}`,w-pad-cw*.28,284,narrow?10:19,ink,cw*.28);
  return { width:W,height:H,w,h,shapes,kind,title:`${p.brand||''} ${p.name||model} · 参数化外观示意，非厂家接线图；指示灯不代表实时状态` };
}

export function moduleFaceSvg(product, width=600, height=240) {
  const s=moduleFaceScene(product,width,height);
  const body=s.shapes.map(({tag,text,...attrs})=>`<${tag} ${Object.entries(attrs).map(([k,v])=>`${k}="${esc(v)}"`).join(' ')}>${text===undefined?'':esc(text)}</${tag}>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.width}" height="${s.height}" viewBox="0 0 ${s.w} ${s.h}" role="img" aria-label="${esc(s.title)}" font-family="${FONT}"><title>${esc(s.title)}</title>${body}</svg>`;
}

export function paintModuleFace(ctx,width,height,product) {
  const s=moduleFaceScene(product,width,height);
  ctx.save(); ctx.scale(width/s.w,height/s.h);
  for(const a of s.shapes) {
    ctx.fillStyle=a.fill==='none'?'transparent':a.fill||'#000'; ctx.strokeStyle=a.stroke||'transparent'; ctx.lineWidth=a['stroke-width']||1;
    ctx.beginPath();
    if(a.tag==='rect') ctx.roundRect(a.x,a.y,a.width,a.height,a.rx||0);
    if(a.tag==='circle') ctx.arc(a.cx,a.cy,a.r,0,2*Math.PI);
    if(a.tag==='line') { ctx.moveTo(a.x1,a.y1); ctx.lineTo(a.x2,a.y2); }
    if(a.tag==='text') { ctx.font=`${a['font-weight']} ${a['font-size']}px ${FONT}`; ctx.textAlign=a['text-anchor']==='middle'?'center':'left'; ctx.textBaseline='alphabetic'; ctx.fillText(a.text,a.x,a.y); }
    else { if(a.fill && a.fill!=='none')ctx.fill(); if(a.stroke && a.stroke!=='none')ctx.stroke(); }
  }
  ctx.restore();
}

/** 采用统一比例缩放，窄贴图也不会因分别钳制宽高而变形。 */
export function faceTextureSize(width,height) {
  const scale=Math.min(20,3072/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
