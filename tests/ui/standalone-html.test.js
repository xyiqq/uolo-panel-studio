// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { createStandaloneHtml } from '../../src/ui/standalone-html.js';
const bundle = '<html><head><style>body{color:red}</style><script type="module">window.boot = true</script></head><body><div id="app"></div><script id="embedded-design" type="application/json">null</script></body></html>';
afterEach(()=>vi.unstubAllGlobals());
it('exports production inline without network, clears runtime and escapes embedded closing tags',async()=>{
  document.documentElement.innerHTML=bundle;
  document.querySelector('#app').innerHTML='<h1>runtime</h1>';
  document.head.insertAdjacentHTML('beforeend','<style id="v5-bridge-css">runtime</style>');
  document.body.insertAdjacentHTML('beforeend','<div id="v5-print-root">old</div><dialog id="v5-dialog">old</dialog>');
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const html=await createStandaloneHtml({name:'</script><img src=x>'});
  expect(fetch).not.toHaveBeenCalled();
  expect(html).not.toContain('runtime');expect(html).not.toContain('v5-dialog');
  const parsed=new DOMParser().parseFromString(html,'text/html');
  expect(JSON.parse(parsed.querySelector('#embedded-design').textContent).name).toBe('</script><img src=x>');
  expect(parsed.querySelector('img')).toBeNull();
});
it('fetches development build with a design snapshot captured before awaiting',async()=>{
  document.documentElement.innerHTML='<head><script src="/src/main.js"></script></head><body></body>';
  let resolve;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>resolve=r)));
  const design={name:'before'},pending=createStandaloneHtml(design);design.name='after';
  resolve({ok:true,text:async()=>bundle});
  expect(await pending).toContain('before');
});
it.each([bundle.replace('window.boot = true',''),bundle.replace('<style>', '<link href="/style.css"><style>'),'<html>missing</html>'])('rejects incomplete or external templates',async template=>{
  document.documentElement.innerHTML='<script src="/src/main.js"></script>';
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,text:async()=>template})));
  await expect(createStandaloneHtml({})).rejects.toThrow('模板无效');
});
