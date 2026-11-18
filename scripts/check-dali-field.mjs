// Real module dialogs, persistence, 3D, wiring table, A4 PDF and handover ZIP.
// Start the Vite dev server and build the app before running.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {unzipSync,strFromU8} from 'fflate';
import {csvRows,pdfPages,compact} from './wiring-check-helpers.mjs';

const url=process.env.PANEL_URL || 'http://127.0.0.1:5173/';
const products=[
  ['abb-dg-s-1-64-5-1',1,160], ['abb-dg-s-2-64-5-1',2,160],
  ['crestron-din-dli',1,170], ['crestron-din-dali-2',2,150], ['crestron-din-dali-2',2,200,'EXT'],
  ['crestron-din-dali-2',2,240,'EXT-mixed'], ['lutron-lqse-2dal-d',2,128],
];
const rows=[
  {plus:'T1:1',minus:'T1:2',name:'前厅驱动器',devices:64,milliamps:128,section:0.5,meters:100},
  {plus:'T1:3',minus:'T1:4',name:'走道驱动器',devices:8,milliamps:16,section:1.5,meters:90},
];
const pair=w=>[w.from,w.to,w.conductor].join('|');
const keys=rows=>rows.map(pair).sort();
async function edit(page,id) {
  await page.locator('#manage-modules').click();
  await page.locator('[data-mod-edit="'+id+'"]').click();
}
async function save(page) {
  await page.locator('#mod-save').click();
  await page.locator('#modal').waitFor({state:'hidden'});
}

