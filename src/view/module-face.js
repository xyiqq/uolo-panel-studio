/** 装配模块的矢量原稿。SVG 与同步 Canvas 贴图共用图元，不依赖图片加载或网络。 */
import { networkSwitchPortLayout } from './network-switch-layout.js';
import {PDU_SOCKET_HOLES,socketHolePolygon} from './pdu-socket-layout.js';
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
  if (p.interfaceProfile === 'din-tcp' && !p.faceRole) {
    rect(0,0,w,h,'#f1f2ec');rect(2,2,w-4,h-4,'none','#91a89d',5);
    rect(pad,12,cw,6,'#267a72');
    text('USMART',pad,48,23,'#24534c',cw*.65);
    text('DIN-TCP',pad,78,24,'#253d39',cw);
    text(`1 × LAN / ${p.serialPorts} × RS-485`,pad,102,15,'#536b60',cw);
    const portW=Math.min(80,cw*.28),portX=w/2-portW/2;
    rect(portX,122,portW,58,'#29383c','#73847c',3);
    rect(portX+6,129,portW-12,35,'#0d181c');
    for(let i=0;i<8;i++)rect(portX+10+i*(portW-20)/8,130,2,17,'#c4aa67');
    rect(w/2-9,164,18,8,'#0d181c');text('LAN',w/2,200,14,'#31534a',portW,'middle');
    const cell=cw/p.serialPorts;
    for(let i=0;i<p.serialPorts;i++){
      const x=pad+i*cell;rect(x+3,214,cell-6,34,'#4f8570','#345b4c',2);
      for(let j=0;j<2;j++)circle(x+cell*(j? .7:.3),230,Math.min(5,cell*.1),'#233c32');
      text(`485-${i+1}`,x+cell/2,270,Math.min(15,cell*.24),'#31534a',cell-4,'middle');
    }
    text('接口位置示意',w/2,291,10,'#6b7d72',cw,'middle');
    return {width:W,height:H,w,h,shapes,kind,title:`USMART DIN-TCP · 1 网口 / ${p.serialPorts} RS-485`};
  }
  if (p.faceRole === 'terminal-marker') {
    rect(0,0,w,h,'#eef0e4');
    text(p.marker ?? '',w/2,170,80,'#243733',cw,'middle');
    return { width:W,height:H,w,h,shapes,kind,title:`端子 ${p.marker ?? ''} · 位置标识` };
  }
  if(p.faceRole==='module-note'){
    rect(0,0,w,h,'#23784f');
    text(p.displayName||'',w/2,h*.69,h*.6,'#ffffff',cw,'middle');
    return {width:W,height:H,w,h,shapes,kind,title:p.displayName||''};
  }
  if(p.faceRole==='pdu-outlet-label'){
    rect(0,0,w,h,'#ecf3e8');rect(0,0,w*.12,h,'#23784f');
    text(p.outletNumber,w*.06,h*.62,h*.48,'#fff',w*.11,'middle');
    const label=String(p.outletText||'未指定'),chars=[...label],lines=[];
    for(let i=0;i<chars.length;i+=12)lines.push(chars.slice(i,i+12).join(''));
    const lh=h/(lines.length+1);
    lines.forEach((line,i)=>text(line,w*.56,lh*(i+1)+lh*.2,Math.min(lh*.7,w*.82/Math.max(1,[...line].length)),'#243b30',w*.84,'middle'));
    return {width:W,height:H,w,h,shapes,kind,title:`插位${p.outletNumber}：${label}`};
  }
  if(p.outletCount){
    rect(0,0,w,h,'#354047');rect(0,0,w*.025,h,'#238daf');rect(w*.975,0,w*.025,h,'#238daf');
    rect(w*.03,12,w*.08,h-24,'#2188a6');rect(w*.05,90,w*.04,110,'#3e8e66','#b7d8e1',2);
    text('BULL',w*.07,50,18,'#fff',w*.075,'middle');
    const cell=(w*.85)/p.outletCount;
    for(let i=0;i<p.outletCount;i++){
      const x=w*.12+(i+.5)*cell,pw=cell*.88;
      rect(x-pw/2,20,pw,250,'#1e272d','#576268',3);
      for(const hole of PDU_SOCKET_HOLES)shapes.push({tag:'polygon',points:socketHolePolygon(hole).map(v=>`${x+v.x*pw/37},${132-v.y*6.3}`).join(' '),fill:'#080e12'});
      text(`${i+1} ${p.outletLabels?.[i+1]||'未指定'}`,x,251,15,'#c9e4c8',pw-4,'middle');
    }
    return {width:W,height:H,w,h,shapes,kind,title:`${p.outletCount}位PDU`};
  }
  if(p.faceRole==='network-port-labels'){
    rect(0,0,w,h,'#e8eddf');
    const columns=p.networkLabelColumns||Math.min(8,p.networkPorts),rows=Math.ceil(p.networkPorts/columns),cellW=w/columns,cellH=(h-42)/rows;
    text(`${p.networkDeviceLabel||p.networkPorts+'口交换机'} · 网口信息${p.hardwareId?' · ID '+p.hardwareId:''}`,12,27,18,'#25493b',w-24);
    for(let i=0;i<p.networkPorts;i++){
      const x=(i%columns)*cellW,y=42+Math.floor(i/columns)*cellH;
      rect(x+2,y+2,cellW-4,cellH-4,'#fafcf4','#8ea59a',2);
      rect(x+3,y+3,cellW-6,22,'#23784f');
      text(p.networkPortNames?.[i]||String(i+1),x+cellW/2,y+19,14,'#fff',cellW-8,'middle');
      const label=String(p.switchPortLabels?.[i+1]||'—');
      const chars=[...label],lines=[];for(let j=0;j<chars.length;j+=8)lines.push(chars.slice(j,j+8).join(''));
      const lineHeight=Math.min(24,(cellH-30)/Math.max(1,lines.length));
      const widestLine=Math.max(1,...lines.map(line=>textWidth(line,1)));
      const fontSize=Math.min(19,lineHeight*.8,(cellW-10)/widestLine);
      lines.forEach((line,j)=>text(line,x+cellW/2,y+30+(j+.75)*lineHeight,fontSize,'#233b31',cellW-10,'middle'));
    }
    return {width:W,height:H,w,h,shapes,kind,title:'交换机网口信息'};
  }
  if (p.networkPorts) {
    rect(0,0,w,h,'#3c3c3e');rect(3,3,w-6,h-6,'none','#747478',3);
    const dual=p.networkPortRows===2,kx=w/p.width,ky=h/p.height;
    text('Ruijie 锐捷',12,dual?25:289,dual?17:20,'#eeeeee',w*.14);
    text(p.networkDeviceLabel||`${p.networkPorts}口交换机`,w*.77,dual?80:289,18,'#eeeeee',w*.22);
    circle(w*.045,140,4,'#78ab73');text('Status',w*.045,120,11,'#d4d4d5',w*.08,'middle');
    for(const port of networkSwitchPortLayout(p)){
      const x=(port.x+p.width/2-7)*kx,y=(p.height/2-port.y-6.4)*ky,pw=14*kx,ph=12.8*ky;
      rect(x,y,pw,ph,'#bdc3c5','#e0e8e7',2);rect(x+pw*.08,y+ph*.09,pw*.84,ph*.7,'#0b1015');
      rect(x+pw*.28,y+ph*.7,pw*.44,ph*.23,'#0b1015');
      for(let pin=0;pin<8;pin++)rect(x+pw*.16+pin*pw*.09,y+ph*.12,pw*.04,ph*.24,'#bca979');
      text(port.name||port.number,x+pw/2,dual?(port.y>0?40:282):257,port.name?9:dual?13:16,'#eeeeee',pw,'middle');
    }
    if(!dual&&p.networkProfile!=='eg210gpe-v2'){circle(w-8*kx,140,3*kx,'#141416','#8b8b8b');text('DC 5V',w-9*kx,75,13,'#eeeeee',w*.1,'middle');}
    else if(p.networkProfile==='eg210gpe-v2'){text('PoE 110W',w*.39,40,16,'#e9c46a',w*.45,'middle');circle(w*.035,210,4,'#222222');text('Reset',w*.035,250,10,'#dddddd',w*.06,'middle');}
    else {rect(w*.035,210,w*.025,18,'#151515');rect(w*.046,210,w*.007,18,'#bbbbbb');text('MODE',w*.048,255,9,'#dddddd',w*.06,'middle');}
    return {width:W,height:H,w,h,shapes,kind,title:p.networkDeviceLabel||`${p.networkPorts}口交换机`};
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
  text(dali && kind === 'gateway' ? 'DALI INTERFACE' : NAMES[kind] || 'MODULE',pad,94,narrow?10:16,muted,p.hardwareId?cw*.62:cw);
  if(p.hardwareId){
    const badgeW=Math.min(108,cw*.34);
    rect(w-pad-badgeW,77,badgeW,26,accent,'none',3);
    text(`ID ${p.hardwareId}`,w-pad-badgeW/2,97,narrow?12:23,'#18252b',badgeW-6,'middle');
  }

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
    const output=p.psuOutput;
    const outputLabel=output?.voltage ? `${output.voltage}V DC${output.amps!=null?' / '+output.amps+'A':output.milliamps!=null?' / '+output.milliamps+'mA':''}` : 'OUTPUT';
    text(outputLabel,w/2,244,11,muted,cw-6,'middle');
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
  if(p.ipAddress){
    rect(pad,270,cw,26,'#f5cf69','none',3);
    text(`IP ${p.ipAddress}`,pad+4,289,18,'#30250d',cw-8);
  } else text(footer,pad,284,narrow?9:16,muted);
  return { width:W,height:H,w,h,shapes,kind,title:`${p.brand||''} ${p.name||model} · 参数化外观示意，非厂家接线图；指示灯不代表实时状态` };
}

