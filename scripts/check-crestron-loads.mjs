import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {csvRows,pdfPages,compact} from './wiring-check-helpers.mjs';

const dir='.playwright-cli/p2-loads-delivery';
const base=process.env.PANEL_URL||'http://127.0.0.1:5173/';
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:process.env.PDF_BROWSER||'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1536,height:1050},acceptDownloads:true});
const websocket=new URL(base);websocket.protocol='ws:';
await context.routeWebSocket(url=>url.origin===websocket.origin,()=>{});
const page=await context.newPage();
const errors=[];page.on('pageerror',err=>errors.push(err.message));
const order=rows=>rows.map(w=>[w.from,w.to,w.conductor].join('|')).sort();
context.setDefaultTimeout(25_000);
try{
  await page.goto(base);await page.waitForFunction(()=>window.__PANEL_STATE__);
  const fixture=await page.evaluate(async()=>{
    const {createDefaultDesign}=await import('/src/core/domain.js');
    const d=createDefaultDesign();
    d.name='P2 负载与三相四线验收';d.designId='p2-loads-delivery';d.uiMode='full';d.includeSpd=false;
    const singles=d.circuits.filter(c=>c.voltage===220).slice(0,8);
    d.circuits=[...singles.map(c=>({...c,phase:'L1'})),d.circuits.find(c=>c.voltage===380)];
    d.modules=[
      {id:'K1',productId:'crestron-din-8sw8-i',feed:'perChannel',channels:{1:singles[0].id},seriesStages:{1:1}},
      {id:'K2',productId:'crestron-din-8sw8-i',feed:'perChannel',channels:{2:singles[0].id},seriesStages:{2:2}},
      {id:'FLV',productId:'crestron-din-4dimflv4'},
      {id:'MOT',productId:'crestron-din-2mc2',feed:'perChannel',channels:{2:singles[1].id}},
      {id:'DIM',productId:'crestron-din-1dimu4',feed:'shared',feedCircuitId:singles[2].id,channels:{1:singles[2].id,2:singles[3].id}},
      {id:'WH1',productId:'eastron-sdm630-modbus-v2'},
      {id:'WH2',productId:'eastron-sdm630-modbus-v2'},
      {id:'T1',productId:'phoenix-pt25-gy-4'},
      {id:'LUT',productId:'lutron-lqse-4m-d'},
    ];
    d.revisions=[{at:'2026-11-19T10:00:00',summary:'P2 负载验收',errors:0,pending:0}];
    return d;
  });
  await page.locator('#file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  await page.waitForFunction(()=>window.__PANEL_STATE__.design().designId==='p2-loads-delivery');
  const edit=async id=>{await page.locator('#manage-modules').click();await page.locator('[data-mod-edit="'+id+'"]').click();};
  const save=async()=>{await page.locator('#mod-save').click();await page.locator('#modal').waitFor({state:'hidden'});};
  const circuit=fixture.circuits[0].id, three=fixture.circuits.at(-1).id;
  await edit('FLV');
  await page.locator('[data-mod-ch="1"]').selectOption(circuit);
  await page.locator('[data-load-setting="1"] [data-series-stage]').fill('3');
  await page.locator('[data-load-setting="1"] [data-analog-plus]').selectOption('T1:1');
  await page.locator('[data-load-setting="1"] [data-analog-minus]').selectOption('T1:2');
  await page.locator('[data-load-setting="1"] [data-analog-gauge]').selectOption('0.75');
  const analog=page.locator('[data-load-setting="1"]');
  await analog.locator('[data-analog-ma]').fill('60');
  await analog.locator('[data-analog-driver]').selectOption('sink');
  assert.match(await analog.locator('[data-analog-budget]').innerText(),/只吸流/);
  await analog.locator('[data-analog-driver]').selectOption('source');
  await save();
  for(const [meter,stage] of [['WH1','1'],['WH2','2']]){
    await edit(meter);await page.locator('[data-mod-ch="1"]').selectOption(three);
    const field=page.locator('[data-load-setting="1"] [data-series-stage]');
    if(stage==='2'){
      await field.fill('1');await page.locator('#mod-save').click();assert.match(await page.locator('#mod-save-error').innerText(),/级次/);
    }
    await field.fill(stage);await save();
  }
  await edit('LUT');await page.locator('#mod-feed-c').selectOption(fixture.circuits[4].id);
  for(let i=0;i<4;i++)await page.locator('[data-mod-ch="'+(i+1)+'"]').selectOption(fixture.circuits[4+i].id);
  await save();
  await page.reload();await page.waitForFunction(()=>window.__PANEL_STATE__?.design().designId==='p2-loads-delivery');
  await edit('FLV');
  assert.equal(await page.locator('[data-load-setting="1"] [data-series-stage]').inputValue(),'3');
  assert.equal(await page.locator('[data-load-setting="1"] [data-analog-gauge]').inputValue(),'0.75');
  assert.equal(await analog.locator('[data-analog-ma]').inputValue(),'60');
  assert.equal(await analog.locator('[data-analog-driver]').inputValue(),'source');
  for(const [key,value] of [['plus','T1:1'],['minus','T1:2']])
    assert.equal(await page.locator('[data-load-setting="1"] [data-analog-'+key+']').inputValue(),value);
  await page.locator('#close-modal').click();
  for(const [meter,stage] of [['WH1','1'],['WH2','2']]){
    await edit(meter);assert.equal(await page.locator('[data-mod-ch="1"]').inputValue(),three);
    assert.equal(await page.locator('[data-load-setting="1"] [data-series-stage]').inputValue(),stage);
    await page.locator('#close-modal').click();
  }

  await edit('LUT');
  assert.equal(await page.locator('#mod-feed-c').inputValue(),fixture.circuits[4].id);
  for(let i=0;i<4;i++)assert.equal(await page.locator('[data-mod-ch="'+(i+1)+'"]').inputValue(),fixture.circuits[4+i].id);
  await page.locator('#close-modal').click();
  await page.locator('[data-tab="wiring"]').click();await page.locator('#all-wires').check();
  const rows=await page.locator('#pane tr[data-wire-from]').evaluateAll(rs=>rs.map(r=>({from:r.dataset.wireFrom,to:r.dataset.wireTo,conductor:r.cells[0].textContent.trim()})));
  const dl=page.waitForEvent('download');await page.locator('#wires-csv').click();await(await dl).saveAs(dir+'/wiring.csv');
  const csv=csvRows(readFileSync(dir+'/wiring.csv','utf8'));
  assert.deepEqual(order(rows),order(csv));
  const neutralOrigin=csv.find(w=>w.to==='LUT:N_IN')?.from;
  assert.ok(neutralOrigin);
  const expected=[
    ['K1:CH1_OUT','K2:CH2_IN'],['K2:CH2_OUT','FLV:CH1_IN'],['FLV:CH1_OUT','X-'+circuit+':L1'],
    ['FLV:CH1_PLUS','T1:1'],['FLV:CH1_MINUS','T1:2'],['MOT:CH2_OP','X-'+fixture.circuits[1].id+':L1'],
    ['MOT:CH2_CL','X-'+fixture.circuits[1].id+':CL'],['DIM:CH2_N','X-'+fixture.circuits[3].id+':N'],
    ['DIM:CH2_PE','X-'+fixture.circuits[3].id+':PE'],
    ...fixture.circuits.slice(4,8).flatMap((c,i)=>[['LUT:CH'+(i+1)+'_OP','X-'+c.id+':L1'],['LUT:CH'+(i+1)+'_CL','X-'+c.id+':CL'],[neutralOrigin,'X-'+c.id+':N']]),
    ...['L1','L2','L3','N'].flatMap(k=>[[three+'-RCD:'+k+'_OUT','WH1:'+k+'_IN'],['WH1:'+k+'_OUT','WH2:'+k+'_IN'],['WH2:'+k+'_OUT','X-'+three+':'+k]]),
  ];
  for(const [from,to] of expected) assert.ok(csv.some(w=>w.from===from&&w.to===to),'Missing conductor '+from+' → '+to);
  await page.locator('[data-tab="assembly"]').click();
  const isolated=page.locator('#inspect-only.active');if(await isolated.isVisible()) await isolated.click();
  await page.locator('#wire-mode').selectOption('all');await page.locator('[data-mode="front"]').click();
  await page.waitForFunction(()=>{const s=window.__PANEL_STATE__.studio();return !!s.model?.layers.wires.visible&&!s.cameraTarget&&!s.options.isolate;});
  const geometry=await page.evaluate(()=>{
    const s=window.__PANEL_STATE__, net=s.net();
    const same=(p,a)=>p&&a&&['x','y','z'].every(k=>Math.abs(p[k]-a[k])<1e-5);
    return [...s.studio().model.wires.values()].filter(w=>w.mesh.visible).map(({curve,edge})=>({
      from:edge.from,to:edge.to,anchored:same(curve?.points[0],net.ports[edge.from])&&same(curve?.points.at(-1),net.ports[edge.to])}));
  });
  for(const [from,to] of expected)assert.ok(geometry.find(w=>w.from===from&&w.to===to)?.anchored,'3D anchors '+from+' → '+to);
  await page.locator('#canvas').screenshot({path:dir+'/assembly.png'});

  await page.locator('#tab-documents').click();await page.locator('#v5-docs-none').click();
  const pages=page.locator('[data-doc^="wiring-table"]');await pages.first().waitFor();
  for(const el of await pages.all()) await el.check();
  await page.evaluate(()=>{window.print=()=>window.__LOADS_PRINT_READY__=true;});
  await page.locator('#v5-docs-print').click();await page.locator('#v5-export-current').click();await page.waitForFunction(()=>window.__LOADS_PRINT_READY__);
  assert.equal(await page.locator('#v5-print-root [data-layout-overflow="true"]').count(),0);
  const path=dir+'/wiring.pdf';await page.pdf({path,preferCSSPageSize:true,printBackground:true});
  const pdf=pdfPages(path),records=pdf.flatMap(text=>text.split('编号:').slice(1));
  assert.ok(pdf.some(p=>p.includes(compact('驱动器供流 · 60 mA / 60 mA'))));
  assert.equal(records.length,csv.length);
  for(const w of csv) assert.ok(records.some(r=>r.includes(compact('从:'+w.fromTag+'到:'+w.toTag))),'PDF '+w.fromTag+' → '+w.toTag);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({wires:csv.length,checked3D:expected.length,pdfPages:pdf.filter(Boolean).length,output:dir}));
}catch(error){
  console.error(await page.locator('#mod-save-error').textContent({timeout:300}).catch(()=>''),errors);throw error;
}finally{await browser.close();}
