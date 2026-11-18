import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {unzipSync} from 'fflate';
import {csvRows,pdfPages,compact} from './wiring-check-helpers.mjs';

const url=process.env.PANEL_URL||'http://127.0.0.1:5173/';
const dir='.playwright-cli/p2-mixed-networks';
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:process.env.PDF_BROWSER||'chrome'});
try {
  const context=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true});
  await context.routeWebSocket(u=>u.hostname===new URL(url).hostname,()=>{});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(()=>window.__PANEL_STATE__);
  const d=await page.evaluate(async()=>{
    const {createBreakerPackDesign}=await import('/src/data/design-templates.js');
    const d=createBreakerPackDesign({count:1,productId:'A9D32610',name:'同柜 Cresnet 与 RS-485'});
    d.designId='p2-mixed-verified';d.uiMode='full';d.includeSpd=false;
    d.featureVisibility={...d.featureVisibility,busEditor:true};
    d.revisions=[{at:'2026-11-19T01:00:00',summary:'混合通信验收',errors:0,pending:0}];
    d.modules=[{id:'AP',productId:'crestron-din-ap4'},{id:'PS',productId:'crestron-din-pws50',protectId:'C01'},
      {id:'R1',productId:'crestron-din-8sw8-i'},{id:'GW',productId:'crestron-din-dali-2'},{id:'DLI',productId:'crestron-din-dli'},
      ...['W1','W2'].map(id=>({id,productId:'eastron-sdm630-modbus-v2'}))];
    return d;
  });
  await page.locator('#file').setInputFiles({name:'mixed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});
  await page.waitForFunction(id=>window.__PANEL_STATE__.design().designId===id,d.designId);
  await page.locator('#manage-modules').click();
  await page.locator('[data-mod-edit="AP"]').click();
  await page.setViewportSize({width:390,height:844});
  const serialBounds=await page.locator('#mod-serial').boundingBox();
  assert.ok(serialBounds && serialBounds.x>=0 && serialBounds.x+serialBounds.width<=391,'Serial editor fits a narrow viewport');
  await page.setViewportSize({width:1500,height:1050});
  await page.locator('[data-serial-rank="W2"]').fill('1');
  await page.locator('[data-serial-rank="W1"]').fill('1');
  await page.locator('#mod-save').click();
  assert.match(await page.locator('#mod-save-error').innerText(),/序号/);
  await page.locator('[data-serial-rank="W1"]').fill('2');
  await page.locator('#mod-serial-length').fill('12');
  await page.locator('#mod-save').click();
  await page.locator('#modal').waitFor({state:'hidden'});
  await page.locator('[data-feature="busEditor"]').click();
  await page.locator('[data-bus-new]').click();
  await page.locator('#bus-type').selectOption('cresnet');
  await page.locator('#bus-label').fill('混合 Cresnet');
  await page.locator('#bus-controller').selectOption('AP');
  await page.locator('#bus-chain-supply').selectOption('PS');
  await page.locator('#bus-chain-length').fill('8');
  await page.locator('#bus-length').fill('12');
  for(const id of ['R1','GW','DLI']) await page.locator(`[data-bus-member="${id}"]`).check();
  await page.locator('[data-bus-save]').click();
  await page.locator('[data-bus-new]').waitFor();
  await page.locator('#close-modal').click();
  await page.reload();
  await page.waitForFunction(id=>window.__PANEL_STATE__?.design().designId===id,d.designId);
  const saved=await page.evaluate(()=>window.__PANEL_STATE__.design());
  const ap=saved.modules.find(m=>m.id==='AP');
  assert.deepEqual(ap.rs485Meters,['W2','W1']);assert.equal(ap.rs485MetersLength,12);
  assert.deepEqual(saved.buses.find(b=>b.controllerModuleId==='AP').deviceModuleIds,['R1','GW','DLI']);
  await page.locator('[data-tab="assembly"]').click();
  await page.locator('[data-part="AP"]').click();
  await page.locator('[data-tab="wiring"]').click();
  const expected=[...['Y','Z','G'].map(p=>['AP:NET_'+p,p==='G'?'PS:DC-':'PS:NET_'+p]),
    ...[['PS','R1'],['R1','GW'],['GW','DLI']].flatMap(([a,b])=>
      [['24','DC+'],['Y','NET_Y'],['Z','NET_Z'],['G','DC-']].map(([pin,target])=>[a+':NET2_'+pin,b+':'+target])),
    ...[['TX','A'],['RTS','B'],['G','G']].map(([p,q])=>['AP:COM1_'+p,'W2:RS485_'+q]),
    ...['A','B','G'].map(p=>['W2:RS485_'+p,'W1:RS485_'+p])];
  for(const [from,to] of expected) assert.equal(await page.locator(`[data-schematic-from="${from}"][data-schematic-to="${to}"]`).isVisible(),true,from+' → '+to);
  await page.locator('[data-tab="assembly"]').click();
  await page.locator('[data-part="R1"]').click();
  await page.locator('[data-tab="wiring"]').click();
  assert.equal(await page.locator('#module-schematic [data-schematic-from="PS:NET2_24"][data-schematic-to="R1:DC+"]').count(),1);
  await page.locator('#all-wires').check();
  const screen=await page.locator('#pane [data-wire-from]').evaluateAll(rows=>rows.map(r=>[r.dataset.wireFrom,r.dataset.wireTo,r.cells[0].textContent.trim()].join('|')).sort());
  const download=page.waitForEvent('download');await page.locator('#wires-csv').click();
  await (await download).saveAs(dir+'/wiring.csv');
  const csv=csvRows(readFileSync(dir+'/wiring.csv','utf8'));
  assert.deepEqual(csv.map(w=>[w.from,w.to,w.conductor].join('|')).sort(),screen);
  await page.locator('[data-tab="assembly"]').click();
  if(await page.locator('#inspect-only.active').isVisible()) await page.locator('#inspect-only.active').click();
  await page.locator('#wire-mode').selectOption('all');
  await page.locator('[data-mode="front"]').click();
  await page.waitForFunction(()=>{const v=window.__PANEL_STATE__.studio();return v?.model?.layers.wires.visible&&!v.cameraTarget&&!v.options.isolate;});
  const drawn=await page.evaluate(()=>{
    const s=window.__PANEL_STATE__,net=s.net();
    const at=(v,p)=>['x','y','z'].every(k=>Math.abs(v[k]-p[k])<1e-5);
    return [...s.studio().model.wires.values()].filter(({edge})=>edge.rs485||edge.cresnet).map(({edge,mesh,curve})=>[
      edge.from,edge.to,mesh.visible&&at(curve.points[0],net.ports[edge.from])&&at(curve.points.at(-1),net.ports[edge.to])]);
  });
  assert.deepEqual(drawn.map(([a,b])=>[a,b].join('|')).sort(),expected.map(w=>w.join('|')).sort());
  assert.ok(drawn.every(w=>w[2]));
  await page.locator('#canvas').screenshot({path:dir+'/assembly.png'});
  await page.locator('#tab-documents').click();
  await page.locator('#v5-docs-none').click();
  const selection=page.locator('[data-doc^="wiring-table"]');await selection.first().waitFor();
  for(const box of await selection.all()) await box.check();
  await page.evaluate(()=>window.print=()=>{window.__SERIAL_PRINT__=true;});
  await page.locator('#v5-docs-print').click();await page.locator('#v5-export-current').click();
  await page.waitForFunction(()=>window.__SERIAL_PRINT__);
  assert.equal(await page.locator('#v5-print-root [data-layout-overflow="true"]').count(),0);
  await page.pdf({path:dir+'/wiring.pdf',preferCSSPageSize:true,printBackground:true});
  const pages=pdfPages(dir+'/wiring.pdf').filter(Boolean);
  assert.equal(pages.length,await selection.count());
  assert.equal(pages.join('').split('编号:').length-1,csv.length);
  for(const w of csv) assert.ok(pages.some(p=>p.includes(compact('从:'+w.fromTag+'到:'+w.toTag))),w.from+' → '+w.to);
  await page.locator('#v5-docs-zip').click();
  const zip=page.waitForEvent('download');await page.locator('#v5-export-current').click();await (await zip).saveAs(dir+'/handover.zip');
  const bundle=unzipSync(readFileSync(dir+'/handover.zip'));
  assert.deepEqual(Buffer.from(bundle['端子接线表.csv']),readFileSync(dir+'/wiring.csv'));
  writeFileSync(dir+'/standalone.html',bundle['方案-独立HTML.html']);
  const offline=await browser.newContext({offline:true});
  const opened=await offline.newPage();
  opened.on('pageerror',e=>errors.push(e.message));
  await opened.goto(pathToFileURL(dir+'/standalone.html').href);
  await opened.waitForFunction(id=>window.__PANEL_STATE__?.design().designId===id,d.designId);
  const offlineEdges=await opened.evaluate(()=>window.__PANEL_STATE__.net().wires.filter(w=>w.rs485||w.cresnet).map(w=>w.from+'|'+w.to).sort());
  assert.deepEqual(offlineEdges,expected.map(w=>w.join('|')).sort());
  await offline.close();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({mixedCresnet:15,rs485:6,allWires:csv.length,a4Pages:pages.length,dir}));
} finally {await browser.close();}
