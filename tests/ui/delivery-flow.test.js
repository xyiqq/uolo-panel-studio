// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {createBreakerPackDesign} from '../../src/data/design-templates.js';
import {buildAssembly,buildWiring} from '../../src/core/domain.js';
const handover=vi.hoisted(()=>({last:null}));
vi.mock('../../src/core/handover.js',async load=>{
  const actual=await load();return {...actual,buildHandoverFiles:ctx=>{handover.last=ctx;return actual.buildHandoverFiles(ctx);}};
});

let design,api;
const $=s=>document.querySelector(s);
beforeEach(async()=>{
  vi.resetModules();vi.useFakeTimers();
  handover.last=null;
  document.head.innerHTML='';
  document.body.innerHTML='<nav class="nav"><button data-tab="assembly">装配</button></nav><aside class="left"><div class="side-section"></div></aside><div class="canvas-wrap"><div id="canvas"></div></div>';
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  HTMLDialogElement.prototype.close=function(){this.open=false;};
  design=createBreakerPackDesign({count:2});design.spareRatio=.4;
  const assembly=buildAssembly(design),net=buildWiring(design,assembly);
  api={getDesign:()=>design,getAssembly:()=>assembly,getNet:()=>net,getIssues:()=>[],persist:vi.fn(),toast:vi.fn()};
  const {mountV5Bridge}=await import('../../src/ui/v5-bridge.js');
  mountV5Bridge(api);$('#tab-documents').click();
});

it('ZIP 等待离线HTML时活动方案的修改不混入已收集的交付快照',async()=>{
  design.revisions=[{at:'2026-09-22',summary:'首次交付',errors:0,pending:0}];
  const originalName=design.name;
  let release;
  api.standaloneHtml=vi.fn(snapshot=>new Promise(resolve=>{release=()=>resolve(JSON.stringify(snapshot));}));
  $('#v5-docs-zip').click();$('#v5-export-current').click();await Promise.resolve();
  expect(api.standaloneHtml).toHaveBeenCalledOnce();
  design.name='导出过程中修改的名称';design.revisions.push({at:'2026-09-23',summary:'下一版'});
  release();await Promise.resolve();await Promise.resolve();
  expect(handover.last.design.name).toBe(originalName);
  expect(handover.last.design.revisions).toHaveLength(1);
  expect(JSON.parse(handover.last.standaloneHtml).name).toBe(originalName);
  expect(handover.last.pages.find(p=>p.id==='cover').html).not.toContain('导出过程中修改的名称');
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});

it('保留方案备用比例，应用重绘刷新空间面板但不覆盖保存的数据',async()=>{
  expect($('#v5-spare').value).toBe('40');
  design.spareRatio=.1;
  const {mountV5Bridge}=await import('../../src/ui/v5-bridge.js');mountV5Bridge(api);
  expect(design.spareRatio).toBe(.1);expect($('#v5-spare').value).toBe('10');
  $('#v5-spare').value='30';$('#v5-spare').dispatchEvent(new Event('input'));
  expect(design.spareRatio).toBe(.3);expect(api.persist).toHaveBeenCalled();
});

it('标签预设、自定义参数与在线基址校验通过实际设置对话框保存',()=>{
  $('#v5-docs-settings').click();
  $('#v5-label-preset').value='a4-48';$('#v5-label-preset').dispatchEvent(new Event('change'));
  $('#v5-t-save').click();
  expect(design.labelSheet.capacity).toBe(48);
  expect($('.paper-label-grid').children).toHaveLength(48);
  $('#v5-docs-settings').click();
  $('#v5-label-preset').value='custom';$('#v5-label-preset').dispatchEvent(new Event('change'));
  $('#v5-label-marginLeft').value='209';$('#v5-t-save').click();
  expect($('#v5-settings-error').textContent).toMatch(/边距/);
  expect(design.labelSheet.preset).toBe('a4-48');
  $('#v5-label-marginLeft').value='8';$('#v5-t-qrmode').value='online';$('#v5-t-base').value='javascript:alert(1)';$('#v5-t-save').click();
  expect($('#v5-dialog').open).toBe(true);
  $('#v5-t-base').value='https://example.com/studio';$('#v5-t-save').click();
  expect(design.qrProjectUrl).toBe('https://example.com/studio');expect(design.labelSheet.marginLeft).toBe(8);
});

it('签认日期备注保存重开保留，导出取消不新增修订，打印与封面同版本',async()=>{
  $('#v5-docs-signoff').click();
  $('#v5-sign-designer').value='张工';$('#v5-sign-date-designer').value='2026-09-20';$('#v5-sign-note-designer').value='现场复核';$('#v5-sign-save').click();
  expect(design.signoff.designer).toEqual({name:'张工',at:'2026-09-20',note:'现场复核'});
  $('#v5-docs-signoff').click();expect($('#v5-sign-note-designer').value).toBe('现场复核');$('#v5-sign-cancel').click();
  window.print=vi.fn();$('#v5-docs-print').click();$('#v5-export-cancel').click();
  expect(design.revisions||[]).toHaveLength(0);expect(window.print).not.toHaveBeenCalled();
  $('#v5-docs-print').click();$('#v5-export-new').click();expect($('#v5-export-error').textContent).toContain('摘要');
  $('#v5-export-summary').value='首次交付';$('#v5-export-date').value='2026-09-22';$('#v5-export-new').click();
  await Promise.resolve();expect(window.print).toHaveBeenCalledOnce();
  expect(design.revisions).toHaveLength(1);expect($('#v5-print-root').textContent).toContain('Rev 1');expect($('#v5-print-root').textContent).toContain('首次交付');
  window.dispatchEvent(new Event('afterprint'));expect($('#v5-print-root').innerHTML).toBe('');
});
