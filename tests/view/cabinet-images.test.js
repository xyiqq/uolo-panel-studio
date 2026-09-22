import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { isDocumentImage, renderCabinetImage, renderSitePhoto } from '../../src/view/documents/cabinet-images.js';
import { buildDocumentPack } from '../../src/view/documents/index.js';
import { createDefaultDesign, buildAssembly, buildWiring } from '../../src/core/domain.js';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';

describe('配电箱图片交付页', () => {
  it.each(['png', 'jpeg', 'webp'])('accepts embedded %s raster images', type => {
    expect(isDocumentImage(`data:image/${type};base64,YWJj`)).toBe(true);
  });
  it.each(['https://example.com/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,', 'data:image/png;base64,abc" onerror="alert(1)', null])('rejects unsafe or empty image content: %s', value => {
    expect(isDocumentImage(value)).toBe(false);
    expect(renderSitePhoto({ design: { sitePhoto: { dataUrl: value } } })).toBe('');
    expect(renderCabinetImage({ cabinetImage: value })).toContain('暂无三维配电箱图');
  });
  it('escapes uploaded filenames and separates scheme render from site records', () => {
    const photo = new JSDOM(renderSitePhoto({ design: { sitePhoto: { dataUrl: image, name: '<img src=x onerror=alert(1)>.jpg' } } })).window.document;
    expect(photo.querySelectorAll('img')).toHaveLength(1);
    expect(photo.querySelector('img').getAttribute('src')).toBe(image);
    expect(photo.querySelector('figcaption').textContent).toContain('<img src=x onerror=alert(1)>.jpg');
    expect(photo.body.textContent).toContain('不代表已完成检查或验收');
    expect(renderCabinetImage({ cabinetImage: image })).toContain('当前方案生成');
  });
  it.each(['simple', 'full'])('places the two independent A4 pages directly after cover in %s mode', uiMode => {
    const design = createDefaultDesign();
    design.sitePhoto = { dataUrl: image, name: '现场.jpg' };
    const assembly = buildAssembly(design), net = buildWiring(design, assembly);
    const pack = buildDocumentPack({ design, assembly, net, uiMode, cabinetImage: image });
    expect(pack.pages.slice(0, 3).map(page => page.id)).toEqual(['cover', 'cabinet-image', 'site-photo']);
    expect(pack.pages.slice(0, 3).every(page => page.pageSize === 'A4')).toBe(true);
    delete design.sitePhoto;
    expect(buildDocumentPack({ design, assembly, net, uiMode }).pages.some(page => page.id === 'site-photo')).toBe(false);
  });
});
