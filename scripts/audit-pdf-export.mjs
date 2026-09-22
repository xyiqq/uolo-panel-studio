import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const out='.playwright-cli/pdf-audit';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.PDF_BROWSER||'chrome',headless:true});
const results=[];
try {
 for(const fixture of ['blank','full','network']) {
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  const design=await page.evaluate(async name=>{
    const {createDefaultDesign}=await import('/src/core/domain.js');
    const {createBlankDesign,createBreakerPackDesign}=await import('/src/data/design-templates.js');
    const d=name==='full'?createDefaultDesign():name==='blank'?createBlankDesign():createBreakerPackDesign({count:8});
    d.uiMode='full';d.name={blank:'空白方案 · 文档检查',full:'全屋配电方案 · 交付样张',network:'网络与照明控制 · 交付样张'}[name];
    d.revisions=[{at:'2026-09-22',summary:'排版与易读性验收',errors:0,pending:0}];
    if(name==='network') {
      d.modules=[{id:'GW1',productId:'reyee-rg-es108gd',displayName:'一层交换机',switchPortLabels:{1:'客厅无线接入点',2:'192.168.1.123'}},{id:'K1',productId:'crestron-din-8sw8-i',channels:{1:d.circuits[0].id},channelLabels:{1:'客厅主灯'}},{id:'XT1',productId:'phoenix-pt25-gy-4',terminalConnections:{1:{loadName:'客厅灯具',output:'K1:CH1_OUT',wireNo:'WL001',section:1.5}}}];
      d.labelRules={qrMode:'online'};d.qrProjectUrl='https://example.com/projects/demo';
    }
    return d;
  },fixture);
  await page.locator('#file').setInputFiles({name:'audit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(design))});
  await page.waitForFunction(n=>window.__PANEL_STATE__?.design().name===n,design.name);
  await page.locator('#tab-documents').click();await page.locator('#v5-docs-all').click();
  await page.locator('#v5-docs-zoom').selectOption('1');
  const report=await page.locator('#v5-docs-preview .v5-doc-sheet').evaluateAll(sheets=>sheets.map(sheet=>{
    const article=sheet.querySelector('article'),body=article?.querySelector('.doc-body'),rect=sheet.getBoundingClientRect();
    const outside=[...sheet.querySelectorAll('td,th,p,h1,h2,h3,figure')].filter(el=>{
      const box=el.getBoundingClientRect();return box.width>0&&(box.right>rect.right+1||box.left<rect.left-1||box.bottom>rect.bottom+1);
    }).map(el=>el.textContent.slice(0,60));
    return {id:sheet.dataset.page,size:sheet.dataset.size,bodyHeight:body?.clientHeight,bodyScroll:body?.scrollHeight,overflow:article?.dataset.layoutOverflow||null,outside,textLength:sheet.textContent.length};
  }));
  const bad=report.filter(p=>p.overflow||p.outside.length||p.size!=='A4');
  fs.writeFileSync(`${out}/${fixture}-layout.json`,JSON.stringify(report,null,2));
  if(bad.length)console.log('LAYOUT',fixture,JSON.stringify(bad));
  // Use the real print action and current revision; disable only the native dialog.
  await page.evaluate(()=>window.print=()=>{});
  await page.locator('#v5-docs-print').click();
  if(await page.locator('#v5-export-current').isVisible())await page.locator('#v5-export-current').click();
  else throw Error(`${fixture}: export was blocked: ${await page.locator('.toast').textContent()}`);
  await page.waitForSelector('#v5-print-root .print-sheet',{state:'attached'});
  const printedPages=await page.locator('#v5-print-root .print-sheet').count();
  assert.equal(printedPages,report.length,'Preview and print must paginate identically');
  await page.pdf({path:`${out}/${fixture}.pdf`,preferCSSPageSize:true,printBackground:true});
  const info=execFileSync('pdfinfo',['-f','1','-l',String(printedPages),`${out}/${fixture}.pdf`],{encoding:'utf8'});
  const actualPages=Number(info.match(/Pages:\s+(\d+)/)?.[1]);
  assert.equal(actualPages,printedPages,'Each preview sheet must print as one PDF page');
  const sizes=[...info.matchAll(/Page\s+\d+ size:\s+([\d.]+) x ([\d.]+)/g)];
  assert.equal(sizes.length,printedPages);
  assert.ok(sizes.every(m=>Math.abs(Number(m[1])-595)<2&&Math.abs(Number(m[2])-842)<2),'Every PDF page must be A4 portrait');
  results.push({fixture,previewPages:report.length,printedPages,bad,errors});
  await page.close();
 }
} finally {await browser.close();}
fs.writeFileSync(`${out}/summary.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
assert.ok(results.every(r=>!r.bad.length&&!r.errors.length),'PDF layout has overflow or script errors');
