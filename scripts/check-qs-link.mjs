import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createBreakerPackDesign} from '../src/data/design-templates.js';
import {csvRows,pdfPages,compact} from './wiring-check-helpers.mjs';

const dir='.playwright-cli/p2-qs/acceptance';
mkdirSync(dir,{recursive:true});
const url=process.env.PANEL_URL||'http://127.0.0.1:5173/';
const browser=await chromium.launch({channel:process.env.PDF_BROWSER||'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true});
const hmr=new URL(url.replace(/^http/,'ws'));
await context.routeWebSocket(ws=>ws.origin===hmr.origin && ws.pathname===hmr.pathname,()=>{});
const page=await context.newPage();
const errors=[];page.on('pageerror',err=>errors.push(err.message));
const d=createBreakerPackDesign({count:7,productId:'A9D32610',name:'QSX 处理器、现场供电与以太网'});
d.uiMode='full';d.designId='qsx-delivery-acceptance';d.includeSpd=false;
d.revisions=[{at:'2026-11-19T00:00:00',summary:'QS 接线核验',errors:0,pending:0}];
d.modules=[
  {id:'P1',productId:'lutron-hqp7-2'},{id:'P2',productId:'lutron-hqp7-1'},
  {id:'PS1',productId:'lutron-qsps-dh-1-75-h',protectId:'C01'},
  {id:'PF',productId:'lutron-qsps-dh-1-75',protectId:'C02'},
  {id:'S1',productId:'lutron-lqse-4s10-d',protectId:'C03'},
  {id:'D1',productId:'lutron-lqse-4t10-d',protectId:'C04',channels:{1:'C07'},feed:'perChannel',analogTerminals:{1:{plus:'T3:1',minus:'T3:2'}}},
  {id:'DA',productId:'lutron-lqse-2dal-d',protectId:'C05'},
  {id:'PS2',productId:'lutron-qsps-dh-1-75-h',protectId:'C06'},
  ...['T1','T2','T3'].map(id=>({id,productId:'phoenix-pt25-gy-4'}))];
const open=async id=>{await page.locator('#manage-modules').click();await page.locator('[data-mod-edit="'+id+'"]').click();};
const save=async()=>{await page.locator('#mod-save').click();if(await page.locator('#mod-save-error').isVisible())throw Error(await page.locator('#mod-save-error').innerText());await page.locator('#modal').waitFor({state:'hidden'});};
const pair=w=>[w.from,w.to,w.conductor].join('|');
const expected=[];
const wire=(from,to,conductor)=>expected.push({from,to,conductor});
for(const p of [1,2])for(const s of ['+','-'])wire('PS'+p+':'+(s==='+'?'DC+':'MINUS2'),'P'+p+':DC'+s,'DC'+s);
wire('PS1:PLUS2','P1:PWR_L1','DC+');wire('P1:QS1_2','T1:2','DC+');wire('P1:ETH2','P2:ETH1','Cat5e');
for(const [p,c] of [[1,'COM'],[3,'MUX'],[4,'/MUX']]){
  wire('P1:QS1_'+p,'D1:QS_'+p,c);wire('D1:QS_'+p,'S1:QS_'+p,c);wire('S1:QS_'+p,'T1:'+p,c);
  wire('P1:QS2_'+p,'DA:QS_'+p,c);
  if(p!==1)wire('DA:QS_'+p,'T2:'+p,c);
}
wire('DA:QS_1','PF:DC-','COM');wire('PF:MINUS2','T2:1','COM');wire('PF:DC+','T2:2','DC+');
try{
  await page.goto(url);await page.waitForFunction(()=>window.__PANEL_STATE__);
  await page.locator('#file').setInputFiles({name:'qs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});
  await page.waitForFunction(id=>window.__PANEL_STATE__.design().designId===id,d.designId);
  await open('D1');
  const dim=page.locator('[data-load-setting="1"]');
  await dim.locator('[data-analog-driver]').selectOption('sink');
  await dim.locator('[data-analog-ma]').fill('51');
  assert.match(await dim.locator('[data-analog-budget]').innerText(),/超过每路 50 mA/);
  await save();await page.reload();await page.waitForFunction(id=>window.__PANEL_STATE__?.design().designId===id,d.designId);
  assert.ok(await page.evaluate(()=>!window.__PANEL_STATE__.net().wires.some(w=>w.from==='D1:CH1_PLUS')&&window.__PANEL_STATE__.net().wiringIssues.some(i=>i.code==='MODULE_ANALOG_INCOMPATIBLE'&&i.level==='error')));
  await open('D1');assert.equal(await dim.locator('[data-analog-ma]').inputValue(),'51');
  await dim.locator('[data-analog-ma]').fill('50');await page.locator('[data-analog-class]').selectOption('pelv');await save();
  await open('P2');await page.locator('#qs-enable').check();await page.locator('[data-qs="power"]').selectOption('PS2');await save();
  await open('P1');await page.locator('#qs-enable').check();await page.locator('[data-qs="power"]').selectOption('PS1');
  for(const [n,members,source] of [[1,['D1','S1'],'@link'],[2,['DA'],'PF']]){
    const box=page.locator('[data-qs-link="'+n+'"]');
    for(const id of members)await box.locator('[data-qs-member="'+id+'"]').check();
    if(n===1)await box.locator('[data-qs-members] > div:has([data-qs-member="D1"]) [data-qs-up]').click();
    await box.locator('[data-qs-num="meters"]').fill('35');
    assert.equal(await box.locator('[data-qs="terminal"] option[value="T3"]').count(),0);
    await box.locator('[data-qs="terminal"]').selectOption('T'+n);
    await box.locator('[data-qs="group"]').selectOption(source);
    for(const [key,value] of Object.entries({fieldPdu:12,fieldMa:140,fieldDevices:6,fieldOutputs:20}))await box.locator('[data-qs-num="'+key+'"]').fill(String(value));
  }
  await page.locator('[data-qs="ethernet"]').selectOption('P2');await page.locator('[data-qs-num="ethernetMeters"]').fill('12');await save();
  await page.reload();await page.waitForFunction(id=>window.__PANEL_STATE__?.design().designId===id,d.designId);
  await open('P1');assert.equal(await page.locator('[data-qs="power"]').inputValue(),'PS1');
  assert.equal(await page.locator('[data-qs-link="2"] [data-qs="group"]').inputValue(),'PF');
  assert.match(await page.locator('#qs-settings').innerText(),/20 \/ 75 PDU/);
  await page.locator('#qs-settings').screenshot({path:dir+'/settings.png'});await page.locator('#close-modal').click();
  await page.locator('[data-tab="assembly"]').click();
  await page.locator('#wire-mode').selectOption('all');await page.locator('[data-mode="front"]').click();
  if(await page.locator('#inspect-only.active').isVisible())await page.locator('#inspect-only.active').click();
  await page.waitForFunction(()=>{const v=window.__PANEL_STATE__.studio();return v?.renderer.domElement.dataset.ready==='true'&&!v.cameraTarget&&!v.options.isolate;});
  const geometry=await page.evaluate(()=>{
    const s=window.__PANEL_STATE__, n=s.net(), views=[...s.studio().model.wires.values()];
    const at=(v,p)=>p&&v&&['x','y','z'].every(k=>Math.abs(v[k]-p[k])<0.00001);
    return views.filter(w=>w.edge.qsLink && w.mesh.visible).map(({edge,curve})=>({...edge,anchored:at(curve?.points[0],n.ports[edge.from])&&at(curve?.points.at(-1),n.ports[edge.to])}));
  });
  assert.deepEqual(geometry.map(pair).sort(),expected.map(pair).sort());assert.ok(geometry.every(w=>w.anchored&&w.connected));
  await page.locator('#canvas').screenshot({path:dir+'/assembly.png'});
  await page.locator('[data-tab="wiring"]').click();await page.locator('#all-wires').check();
  const rows=await page.locator('#pane tr[data-wire-from]').evaluateAll(rows=>rows.map(row=>({from:row.dataset.wireFrom,to:row.dataset.wireTo,conductor:row.cells[0].textContent.trim()})));
  const file=page.waitForEvent('download');await page.locator('#wires-csv').click();await (await file).saveAs(dir+'/wiring.csv');
  const csv=csvRows(readFileSync(dir+'/wiring.csv','utf8'));
  assert.ok(readFileSync(dir+'/wiring.csv','utf8').includes('驱动器吸流 · 50 mA / 50 mA'));
  assert.deepEqual(csv.map(pair).sort(),rows.map(pair).sort());
  assert.ok(expected.every(w=>csv.some(row=>pair(row)===pair(w))));
  assert.ok(csv.some(w=>w.to==='D1:PE_IN')&&csv.some(w=>w.from==='D1:CH1_PLUS'&&w.to==='T3:1'));
  await page.locator('#tab-documents').click();await page.locator('#v5-docs-none').click();
  const selection=page.locator('[data-doc^="wiring-table"]');await selection.first().waitFor();for(const box of await selection.all())await box.check();
  await page.evaluate(()=>{window.print=()=>{window.__QS_PRINT__=true;};});
  await page.locator('#v5-docs-print').click();await page.locator('#v5-export-current').click();await page.waitForFunction(()=>window.__QS_PRINT__);
  assert.equal(await page.locator('#v5-print-root [data-layout-overflow="true"]').count(),0);
  const pdfPath=dir+'/wiring.pdf';await page.pdf({path:pdfPath,preferCSSPageSize:true,printBackground:true});
  const pages=pdfPages(pdfPath).filter(Boolean),records=pages.flatMap(p=>p.split('编号:').slice(1));
  assert.ok(pages.some(p=>p.includes(compact('驱动器吸流 · 50 mA / 50 mA'))));
  assert.equal(records.length,csv.length);
  for(const w of csv)assert.ok(records.some(r=>r.includes(compact('从:'+w.fromTag+'到:'+w.toTag))),w.fromTag+' → '+w.toTag);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({qs:expected.length,wires:csv.length,pages:pages.length,dir}));
}finally{await browser.close();}
