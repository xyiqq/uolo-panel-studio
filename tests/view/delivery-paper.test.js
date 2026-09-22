import { describe, it, expect } from 'vitest';
import { normalizeLabelSheet } from '../../src/core/labels.js';
import { renderLabelPaperPages } from '../../src/view/documents/labels-sheet.js';
import { setSignoff, addRevision } from '../../src/core/revisions.js';
import { createDefaultDesign, buildAssembly, buildWiring } from '../../src/core/domain.js';
import { buildDocumentPack } from '../../src/view/documents/index.js';
import { buildHandoverFiles } from '../../src/core/handover.js';

describe('交付纸张与版本', () => {
  it.each([['a4-30',30],['a4-48',48]])('%s physical dimensions fill A4 without overflow', (preset,capacity) => {
    const s=normalizeLabelSheet({preset});
    expect(s.capacity).toBe(capacity);
    expect(s.columns*s.widthMm+(s.columns-1)*s.gapX+s.marginLeft+s.marginRight).toBeCloseTo(210);
    expect(s.rows*s.heightMm+(s.rows-1)*s.gapY+s.marginTop+s.marginBottom).toBeCloseTo(297);
    const pages=renderLabelPaperPages({design:{labelSheet:{preset},circuits:Array.from({length:capacity+1},(_,i)=>({id:`C${i}`,name:'<灯>'}))}});
    expect(pages).toHaveLength(2);
    expect(pages[0].pageSize).toBe('A4-labels');
    expect((pages[1].html.match(/class="paper-label"/g)||[]).length).toBe(capacity);
    expect(pages[0].html).toContain('&lt;灯&gt;');
  });
  it('rejects impossible paper margins and invalid signature dates',()=>{
    expect(()=>normalizeLabelSheet({preset:'custom',marginLeft:210})).toThrow();
    const d={};
    setSignoff(d,'reviewer',{name:'李工',at:'2026-09-20',note:'复核完成'});
    expect(d.signoff.reviewer).toEqual({name:'李工',at:'2026-09-20',note:'复核完成'});
    expect(()=>setSignoff(d,'reviewer',{name:'李工',at:'2026-02-30'})).toThrow();
    expect(d.signoff.reviewer.at).toBe('2026-09-20');
  });
  it('uses configured circuit text and flags text that cannot fit instead of silently clipping',()=>{
    const design={labelSheet:{preset:'a4-48'},circuits:[{id:'C1',name:'灯'}]};
    const normal=renderLabelPaperPages({design,labels:{circuitLabel:()=> '定制标签'}});
    expect(normal[0].html).toContain('定制标签');
    const overflow=renderLabelPaperPages({design,labels:{circuitLabel:()=> '很长的标签'.repeat(100)}});
    expect(overflow[0].html).toContain('paper-label-overflow');
    expect(overflow[0].html).toContain('请扩大格子或缩短标签');
    expect(overflow[0].html).not.toContain('overflow:hidden');
  });
  it('exports the same revision in cover, drawings, BOM and manifest and rejects stale pages',()=>{
    const design=createDefaultDesign();
    addRevision(design,'首次交付',{},'2026-09-22T12:00');
    const assembly=buildAssembly(design),net=buildWiring(design,assembly);
    const pack=buildDocumentPack({design,assembly,net});
    const files=buildHandoverFiles({design,net,pages:pack.pages,documentCss:'body{color:black}'});
    expect(JSON.parse(files['交付清单.json']).revision).toBe('Rev 1');
    expect(files['物料清单.csv']).toContain('Rev 1');
    expect(pack.pages.find(p=>p.id==='cover').html).toContain('首次交付');
    expect(pack.pages.find(p=>p.id.startsWith('system-diagram-')).svg).toContain('Rev 1');
    expect(Object.values(files).some(value=>value.includes('<style>body{color:black}</style>'))).toBe(true);
    addRevision(design,'修改后',{},'2026-09-22T13:00');
    expect(()=>buildHandoverFiles({design,net,pages:pack.pages})).toThrow('文档版本已过期');
  });
});