export function moduleFaceSvg(product, width=600, height=240) {
  const s=moduleFaceScene(product,width,height);
  const body=s.shapes.map(({tag,text,...attrs})=>`<${tag} ${Object.entries(attrs).map(([k,v])=>`${k}="${esc(v)}"`).join(' ')}>${text===undefined?'':esc(text)}</${tag}>`).join('');
  const note=product.displayName && !product.faceRole ? moduleFaceScene({...product,faceRole:'module-note'},width,32) : null;
  const header=note?`<rect width="${s.w}" height="40" fill="#23784f"/><text x="${s.w/2}" y="27" text-anchor="middle" fill="#ffffff" font-size="18">${esc(note.shapes.find(x=>x.tag==='text')?.text)}</text>`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.width}" height="${s.height+(note?40*s.height/s.h:0)}" viewBox="0 0 ${s.w} ${s.h+(note?40:0)}" role="img" aria-label="${esc(s.title)}" font-family="${FONT}"><title>${esc(s.title)}</title>${header}<g transform="translate(0 ${note?40:0})">${body}</g></svg>`;
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
    if(a.tag==='polygon') { const points=a.points.split(' ').map(pair=>pair.split(',').map(Number));points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath(); }
    if(a.tag==='text') { ctx.font=`${a['font-weight']} ${a['font-size']}px ${FONT}`; ctx.textAlign=a['text-anchor']==='middle'?'center':'left'; ctx.textBaseline='alphabetic'; ctx.fillText(a.text,a.x,a.y); }
    else { if(a.fill && a.fill!=='none')ctx.fill(); if(a.stroke && a.stroke!=='none')ctx.stroke(); }
  }
  ctx.restore();
}

/** 采用统一比例缩放，窄贴图也不会因分别钳制宽高而变形。 */
export function faceTextureSize(width,height) {
  const scale=Math.min(20,3072/Math.max(width,height));
  const textureHeight=Math.max(1,Math.floor(height*scale));
  return {width:Math.max(1,Math.round(textureHeight*width/height)),height:textureHeight};
}
