import {it,expect} from 'vitest';
import {routeCabinetWire} from '../../src/view/wire-routing.js';
import {createBlankDesign,snapshotDesignTemplate,materializeTemplate} from '../../src/data/design-templates.js';
import {buildWiring,buildAssembly,validateDesign,findProduct} from '../../src/core/domain.js';
import {normalizeModule} from '../../src/core/modules.js';
import {terminalWireSegments} from '../../src/core/terminal-connections.js';
import {buildBom} from '../../src/core/bom.js';

it.each(['top','bottom','left','right'])('neutral bar %s persists without changing PE or topology',pos=>{
 const d=validateDesign(createBlankDesign({nBarPosition:pos}));
 expect(materializeTemplate(snapshotDesignTemplate(d,'位置模板')).nBarPosition).toBe(pos);
 const net=buildWiring(d),n=net.nodes.find(n=>n.id==='N'),pe=net.nodes.find(n=>n.id==='PE');
 expect(n.barOrient).toBe(['top','bottom'].includes(pos)?'horizontal':'vertical');
 if(pos==='top')expect(n.y).toBeGreaterThan(0);
 if(pos==='bottom')expect(n.y).toBeLessThan(0);
 if(pos==='left')expect(n.x).toBeLessThan(0);
 if(pos==='right'){expect(n.x).toBeGreaterThan(0);expect(n.x).not.toBe(pe.x);}
 expect(pe.x).toBe(net.assembly.box.width/2-27);
 expect(net.wires).toHaveLength(buildWiring(createBlankDesign()).wires.length);
});
it('routing is axis-aligned including changes of depth',()=>{
 const a={x:-40,y:100,z:73,side:'bottom'},b={x:220,y:-100,z:28,side:'top'};
 for(const cond of ['L1','N','PE']){
  const curve=routeCabinetWire(a,b,cond,{width:520},217);
  for(let i=1;i<curve.points.length;i++){
   const prev=curve.points[i-1],next=curve.points[i];
   expect(['x','y','z'].filter(k=>prev[k]!==next[k]).length).toBeLessThanOrEqual(1);
  }
  expect(curve.getPoint(0).toArray()).toEqual([-40,100,73]);
  expect(curve.getPoint(1).toArray()).toEqual([220,-100,28]);
 }
});
it.each([[false,true],[true,false],[false,false]])('busbar toggles N=%s PE=%s remove hardware, wires and BOM', (neutral,earth)=>{
 const d=createBlankDesign({includeNeutralBar:neutral,includeEarthBar:earth});
 const net=buildWiring(d),bom=buildBom(d,net.assembly,net);
 expect(net.nodes.some(n=>n.id==='N')).toBe(neutral);
 expect(net.nodes.some(n=>n.id==='PE')).toBe(earth);
 expect(bom.items.some(n=>n.sku==='N-BAR')).toBe(neutral);
 expect(bom.items.some(n=>n.sku==='PE-BAR')).toBe(earth);
 for(const w of net.wires){expect(net.ports[w.from]).toBeTruthy();expect(net.ports[w.to]).toBeTruthy();}
 const restored=materializeTemplate(snapshotDesignTemplate(d,'无排模板'));
 expect(restored.includeNeutralBar).toBe(neutral);expect(restored.includeEarthBar).toBe(earth);
});
it('virtual field wire inherits channel name without requiring manual load name',()=>{
 const d=createBlankDesign();
 d.modules=[normalizeModule({id:'K1',productId:'tuya-relay-4ch',channelLabels:{1:'一楼客厅灯光'}},findProduct(d,'tuya-relay-4ch')),normalizeModule({id:'T1',productId:'phoenix-pt25-gy-4',terminalConnections:{1:{output:'K1:CH1_OUT'}}},findProduct(d,'phoenix-pt25-gy-4'))];
 let wires=terminalWireSegments(d,buildAssembly(d),id=>findProduct(d,id));expect(wires[0].fieldName).toBe('一楼客厅灯光');
 d.modules[0].channelLabels[1]='餐厅灯光';wires=terminalWireSegments(d,buildAssembly(d),id=>findProduct(d,id));expect(wires[0].fieldName).toBe('餐厅灯光');
});
