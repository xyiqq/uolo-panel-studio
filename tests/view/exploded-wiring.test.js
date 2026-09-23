import {it,expect} from 'vitest';
import {nodeExplosionOffset,connectedNodeIds,wireTouchesSelection,connectionInspection} from '../../src/view/exploded-wiring.js';
import {TerminalStudio3D} from '../../src/view/terminal-studio3d.js';
import {Mesh,BufferGeometry,MeshBasicMaterial} from 'three';

it('selected explosion moves only that part, including isolate mode',()=>{
  const module={id:'K1',row:2,product:{}},terminal={id:'T1',row:0,product:{}};
  expect(nodeExplosionOffset(module,1,{selected:'K1',explodeScope:'selected'})).toBe(192);
  expect(nodeExplosionOffset(terminal,1,{selected:'K1',explodeScope:'selected'})).toBe(0);
  expect(nodeExplosionOffset(module,1,{selected:'K1',isolate:true})).toBe(192);
  expect(nodeExplosionOffset(module,1,{explodeScope:'all'})).toBe(206);
  expect(nodeExplosionOffset({id:'N',role:'neutral'},1,{explodeScope:'all'})).toBe(85);
});
it('isolated connection context is direct rather than the whole connected cabinet',()=>{
  const net={ports:{a:{node:'Q0'},b:{node:'C1'},c:{node:'K1'},d:{node:'K2'}},wires:[{from:'a',to:'b'},{from:'b',to:'c'},{from:'b',to:'d'}]};
  const segments=[{output:'K1:CH1_OUT',terminalId:'T1'},{output:'K2:CH1_OUT',terminalId:'T2'}];
  expect([...connectedNodeIds(net,segments,'K1')].sort()).toEqual(['C1','K1','T1']);
  expect(wireTouchesSelection(net,net.wires[0],'K1')).toBe(false);
  expect(wireTouchesSelection(net,net.wires[1],'K1')).toBe(true);
});
it('supply leads stay attached during explosion and restore original endpoints',()=>{
  const view=Object.create(TerminalStudio3D.prototype);
  view.options={selected:'K1',explodeScope:'selected'};view.poseAmount=1;
  const from={node:'C1',x:0,y:50,z:40,side:'bottom'},to={node:'K1',x:90,y:-50,z:65,side:'top'};
  view.net={nodes:[{id:'C1',product:{}},{id:'K1',product:{}}],ports:{a:from,b:to}};
  const ref={edge:{from:'a',to:'b',conductor:'L1',section:2.5},mesh:new Mesh(new BufferGeometry(),new MeshBasicMaterial())};
  const original=ref.mesh.geometry;
  view.model={box:{width:520},wires:new Map([['w',ref]])};
  view.updateNetWirePose();
  expect(ref.curve.getPoint(0).toArray()).toEqual([0,50,40]);
  expect(ref.curve.getPoint(1).toArray()).toEqual([90,-50,257]);
  expect([...ref.mesh.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
  const geometry=ref.mesh.geometry;view.updateNetWirePose();expect(ref.mesh.geometry).toBe(geometry);
  view.poseAmount=0;view.updateNetWirePose();expect(ref.curve.getPoint(1).toArray()).toEqual([90,-50,65]);
  ref.mesh.geometry.dispose();ref.mesh.material.dispose();original.dispose();
});

function chainFixture() {
  const nodes=[{id:'C1',product:{kind:'mcb'}},{id:'R1',product:{kind:'rccb'}},{id:'C2',product:{kind:'mcb'}},{id:'K1',product:{kind:'relay'}},{id:'K2',product:{kind:'relay'}},{id:'T1',product:{kind:'terminal'}},{id:'T2',product:{kind:'terminal'}},{id:'N',role:'neutral'}];
  const ports=Object.fromEntries(nodes.map(n=>[n.id,{node:n.id}]));
  const wires=[{id:'cr',from:'C1',to:'R1'},{id:'f1',from:'R1',to:'K1',moduleFeed:true,breakerId:'C1'},
    {id:'n1',from:'N',to:'K1',moduleFeed:true,breakerId:'C1'},
    {id:'f2',from:'C2',to:'K2',moduleFeed:true,breakerId:'C2'},{id:'n2',from:'N',to:'K2',moduleFeed:true,breakerId:'C2'}];
  const segments=[{id:'T1:1',output:'K1:CH1_OUT',terminalId:'T1'},{id:'T1:2',output:'K1:CH2_OUT',terminalId:'T1'},{id:'T2:1',output:'K2:CH1_OUT',terminalId:'T2'}];
  return {net:{nodes,ports,wires},segments};
}
it('breaker inspection includes its RCD, fed module and all downstream terminals without crossing shared neutral',()=>{
  const {net,segments}=chainFixture(),scope=connectionInspection(net,segments,'C1');
  expect([...scope.levels]).toEqual([['C1',0],['R1',1],['K1',2],['T1',3]]);
  expect([...scope.wireIds].sort()).toEqual(['cr','f1','n1']);
  expect([...scope.segmentIds]).toEqual(['T1:1','T1:2']);
  expect(scope.context.has('N')).toBe(true);
  for(const id of ['C2','K2','T2']) expect(scope.context.has(id)).toBe(false);
  const offsets=['C1','R1','K1','T1'].map(id=>nodeExplosionOffset(net.nodes.find(n=>n.id===id),1,{selected:'C1',explodeScope:'selected'},scope.levels));
  expect(offsets).toEqual([192,302,412,522]);
  expect(nodeExplosionOffset(net.nodes.find(n=>n.id==='K2'),1,{selected:'C1',isolate:true},scope.levels)).toBe(0);
});
it('selecting a module preserves one moving part and direct connection context',()=>{
  const {net,segments}=chainFixture(),scope=connectionInspection(net,segments,'K1');
  expect([...scope.levels]).toEqual([['K1',0]]);
  expect([...scope.context].sort()).toEqual(['K1','N','R1','T1']);
  expect([...scope.wireIds].sort()).toEqual(['f1','n1']);
  expect([...scope.segmentIds]).toEqual(['T1:1','T1:2']);
});
it('selecting a separate RCD follows its outgoing feed to the module and terminals',()=>{
  const {net,segments}=chainFixture(),scope=connectionInspection(net,segments,'R1');
  expect([...scope.levels]).toEqual([['R1',0],['K1',1],['T1',2]]);
  expect(scope.context.has('C1')).toBe(false);
  expect(scope.context.has('K2')).toBe(false);
});
it('breaker chain uses a local labelled neutral reference without mutating electrical ports',()=>{
  const {net,segments}=chainFixture();
  net.ports.N={node:'N',x:-250,y:-900,z:23,side:'center'};
  net.ports.K1={node:'K1',x:30,y:100,z:60,side:'top'};
  const view=Object.create(TerminalStudio3D.prototype);
  view.net=net;view.inspection=connectionInspection(net,segments,'C1');
  view.options={selected:'C1',isolate:true};view.poseAmount=1;
  const [from,to]=view.displayedPorts(net.wires.find(w=>w.id==='n1'));
  expect(from.supplyReference).toBe(true);
  expect(from.y).toBe(130);expect(from.z).toBe(472);
  expect(net.ports.N.y).toBe(-900);expect(to).toBe(net.ports.K1);
});
it('relay load neutral belongs to module and breaker inspection without moving the virtual load',()=>{
  const {net,segments}=chainFixture();
  net.nodes.find(n=>n.id==='K1').product={kind:'relay',width:160,height:90,depth:60};
  Object.assign(net.nodes.find(n=>n.id==='K1'),{x:40,y:100});
  net.nodes.push({id:'X-C1',role:'load'});net.ports['X-C1']={node:'X-C1',x:400,y:-800,z:70};
  const edge={id:'loadN',from:'N',to:'X-C1',moduleNeutral:true,moduleId:'K1',breakerId:'C1',conductor:'N'};
  net.wires=net.wires.filter(w=>w.id!=='n1');net.wires.push(edge);
  for(const selected of ['K1','C1']) {
    const scope=connectionInspection(net,segments,selected);
    expect(scope.wireIds.has('loadN')).toBe(true);
    expect(scope.levels.has('X-C1')).toBe(false);
    expect(scope.context.has('X-C1')).toBe(false);
  }
  const view=Object.create(TerminalStudio3D.prototype);
  view.net=net;view.options={selected:'K1',isolate:true};view.poseAmount=1;
  view.inspection=connectionInspection(net,segments,'K1');
  const [,to]=view.displayedPorts(edge);
  expect(to).toMatchObject({node:'K1',loadNeutralReference:true,x:132,y:43,z:68});
  expect(to.z+view.offset(to.node)).toBe(260);
  expect(net.ports['X-C1'].y).toBe(-800);
  view.options={selected:'K1',explodeScope:'all'};view.poseAmount=0;
  expect(view.displayedPorts(edge)[1].loadNeutralReference).toBe(true);
});
it('explosion animation hides terminal detail wires instead of rebuilding them every frame',()=>{
  const view=Object.create(TerminalStudio3D.prototype);
  const existing={visible:true};
  let cleared=0;
  view.clearTerminalWires=()=>{cleared++;};
  Object.assign(view,{net:{},design:{},model:{wires:new Map()},options:{},terminalWires:existing,explosion:.4,explosionTarget:1});
  view.drawTerminalWires();
  expect(existing.visible).toBe(false);expect(cleared).toBe(0);expect(view.dirty).toBe(true);
  view.explosion=1;view.poseAmount=1;view.selected=null;view.terminalWiresVisible=true;
  view.terminalPoseKey=JSON.stringify([1,null,undefined,undefined,undefined,undefined,true,[]]);
  view.drawTerminalWires();
  expect(existing.visible).toBe(true);expect(cleared).toBe(0);
});
