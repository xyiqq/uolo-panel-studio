/** Build an offline document from a bundled template, never from Vite's network-dependent shell. */
export async function createStandaloneHtml(design) {
  const snapshot = JSON.stringify(design).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  let template = document.documentElement.cloneNode(true);
  if (template.querySelector('script[src],link[href]')) {
    let response;
    try { response = await fetch('/__offline-template', { cache: 'no-store' }); }
    catch { throw new Error('离线 HTML 模板不可用，请先运行 npm run build 后重试'); }
    if (!response.ok) throw new Error('离线 HTML 模板不可用，请先运行 npm run build 后重试');
    template = new DOMParser().parseFromString(await response.text(), 'text/html').documentElement;
  }
  const app = template.querySelector('#app');
  const embedded = template.querySelector('script#embedded-design[type="application/json"]');
  const bundle = [...template.querySelectorAll('script:not([src])')].some(script => script.id !== 'embedded-design' && (!script.type || script.type === 'module' || script.type === 'text/javascript') && script.textContent.trim());
  if (!app || !embedded || !bundle || template.querySelector('script[src],link[href]')) {
    throw new Error('离线 HTML 模板无效或仍依赖外部脚本，请重新运行 npm run build');
  }
  app.replaceChildren();
  for (const node of template.querySelectorAll('#v5-print-root,#v5-dialog,#v5-bridge-css,#print,dialog')) node.remove();
  for (const node of [...template.querySelector('body').children]) {
    if (node !== app && node !== embedded && node.tagName !== 'SCRIPT') node.remove();
  }
  embedded.textContent = snapshot;
  return '<!doctype html>\n' + template.outerHTML;
}
