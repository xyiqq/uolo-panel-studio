import {describe,it,expect} from 'vitest';
import QRCode from 'qrcode';
import {resolveDesignLink} from '../../src/core/design-link.js';
import {circuitQrPayload,nameplateQrPayload,qrMode,qrSvg} from '../../src/view/qr.js';

describe('当前本地方案链接',()=>{
  const design={designId:'方案 / A',circuits:[{id:'回路 1'}],publicBaseUrl:'https://example.com/panel/',labelRules:{qrMode:'online'}};
  it('生成并解析编码后的方案、回路链接，支持部署子路径',()=>{
    const href='https://example.com/panel/d/'+encodeURIComponent(design.designId)+'?c='+encodeURIComponent(design.circuits[0].id);
    expect(href).toBe('https://example.com/panel/d/%E6%96%B9%E6%A1%88%20%2F%20A?c=%E5%9B%9E%E8%B7%AF%201');
    expect(resolveDesignLink(href,design)).toMatchObject({status:'resolved',designId:design.designId,circuitId:'回路 1'});
    expect(resolveDesignLink('https://example.com/panel/d/'+encodeURIComponent(design.designId),design)).toMatchObject({status:'resolved',circuitId:null});
  });
  it('缺方案、版本不匹配或回路被删除时返回明确状态，不修改本地方案',()=>{
    const before=structuredClone(design),href='https://example.com/panel/d/'+encodeURIComponent(design.designId)+'?c='+encodeURIComponent(design.circuits[0].id);
    expect(resolveDesignLink(href,{designId:'另一方案'})).toMatchObject({status:'design-missing'});
    expect(resolveDesignLink(href,null).message).toContain('导入');
    expect(resolveDesignLink(href,{...design,circuits:[]})).toMatchObject({status:'circuit-missing'});
    expect(design).toEqual(before);
  });
  it('普通入口不触发提示，损坏链接和歧义参数不定位',()=>{
    expect(resolveDesignLink('https://example.com/panel/',design).status).toBe('none');
    for(const href of ['broken','https://example.com/d/','https://example.com/d/%ZZ','https://example.com/d/A/extra','https://example.com/d/A?c=1&c=2'])expect(resolveDesignLink(href,design).status).toBe('invalid');
    expect(resolveDesignLink('https://example.com/panel/d/'+encodeURIComponent(design.designId)+'?c=',design).status).toBe('circuit-missing');
  });
});

describe('二维码合法载荷与静区',()=>{
  const design={designId:'D1',qrProjectUrl:'https://example.com/projects/D1',labelRules:{qrMode:'online'}};
  it('外部项目页接口保留项目路径和已有查询参数，回路编号单独编码',()=>{
    const d={...design,qrProjectUrl:'https://example.com/projects/alpha?version=2'};
    expect(nameplateQrPayload(d)).toBe(d.qrProjectUrl);
    const url=new URL(circuitQrPayload(d,{id:'照明 / 01'}));
    expect(url.pathname).toBe('/projects/alpha');
    expect(url.searchParams.get('version')).toBe('2');
    expect(url.searchParams.get('c')).toBe('照明 / 01');
  });
  it('只有已配置公网 HTTPS 项目网址才能生成二维码',()=>{
    expect(qrMode(design)).toBe('online');
    for(const qrProjectUrl of ['http://example.com','https://localhost','https://192.168.1.3','javascript:alert(1)','ftp://example.com','/relative','https://user:password@example.com','https://example.com/#x']) {
      const d={...design,qrProjectUrl};expect(qrMode(d)).toBe('disabled');expect(nameplateQrPayload(d,'online')).toBe('');expect(circuitQrPayload(d,{id:'C1'},'online')).toBe('');
    }
    expect(qrMode({...design,qrProjectUrl:null})).toBe('disabled');
    expect(qrMode({...design,labelRules:{qrMode:'offline'}})).toBe('disabled');
    expect(nameplateQrPayload({...design,labelRules:{qrMode:'offline'}})).toBe('');
    expect(circuitQrPayload(design,{},'online')).toBe('');
  });
  it('二维码四边留白至少四个模块并保留所有数据模块',()=>{
    const payload='https://example.com/d/D1?c=C1',size=100,qr=QRCode.create(payload,{errorCorrectionLevel:'M'}),n=qr.modules.size,cell=size/(n+8);
    const svg=qrSvg(payload,size);
    const rects=[...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/g)].map(m=>m.slice(1).map(Number));
    let count=0;for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.modules.get(r,c))count++;
    expect(rects).toHaveLength(count);
    for(const [x,y,w,h] of rects){expect(x).toBeGreaterThanOrEqual(4*cell-.001);expect(y).toBeGreaterThanOrEqual(4*cell-.001);expect(x+w).toBeLessThanOrEqual(size-4*cell+.001);expect(y+h).toBeLessThanOrEqual(size-4*cell+.001);}
    expect(svg).toContain('fill="#fff"');
  });
});
