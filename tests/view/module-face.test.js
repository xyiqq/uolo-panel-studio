import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { allProducts } from '../../src/core/domain.js';
import { moduleFaceScene, moduleFaceSvg, moduleFaceSize, faceTextureSize } from '../../src/view/module-face.js';
import { DIN_SIZE_TEMPLATES, CUSTOM_KIND_OPTIONS } from '../../src/data/products/custom-templates.js';

describe('装配模块矢量面板', () => {
  const products = [...allProducts({}), ...DIN_SIZE_TEMPLATES.flatMap(t => CUSTOM_KIND_OPTIONS.map(([kind]) => ({ ...t, kind, brand:'自定义品牌', sku:'CUSTOM-LONG-MODEL-0123456789', channels:24 })))];
  it('覆盖所有目录和自定义尺寸，SVG 合法且几何不越界', () => {
    for (const product of products) {
      const { width, height } = moduleFaceSize(product, ['mcb','rcbo','rccb','spd'].includes(product.kind));
      const s = moduleFaceScene(product,width,height);
      const doc = new JSDOM(moduleFaceSvg(product,width,height), { contentType:'image/svg+xml' }).window.document;
      expect(doc.querySelector('parsererror')).toBeNull();
      for (const a of s.shapes) {
        for (const value of Object.values(a)) if(typeof value==='number') expect(Number.isFinite(value)).toBe(true);
        if(a.tag==='rect') { expect(a.width).toBeGreaterThan(0); expect(a.height).toBeGreaterThan(0); expect(a.x).toBeGreaterThanOrEqual(0); expect(a.x+a.width).toBeLessThanOrEqual(s.w+0.01); expect(a.y+a.height).toBeLessThanOrEqual(s.h); }
      }
      const tex=faceTextureSize(width,height);
      expect(Math.abs(tex.width/tex.height-width/height)).toBeLessThan(0.02);
    }
  });
  it('端子排的各节连续贴合，不保留人为间隙', () => {
    const scene = moduleFaceScene({ kind: 'terminal', poles: 4, terminalColor: 'blue' });
    const cells = scene.shapes.filter((x) => x.tag === 'rect' && x.y === 110 && x.height === 139);
    expect(cells).toHaveLength(4);
    for (let i = 1; i < cells.length; i++) expect(cells[i].x).toBeCloseTo(cells[i - 1].x + cells[i - 1].width, 8);
  });
  it('保留24通道；未知通道数不虚构四路输出', () => {
    const texts=p=>moduleFaceScene(p).shapes.filter(x=>x.tag==='text').map(x=>x.text);
    expect(texts({kind:'relay',channels:24})).toContain('CH 24');
    expect(texts({kind:'gateway'}).some(t=>/^CH /.test(t))).toBe(false);
    expect(texts({kind:'gateway',protocol:['dali'],channels:2})).toContain('BUS 2');
    expect(moduleFaceSvg({kind:'meter'})).not.toContain('0.00');
  });
  it('自定义文字和颜色不能注入SVG，保护器不借用其他厂家额定', () => {
    const svg=moduleFaceSvg({brand:'<script>alert(1)</script>',name:'" onload="bad',color:'red" onload="bad',kind:'spd'});
    const doc=new JSDOM(svg,{contentType:'image/svg+xml'}).window.document;
    expect(doc.querySelector('script,[onload]')).toBeNull();
    expect(svg).not.toContain('iPRD40');
    expect(svg).not.toContain('Type 2');
  });
});
