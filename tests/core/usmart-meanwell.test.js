import {describe,it,expect} from 'vitest';
import {SMART_PRODUCTS} from '../../src/data/products/smart-index.js';
import {moduleFaceScene} from '../../src/view/module-face.js';
import {createDefaultDesign,buildAssembly,validateDesign} from '../../src/core/domain.js';

const product=id=>SMART_PRODUCTS.find(p=>p.id===id);
describe('USMART 接口模块与明纬完整型号',()=>{
  it('两款 DIN-TCP 接口数量明确，外形沿用 HDR-100-24N，不继承电源输入输出',()=>{
    const psu=product('meanwell-hdr-100-24n');
    for(const count of [2,4]){
      const p=product(`usmart-din-tcp-${count}rs485`);
      expect(p).toMatchObject({brand:'USMART',kind:'gateway',ethernetPorts:1,serialPorts:count,powerInput:null,psuOutput:null,channels:null});
      for(const key of ['width','height','depth','modules'])expect(p[key]).toBe(psu[key]);
      const labels=moduleFaceScene(p).shapes.filter(s=>s.tag==='text').map(s=>s.text);
      expect(labels).toContain('LAN');
      expect(labels.filter(s=>/^485-\d+$/.test(s))).toHaveLength(count);
    }
  });
  it('完整型号额定输出与厂家规格一致，DLP-04R 不重复添加',()=>{
    expect(product('meanwell-hdr-100-12n').psuOutput).toEqual({voltage:12,amps:7.5,watts:90});
    expect(product('meanwell-hdr-100-24n').psuOutput).toEqual({voltage:24,amps:4.2,watts:100.8});
    expect(SMART_PRODUCTS.filter(p=>p.id==='meanwell-dlp-04r')).toHaveLength(1);
    expect(product('meanwell-dlp-04r')).toMatchObject({width:35,height:90,depth:54.5,modules:2,protocol:['dali'],psuOutput:{voltage:16,milliamps:240,watts:3.84}});
  });
  it('五款模块可保存并装配，旧 HDR-100 方案仍能解析',()=>{
    const ids=['usmart-din-tcp-2rs485','usmart-din-tcp-4rs485','meanwell-hdr-100-12n','meanwell-hdr-100-24n','meanwell-dlp-04r'];
    const d=createDefaultDesign();d.circuits=[];d.modules=ids.map((productId,i)=>({id:`M${i+1}`,productId}));
    const validated=validateDesign(JSON.parse(JSON.stringify(d))),a=buildAssembly(validated);
    expect(a.nodes.filter(n=>ids.includes(n.product.id))).toHaveLength(5);
    expect(product('meanwell-hdr-100')).toBeTruthy();
  });
});
