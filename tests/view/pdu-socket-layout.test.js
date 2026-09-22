import {it,expect} from 'vitest';
import {PDU_SOCKET_HOLES} from '../../src/view/pdu-socket-layout.js';
import {moduleFaceScene} from '../../src/view/module-face.js';
import {BULL_PDU_PRODUCTS} from '../../src/data/products/pdu-bull.js';
it('竖装后与实物一致：左侧上下两斜孔，右侧三个水平长孔',()=>{
  const holes=PDU_SOCKET_HOLES.map(h=>({...h,screenX:h.y,screenY:-h.x}));
  const straight=holes.filter(h=>h.kind==='straight'),angled=holes.filter(h=>h.kind==='angled');
  expect(straight.map(h=>h.screenX)).toEqual([7,7,7]);
  expect(straight.map(h=>h.screenY||0)).toEqual([6,0,-6]);
  expect(straight.every(h=>h.height>h.width&&h.angle===0)).toBe(true);
  expect(angled.map(h=>[h.screenX,h.screenY])).toEqual([[-7,7],[-7,-7]]);
  expect(angled.map(h=>h.angle)).toEqual([Math.PI/6,-Math.PI/6]);
});
it.each(BULL_PDU_PRODUCTS)('$name矢量预览同步逐位生成五个孔',p=>{
  expect(moduleFaceScene(p).shapes.filter(s=>s.tag==='polygon')).toHaveLength(p.outletCount*5);
});
