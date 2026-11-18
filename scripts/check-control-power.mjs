import {mkdirSync} from 'node:fs';
mkdirSync('.playwright-cli',{recursive:true});
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1500,height:1100}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:5173');await p.waitForFunction(()=>window.__PANEL_STATE__);
await p.evaluate(async()=>{
  const {createBreakerPackDesign}=await import('/src/data/design-templates.js');
  const d=createBreakerPackDesign({count:2,productId:'A9D32610'});
  d.uiMode='simple';d.buses=[];d.modules=[
    {id:'PS1',productId:'meanwell-hdr-100-24n'},{id:'PS2',productId:'meanwell-dlp-04r'},
    {id:'K1',productId:'crestron-din-8sw8-i',feed:'perChannel',channels:{1:'C01'}},
    {id:'D1',productId:'crestron-din-1dim4',feed:'shared',feedCircuitId:'C02',channels:{1:'C02'}},
    {id:'GW1',productId:'crestron-din-dli'}];
  Object.assign(window.__PANEL_STATE__.design(),d);window.__PANEL_STATE__.recompute();
});
async function edit(id){await p.locator('#manage-modules').click();await p.locator(`[data-mod-edit="${id}"]`).click();}
await edit('PS1');for(const id of ['K1','D1','GW1']){assert.equal(await p.locator(`[data-psu-target="${id}"]`).isDisabled(),false);await p.locator(`[data-psu-target="${id}"]`).check();}
await p.locator('#mod-psu-output').screenshot({path:'.playwright-cli/verified-24v-selector.png'});await p.locator('#mod-save').click();
const result=await p.evaluate(async()=>{const s=window.__PANEL_STATE__,d=s.design(),n=s.net();const {buildDeliveryNet}=await import('/src/core/delivery-net.js');const {renderWiringTable}=await import('/src/view/documents/wiring-table.js');const delivery=buildDeliveryNet(d,s.assembly(),n);return {dc:n.wires.filter(w=>w.class==='dc').map(w=>({from:w.from,to:w.to,scope:w.scope})),loads:n.wires.filter(w=>w.moduleFeed).map(w=>({from:w.from,to:w.to})),deliveryDc:delivery.wires.filter(w=>w.class==='dc').length,table:renderWiringTable({net:delivery})};});
assert.equal(result.dc.length,6);assert.equal(result.deliveryDc,6);assert.match(result.table,/24V 模块控制供电/);assert.match(result.table,/非零线 N/);
assert.ok(result.loads.some(w=>w.from==='C01:L1_OUT'&&w.to==='K1:CH1_IN'));assert.ok(result.loads.some(w=>w.to==='D1:N_IN'));assert.ok(!result.loads.some(w=>w.to.startsWith('GW1:')));
await edit('K1');assert.match(await p.locator('#mod-power-description').innerText(),/24V/);assert.equal(await p.locator('[data-mod-ch="1"]').inputValue(),'C01');await p.locator('#mod-save').click();
await edit('GW1');assert.equal(await p.locator('#mod-protect').count(),0);await p.locator('#mod-save').click();
await edit('PS2');assert.equal(await p.locator('[data-psu-target="GW1"]').isDisabled(),true);assert.match(await p.locator('#mod-psu-output').innerText(),/不可外接/);await p.locator('#mod-save').click();
await p.reload();await p.waitForFunction(()=>window.__PANEL_STATE__);assert.equal(await p.evaluate(()=>window.__PANEL_STATE__.net().wires.filter(w=>w.class==='dc').length),6);
assert.deepEqual(errors,[]);delete result.table;console.log(JSON.stringify({status:'PASS',...result,errors},null,2));await b.close();
