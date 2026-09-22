import {it,expect} from 'vitest';
import {BULL_PDU_PRODUCTS} from '../../src/data/products/pdu-bull.js';
import {createBlankDesign} from '../../src/data/design-templates.js';
import {validateDesign,buildAssembly,buildWiring} from '../../src/core/domain.js';
import {compactModulePlacement} from '../../src/core/modules.js';
import {placementRows} from '../../src/core/placement-footprint.js';
import {buildBom} from '../../src/core/bom.js';
import {computeSpace} from '../../src/core/space.js';

it.each(BULL_PDU_PRODUCTS)('$name保存设备标注，竖装跨排占位且三维模型/BOM不丢失',p=>{
  const d=validateDesign(createBlankDesign({modules:[{id:'PDU1',productId:p.id,displayName:'影音设备电源',outletLabels:{1:'交换机',2:'NAS'}}]}));
  const restored=validateDesign(JSON.parse(JSON.stringify(d))),a=compactModulePlacement(buildAssembly(restored),restored),node=a.nodes.find(n=>n.id==='PDU1');
  expect(node.overflow).toBeFalsy();expect(node.product.outletLabels[2]).toBe('NAS');expect(node.product.width).toBe(44);
  const span=placementRows(node.product,a.box),occupied=a.occupied.flat().filter(id=>id==='PDU1').length;
  expect(occupied).toBe(span*3);expect(span).toBe(p.outletCount===8?3:2);
  const net=buildWiring(restored,a);expect(net.wires.some(w=>w.from.startsWith('PDU1:')||w.to.startsWith('PDU1:'))).toBe(false);
  expect(buildBom(restored,a,net).items.some(i=>i.sku===p.sku)).toBe(true);
  expect(computeSpace(restored,a).rowsNeeded).toBeGreaterThanOrEqual(span);
});
it('两条竖装PDU占位不交叠，其他模块不被紧邻排布错误移动到PDU中心',()=>{
  const d=validateDesign(createBlankDesign({modules:[{id:'PDU1',productId:'bull-gne-1080'},{id:'PDU2',productId:'bull-gne-1080'},{id:'GW1',productId:'reyee-rg-es105gd'}]}));
  const a=compactModulePlacement(buildAssembly(d),d),p=a.nodes.find(n=>n.id==='PDU1'),q=a.nodes.find(n=>n.id==='PDU2'),g=a.nodes.find(n=>n.id==='GW1');
  expect(a.nodes.some(n=>n.overflow)).toBe(false);expect(p.slot).not.toBe(q.slot);
  expect(g.y).toBe(a.box.height/2-a.box.topRail-g.row*a.box.pitch);
});
it('横装8位PDU不会缩小塞入24P；尺寸修订保存并重新占位',()=>{
  const d=validateDesign(createBlankDesign({modules:[{id:'PDU1',productId:'bull-gne-1080',pduOrientation:'horizontal'}]}));
  expect(compactModulePlacement(buildAssembly(d),d).nodes.find(n=>n.id==='PDU1').overflow).toBe(true);
  d.modules[0].pduOrientation='vertical';d.modules[0].pduSize={length:510,height:46,depth:48};
  const p=buildAssembly(validateDesign(d)).nodes.find(n=>n.id==='PDU1').product;
  expect(p).toMatchObject({width:46,height:510,depth:48,pduPhysicalLength:510});
});
it('PDU跨越的每一排都必须满足强弱电分区约束',()=>{
  const d=validateDesign(createBlankDesign({rowZones:['power','control','power','control','power','control'],modules:[{id:'PDU1',productId:'bull-gne-1080'}]}));
  expect(compactModulePlacement(buildAssembly(d),d).nodes.find(n=>n.id==='PDU1').overflow).toBe(true);
});
