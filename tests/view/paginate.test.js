// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {paginateDocumentPages} from '../../src/view/documents/paginate.js';

const meta={name:'测试方案 <A&B>',revision:'R2'};
const article=(rows)=>`<article class="doc-page"><h2>回路表</h2><div class="doc-body"><table><thead><tr><th>回路</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r}</td></tr>`).join('')}</tbody></table></div><footer class="doc-version">旧页脚</footer></article>`;

afterEach(()=>vi.restoreAllMocks());

it('SVG 页包装为 A4 并编号，标签纸页保持原样，页脚文字转义',()=>{
  const pages=paginateDocumentPages([{id:'sys',title:'系统图',svg:'<svg></svg>'},{id:'labels-sheet',title:'标签',html:'<div>标签</div>',pageSize:'A4-labels'}],meta);
  expect(pages[0].pageSize).toBe('A4');
  expect(pages[0].html).toContain('<span class="doc-page-number">第 1 / 2 页</span>');
  expect(pages[0].html).toContain('测试方案 &lt;A&amp;B&gt;');
  expect(pages[1].html).toBe('<div>标签</div>');
});

it('多篇文章拆成独立页，续页编号并替换旧页脚',()=>{
  const pages=paginateDocumentPages([{id:'bom',title:'物料',html:article(['C1'])+article(['C2']),pageSize:'A4'}],meta);
  expect(pages.map(p=>p.id)).toEqual(['bom','bom--2']);
  expect(pages[1].title).toBe('物料 · 续 2');
  expect(pages.every(p=>!p.html.includes('旧页脚'))).toBe(true);
  expect(pages[1].html).toContain('第 2 / 2 页');
});

it('内容超出页高时按表格行拆页并在续页重复表头',()=>{
  const proto=HTMLElement.prototype;
  vi.spyOn(proto,'clientHeight','get').mockImplementation(function(){return this.classList?.contains('doc-body')?100:0;});
  vi.spyOn(proto,'scrollHeight','get').mockImplementation(function(){return this.querySelectorAll('tbody > tr').length*40;});
  const pages=paginateDocumentPages([{id:'bom',title:'物料',html:article(['C1','C2','C3','C4','C5']),pageSize:'A4'}],meta);
  expect(pages.length).toBe(3);
  expect(pages.map(p=>(p.html.match(/<tr><td>/g)||[]).length)).toEqual([2,2,1]);
  expect(pages.every(p=>p.html.includes('<th>回路</th>')&&p.html.includes('<h2>回路表</h2>'))).toBe(true);
  expect(pages[2].html).toContain('第 3 / 3 页');
});
