import {it,expect} from 'vitest';
import {createBreakerPackDesign} from '../../src/data/design-templates.js';
import {buildAssembly,buildWiring} from '../../src/core/domain.js';
import {buildDeliveryNet} from '../../src/core/delivery-net.js';
import {buildBom} from '../../src/core/bom.js';
import {applyLabelRules} from '../../src/core/labels.js';
import {buildDocumentPack} from '../../src/view/documents/index.js';
import {buildHandoverFiles} from '../../src/core/handover.js';

function fixture(){
  const d=createBreakerPackDesign({count:2,supply:'single'});d.includeSpd=false;
  d.modules=[{id:'K9',productId:'crestron-din-8sw8-i',channels:{},position:{row:1,slot:0}},
    {id:'T1',productId:'phoenix-pt25-gy-4',position:{row:0,slot:10},terminalConnections:{1:{output:'K9:CH1_OUT',section:1.5,wireNo:'WL-001',loadName:'客厅灯'},2:{output:'K9:CH2_OUT',section:2.5,wireNo:'WL-002'}}}];
  const a=buildAssembly(d),n=buildWiring(d,a);return {d,a,n};
}
it('接线清单幂等、不改仿真网，保留手填线号和器件ID并进入所有交付出口',()=>{
  const {d,a,n}=fixture(),original=structuredClone(n);
  const net=buildDeliveryNet(d,a,n),again=buildDeliveryNet(d,a,net);
  expect(net.wires.filter(w=>w.terminalConnection)).toHaveLength(2);
  expect(again.wires).toEqual(net.wires);
  expect(n).toEqual(original);
  const labels=applyLabelRules(d,net),wire=net.wires.find(w=>w.wireNo==='WL-002');
  expect(labels.wireTag(wire)).toBe('WL-002');expect(labels.terminalTag(wire.from)).toBe('K9.CH2_OUT');expect(labels.terminalTag(wire.to)).toBe('T1:2');
  const bom=buildBom(d,a,n),pack=buildDocumentPack({design:d,assembly:a,net:n,bom,labels});
  expect(bom.items.find(i=>i.sku==='WIRE-MARKER').qty).toBe(net.wires.length*2);
  expect(pack.pages.find(p=>p.id==='wiring-table').html).toContain('WL-002');
  expect(pack.pages.find(p=>p.id==='wire-tags').html).toContain('WL-002');
  const files=buildHandoverFiles({design:d,net:n,bom,pages:pack.pages});
  expect(files['端子接线表.csv']).toContain('WL-002');expect(files['端子接线表.csv']).toContain('T1:2');
});
it('出箱回路长度改变只改变出箱芯线，箱内馈线与端子跳线不随之放大',()=>{
  const {d,a,n}=fixture();d.circuits.forEach(c=>c.length=10);
  const first=buildBom(d,a,n);d.circuits[0].length=50;const second=buildBom(d,a,n);
  expect(second.wires.filter(w=>w.lengthKind==='internal')).toEqual(first.wires.filter(w=>w.lengthKind==='internal'));
  const sum=b=>b.wires.filter(w=>w.lengthKind==='external').reduce((v,w)=>v+w.meters,0);
  expect(sum(second)-sum(first)).toBe(120); // 单相L/N/PE，每芯增加40m。
  const without=structuredClone(d);without.modules[1].terminalConnections={};
  const base=buildBom(without,a,n);
  expect(first.items.find(i=>i.sku==='WIRE-MARKER').qty-base.items.find(i=>i.sku==='WIRE-MARKER').qty).toBe(4);
});
it('失效关联明确进入待核项，不编造端点或长度',()=>{
  const {d,a,n}=fixture();d.modules[1].terminalConnections[1].output='missing:CH1_OUT';
  const net=buildDeliveryNet(d,a,n);
  expect(net.wiringIssues.some(i=>i.code==='TERMINAL_CONNECTION_UNRESOLVED')).toBe(true);
  expect(net.wires.filter(w=>w.terminalConnection)).toHaveLength(1);
});

it('电表位于通道和实物端子之间，不生成绕过电表的平行支路',()=>{
  const {d}=fixture();d.uiMode='full';d.modules[0].feed='perChannel';d.modules[0].channels={1:d.circuits[0].id};
  d.modules[1].terminalConnections={1:{output:'K9:CH1_OUT',section:1.5,wireNo:'WL-001'}};
  d.customProducts.push({id:'USR-METER',kind:'meter',name:'Meter',width:36,depth:60,height:86,modules:2,poles:2,channels:1,powerInput:'LN'});
  d.modules.push({id:'M1',productId:'USR-METER',channels:{1:d.circuits[0].id}});
  const a=buildAssembly(d),n=buildWiring(d,a),net=buildDeliveryNet(d,a,n);
  expect(net.wires.find(w=>w.terminalConnection)).toMatchObject({from:'M1:L_OUT',to:'T1:1',assignedOutput:'K9:CH1_OUT'});
  expect(net.wires.some(w=>w.from==='K9:CH1_OUT'&&w.to==='T1:1')).toBe(false);
  expect(net.wires.some(w=>w.scope==='模块链 → 出箱端子'&&w.circuit===d.circuits[0].id)).toBe(false);
  expect(buildDeliveryNet(d,a,net).wires).toEqual(net.wires);
});
