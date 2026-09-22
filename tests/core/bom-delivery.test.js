import {describe,it,expect} from 'vitest';
import {buildBomDelivery} from '../../src/core/bom-delivery.js';
import {bomRows,toCsv} from '../../src/core/handover.js';
import {renderBomPage} from '../../src/view/documents/bom-page.js';
import {createDefaultDesign,buildAssembly,buildWiring} from '../../src/core/domain.js';
import {buildBom} from '../../src/core/bom.js';

const assembly={box:{id:'VENDOR-BOX',name:'Model 999 800x600'},nodes:[
  {id:'C01',row:0,product:{id:'catalog',sku:'SKU-999',kind:'rcbo',name:'Vendor 40A 6kA',brand:'SecretBrand',note:'Model Purchase',priceReference:998}},
  {id:'C02',row:1,product:{id:'catalog',sku:'SKU-999',kind:'rcbo'}},
]};
const bom={items:[{sku:'SKU-999',name:'Vendor 40A 6kA',brand:'SecretBrand',qty:2,note:'Model Purchase',priceReference:998},{sku:'VENDOR-BOX',name:'Model 999 800x600',qty:1},{sku:'DIN-RAIL',name:'rail model',qty:2,note:'24 slots'}],wires:[{section:999,color:'yellow',meters:12.345,lengthKind:'external',note:'model spec'}, {section:99,color:'dc',meters:8,note:'RVV automatic spec'}]};
describe('中性交付物料清单',()=>{
  it('移除规格后同类线材合并汇总，避免重复且无法区分的清单行',()=>{
    const view=buildBomDelivery({wires:[{meters:1.234,lengthKind:'internal',section:1.5},{meters:2.345,lengthKind:'internal',section:2.5},{meters:9,lengthKind:'external'}]});
    expect(view.wires).toHaveLength(2);
    expect(view.wires[0].qty).toBe(3.58);
    expect(view.wires[1].qty).toBe(9);
  });
  it('PDF和CSV共用通用名称、数量、单位、位置，禁止透出目录参数',()=>{
    const view=buildBomDelivery(bom,{assembly});
    expect(view.items[0]).toEqual({name:'带漏电保护断路器',qty:2,unit:'个',location:'C01 · 第 1 排；C02 · 第 2 排'});
    expect(view.items[1].name).toBe('配电箱体');
    const html=renderBomPage({bom,assembly}),csv=toCsv(bomRows(bom,{assembly}));
    for(const output of [html,csv]) {
      for(const forbidden of ['SKU-999','VENDOR-BOX','SecretBrand','40A','6kA','998','800x600','24 slots','model spec','RVV automatic spec','订单号','参考价']) expect(output).not.toContain(forbidden);
      for(const item of [...view.items,...view.wires]) expect(output).toContain(item.name);
      expect(output).toContain('估算');expect(output).toContain('待核');
    }
    expect(html).toContain('模型不代表实际采购设备');
  });
  it('无节点上下文时不猜型号，且不修改内部BOM',()=>{
    const before=structuredClone(bom),view=buildBomDelivery(bom);
    expect(view.items[0].name).toBe('设备（类型待核）');
    expect(bom).toEqual(before);
    expect(bomRows(bom)).toHaveLength(1+bom.items.length+bom.wires.length);
  });
  it('逐芯米数明确不等于成品多芯电缆采购数量',()=>{
    const wires=buildBomDelivery(bom,{assembly}).wires;
    expect(wires[0]).toMatchObject({name:'出箱电缆芯线',qty:12.35,unit:'m'});
    expect(wires[0].location).toContain('非成品多芯电缆采购米数');
    expect(wires[1].location).toContain('录入长度');
    expect(wires.every(w=>!Object.hasOwn(w,'section'))).toBe(true);
  });
  it('实际默认方案保留内部SKU聚合，交付数量不变',()=>{
    const design=createDefaultDesign(),a=buildAssembly(design),net=buildWiring(design,a),internal=buildBom(design,a,net);
    const before=structuredClone(internal),view=buildBomDelivery(internal,{assembly:a});
    expect(view.items.map(i=>i.qty)).toEqual(internal.items.map(i=>i.qty));
    expect(internal).toEqual(before);
    expect(view.items.every(i=>!Object.hasOwn(i,'sku')&&!Object.hasOwn(i,'brand'))).toBe(true);
    expect(view.items.some(i=>i.name==='设备（类型待核）')).toBe(false);
  });
});