async function run(page,product,count,capacity,dir,mode) {
  const abb=product.startsWith('abb-'), crestron=product.startsWith('crestron-');
  const external=mode?.startsWith('EXT'), mixed=mode==='EXT-mixed';
  const fieldRows=rows.map((row,index)=>({...row,...(external&&!index?{milliamps:180}:{})}));
  const fixture=await page.evaluate(async({product,abb,crestron,mode})=>{
    const {createBreakerPackDesign}=await import('/src/data/design-templates.js');
    const d=createBreakerPackDesign({count:mode?.startsWith('EXT')?4:2,productId:'A9D32610',name:product+' DALI 现场出线'});
    d.designId='field-acceptance-'+product;
    d.uiMode='full'; d.includeSpd=false;
    d.revisions=[{at:'2026-11-19T01:00:00',summary:'DALI 现场出线验收',errors:0,pending:0}];
    d.modules=[{id:'GW1',productId:product,...(!crestron?{protectId:'C01'}:{})},
      {id:'T1',productId:'phoenix-pt25-gy-4'}];
    if(abb||crestron)d.modules.push({id:'PS1',productId:abb?'mdt-stc-0640-01':'crestron-din-pws50',protectId:'C02'});
    if(mode?.startsWith('EXT'))for(const i of [1,2])d.modules.push({id:'PS'+(i+1),
      productId:mode==='EXT-mixed'?['tridonic-dali-ps2','meanwell-dlp-04r'][i-1]:'lunatone-dali-ps-24033444',protectId:'C0'+(i+2)});
    return d;
  },{product,abb,crestron,mode});
  await page.locator('#file').setInputFiles({name:'dali.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  await page.waitForFunction(id=>window.__PANEL_STATE__?.design().designId===id,fixture.designId);
  if(abb||crestron) {
    await edit(page,'PS1');
    await page.locator('[data-psu-target="GW1"]').check();
    await save(page);
  }
  await edit(page,'GW1');
  assert.equal(await page.locator('[data-dali-line]').count(),count);
  if(external){
    await page.locator('#mod-dali-mode').selectOption('EXT');
    for(const i of [1,2])await page.locator('#mod-dali-supply-'+i).selectOption('PS'+(i+1));
  }
  const field=(i,key)=>page.locator('[data-dali-line="'+i+'"] [data-dali-field="'+key+'"]');
  for(let i=1;i<=count;i++) for(const [key,value] of Object.entries(fieldRows[i-1])) {
    const control=field(i,key);
    if(['plus','minus','section'].includes(key)) await control.selectOption(String(value));
    else await control.fill(String(value));
  }
  await field(1,'devices').fill('65');
  await page.locator('#mod-save').click();
  assert.ok(await field(1,'devices').isVisible());
  await field(1,'devices').fill('64');
  await save(page);
  if(mixed){
    const wired=()=>page.evaluate(()=>window.__PANEL_STATE__.net().wires.filter(w=>w.from.startsWith('PS2:')).map(w=>w.from));
    assert.deepEqual(await wired(),[]);
    await edit(page,'PS2');
    await page.locator('#mod-dali-positive-side').selectOption('right');
    await save(page);
    assert.deepEqual((await wired()).sort(),['PS2:DA_LEFT','PS2:DA_RIGHT']);
  }
  await page.reload();
  await page.waitForFunction(id=>window.__PANEL_STATE__?.design().designId===id,fixture.designId);
  await edit(page,'GW1');
  for(let i=1;i<=count;i++){
    for(const [key,value] of Object.entries(fieldRows[i-1])) assert.equal(await field(i,key).inputValue(),String(value));
    assert.ok((await page.locator('[data-dali-line="'+i+'"] [data-dali-rating]').innerText()).includes(capacity+' mA'));
  }
  if(abb && count===2){
    await page.setViewportSize({width:390,height:844});
    const box=page.locator('[data-dali-line="1"]');
    await box.scrollIntoViewIfNeeded();
    assert.ok(await box.evaluate(el=>el.getBoundingClientRect().left>=0 && el.getBoundingClientRect().right<=innerWidth && el.scrollWidth<=el.clientWidth+1));
    await box.screenshot({path:dir+'/editor-mobile.png'});
    await page.setViewportSize({width:1500,height:1050});
  }
  await page.locator('#close-modal').click();
  await page.locator('[data-tab="assembly"]').click();
  await page.locator('[data-part="GW1"]').click();
  await page.locator('[data-tab="wiring"]').click();
  const diagram=page.locator('#dali-schematic'), expected=[];
  for(let i=1;i<=count;i++) for(const [j,pin] of ['PLUS','MINUS'].entries()) {
    const unsigned=product.startsWith('lutron-'), sign=j?'-':'+', field=rows[i-1];
    const from='GW1:DALI'+i+'_'+(unsigned?(j?'RIGHT':'LEFT'):pin)+(crestron?'_2':''), to=j?field.minus:field.plus;
    expected.push({from,to,conductor:unsigned?'DA':'BUS'+sign});
    assert.ok(await diagram.locator('[data-schematic-from="'+from+'"][data-schematic-to="'+to+'"]').isVisible());
  }
  if(abb)for(const key of ['BUS+','BUS-','L_IN','N_IN'])assert.ok(await diagram.locator('[data-schematic-to="GW1:'+key+'"]').isVisible());
  if(external)for(const i of [1,2])for(const [sign,pin] of [['+','PLUS'],['-','MINUS']]){
    const from=mixed && i===1?(sign==='+'?'DA_RIGHT':'DA_LEFT'):'BUS'+sign;
    assert.ok(await diagram.locator('[data-schematic-from="PS'+(i+1)+':'+from+'"][data-schematic-to="GW1:DALI'+i+'_'+pin+'"]').isVisible());
  }
  await diagram.screenshot({path:dir+'/schematic.png'});
  await page.locator('#all-wires').check();
  const screen=await page.locator('#pane tr[data-wire-from]').evaluateAll(els=>els.map(el=>({
    from:el.dataset.wireFrom,to:el.dataset.wireTo,conductor:el.cells[0].textContent.trim(),
  })));
  const download=page.waitForEvent('download');
  await page.locator('#wires-csv').click();
  await(await download).saveAs(dir+'/wiring.csv');
  const direct=readFileSync(dir+'/wiring.csv'), csv=csvRows(direct.toString('utf8'));
  assert.deepEqual(keys(screen),keys(csv));
  assert.deepEqual(keys(csv.filter(w=>w.to.startsWith('T1:'))),keys(expected));
  if(mixed){
    for(const label of ['PS2.DA(左)','PS2.DA(右)','PS3.1-DA-','PS3.2-DA+'])assert.ok(csv.some(w=>w.fromTag===label),label);
    for(const label of ['PS2.L','PS2.N','PS3.4-AC/N','PS3.3-AC/L'])assert.ok(csv.some(w=>w.toTag===label),label);
  }
  for(const w of expected) assert.equal(csv.find(r=>pair(r)===pair(w)).state,'已连接');
  await page.locator('[data-tab="assembly"]').click();
  if(await page.locator('#inspect-only.active').isVisible())await page.locator('#inspect-only.active').click();
  await page.locator('#wire-mode').selectOption('all');
  await page.locator('[data-mode="front"]').click();
  await page.waitForFunction(()=>{const v=window.__PANEL_STATE__.studio();return v?.model?.layers.wires.visible && !v.cameraTarget && !v.options.isolate;});
  const geometry=await page.evaluate(mixed=>{
    const studio=window.__PANEL_STATE__.studio(), net=window.__PANEL_STATE__.net();
    const at=(v,p)=>['x','y','z'].every(axis=>Math.abs(v[axis]-p[axis])<1e-5);
    return [...studio.model.wires.values()].filter(({edge})=>edge.daliField || mixed && [edge.from,edge.to].some(p=>/^PS[23]:/u.test(p))).map(({edge,curve,mesh})=>({
      from:edge.from,to:edge.to,conductor:edge.conductor,ok:mesh.visible&&at(curve.points[0],net.ports[edge.from])&&at(curve.points.at(-1),net.ports[edge.to]),
    }));
  },mixed);
  const selected=[...expected,...(mixed?csv.filter(w=>[w.from,w.to].some(p=>/^PS[23]:/u.test(p))):[])];
  assert.deepEqual(keys(geometry),keys(selected));
  assert.ok(geometry.every(w=>w.ok));
  await page.locator('#canvas').screenshot({path:dir+'/assembly.png'});
  await page.locator('#tab-documents').click();
  await page.locator('#v5-docs-none').click();
  const selection=page.locator('[data-doc^="wiring-table"]');
  await selection.first().waitFor();
  for(const box of await selection.all())await box.check();
  await page.evaluate(()=>{window.print=()=>{window.__FIELD_PRINT__=true;};});
  await page.locator('#v5-docs-print').click();
  await page.locator('#v5-export-current').click();
  await page.waitForFunction(()=>window.__FIELD_PRINT__);
  assert.equal(await page.locator('#v5-print-root [data-layout-overflow="true"]').count(),0);
  await page.pdf({path:dir+'/wiring.pdf',preferCSSPageSize:true,printBackground:true});
  const pages=pdfPages(dir+'/wiring.pdf').filter(Boolean);
  assert.equal(pages.length,await selection.count());
  assert.equal(pages.join('').split('编号:').length-1,csv.length);
  for(const w of csv)assert.ok(pages.some(text=>text.includes(compact('从:'+w.fromTag+'到:'+w.toTag))),w.fromTag+' → '+w.toTag);
  const sample=pages.findIndex(p=>p.includes(compact(rows[0].name)))+1;
  assert.ok(sample);
  assert.ok(pages.some(p=>p.includes(compact(fieldRows[0].milliamps+' / '+capacity+' mA'))));
  execFileSync('pdftoppm',['-f',String(sample),'-l',String(sample),'-r','90','-png','-singlefile',dir+'/wiring.pdf',dir+'/wiring-page']);
  await page.locator('#v5-docs-zip').click();
  const zipped=page.waitForEvent('download');
  await page.locator('#v5-export-current').click();
  await(await zipped).saveAs(dir+'/handover.zip');
  const files=unzipSync(readFileSync(dir+'/handover.zip'));
  assert.ok(direct.equals(Buffer.from(files['端子接线表.csv'])));
  const saved=JSON.parse(strFromU8(files['方案.json'])).modules.find(m=>m.id==='GW1');
  for(let i=1;i<=count;i++)assert.deepEqual(saved.daliFieldLoops[i],fieldRows[i-1]);
  if(external)assert.equal(saved.daliPowerMode,'EXT');
  console.log(JSON.stringify({product,fieldWires:expected.length,allWires:csv.length,a4Pages:pages.length,dir}));
}

const browser=await chromium.launch({channel:process.env.PDF_BROWSER||'chrome',headless:true});
try {
  for(const [product,count,capacity,mode] of products.filter(([p,,,m])=>!process.argv[2]||(p+(m||'')).includes(process.argv[2]))) {
    const dir='.playwright-cli/dali-field/'+product+(mode?'-'+mode.toLowerCase():'');mkdirSync(dir,{recursive:true});
    const context=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true});
    const hmr=new URL(url);hmr.protocol=hmr.protocol==='https:'?'wss:':'ws:';
    await context.routeWebSocket(u=>u.origin===hmr.origin&&u.pathname===hmr.pathname,()=>{});
    const page=await context.newPage(), errors=[];
    context.setDefaultTimeout(20_000);
    page.on('pageerror',err=>{errors.push(err.message);console.error(err.message);});
    try {
      await page.goto(url);
      await page.waitForFunction(()=>window.__PANEL_STATE__);
      await run(page,product,count,capacity,dir,mode);
      assert.deepEqual(errors,[]);
    } catch(error) {
      console.error(product,await page.locator('#toast').textContent({timeout:500}).catch(()=>''));
      throw error;
    } finally {await context.close();}
  }
} finally {await browser.close();}
