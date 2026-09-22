// Run after the browser acceptance ZIP has been saved by accept-delivery.cjs.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {unzipSync,strFromU8} from 'fflate';
import assert from 'node:assert/strict';

const dir='.playwright-cli';
const files=unzipSync(fs.readFileSync(`${dir}/acceptance-delivery.zip`));
const manifest=JSON.parse(strFromU8(files['交付清单.json']));
const design=JSON.parse(strFromU8(files['方案.json']));
assert.equal(manifest.revision,`Rev ${design.revisions.length}`);
assert.ok(strFromU8(files['物料清单.csv']).includes(manifest.revision));
const html=strFromU8(files['方案-独立HTML.html']);
assert.ok(!/<script[^>]+src=/.test(html));
fs.writeFileSync(`${dir}/acceptance-offline.html`,html);
const results=[];
for(const channel of ['chrome','msedge']) {
  const browser=await chromium.launch({channel,headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1280,height:1000}});
    await context.setOffline(true);
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(`${process.cwd()}/${dir}/acceptance-offline.html`).href);
    await page.waitForFunction(()=>window.__PANEL_STATE__?.design().name==='交付验收方案');
    await page.locator('#tab-documents').click();
    for(const preset of ['a4-30','a4-48','custom']) {
      await page.locator('#v5-docs-settings').click();
      await page.locator('#v5-label-preset').selectOption(preset);
      if(preset==='custom') {await page.locator('#v5-label-rows').fill('5');await page.locator('#v5-label-columns').fill('2');}
      await page.locator('#v5-t-save').click();
      await page.locator('#v5-docs-none').click();await page.locator('[data-doc="labels-sheet"]').check();
      await page.evaluate(()=>window.print=()=>{});
      await page.locator('#v5-docs-print').click();await page.locator('#v5-export-current').click();
      await page.waitForSelector('#v5-print-root .paper-label-grid',{state:'attached'});
      await page.emulateMedia({media:'print'});
      const paper=await page.locator('#v5-print-root .doc-labels-sheet--paper').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,cells:el.querySelectorAll('.paper-label').length}));
      assert.ok(Math.abs(paper.width/96*25.4-210)<.1);assert.ok(Math.abs(paper.height/96*25.4-297)<.1);
      const pdf=await page.pdf({path:`${dir}/acceptance-${channel}-${preset}.pdf`,preferCSSPageSize:true,printBackground:true});
      const raw=pdf.toString('latin1'),boxes=raw.match(/\/MediaBox\s*\[[^\]]+\]/g);
      assert.equal((raw.match(/\/Type\s*\/Page\b/g)||[]).length,1);
      assert.ok(boxes[0].includes('594.95996 841.91998'));
      results.push({channel,preset,paper,pdfPages:1,mediaBox:boxes[0]});
      await page.emulateMedia({media:'screen'});
    }
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
}
fs.writeFileSync(`${dir}/delivery-verification.json`,JSON.stringify({revision:manifest.revision,zipFiles:Object.keys(files).length,offline:true,results},null,2));
console.log(JSON.stringify({revision:manifest.revision,zipFiles:Object.keys(files).length,offline:true,results}));
