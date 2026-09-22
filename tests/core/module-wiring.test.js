import {describe,it,expect} from 'vitest';
import {createDefaultDesign,buildWiring,simulate,auditWiring} from '../../src/core/domain.js';
import {normalizeModule} from '../../src/core/modules.js';

function fixture(feed='perChannel') {
  const d=createDefaultDesign();d.uiMode='full';d.includeSpd=false;
  d.circuits=d.circuits.filter(c=>c.voltage===220).slice(0,3);
  d.supply='single';
  d.modules=[normalizeModule({id:'K1',productId:'crestron-din-8sw8-i',feed,channels:{1:d.circuits[0].id,2:d.circuits[1].id},feedCircuitId:d.circuits[2].id})];
  return d;
}
describe('explicit module wiring',()=>{
  it('routes independent channels from their own breaker and preserves switch simulation',()=>{
    const d=fixture(),n=buildWiring(d),a=d.circuits[0].id,b=d.circuits[1].id;
    expect(n.wires.find(w=>w.to==='K1:CH1_IN').from).toBe(`${a}:L1_OUT`);
    expect(n.wires.find(w=>w.to==='K1:CH2_IN').from).toBe(`${b}:L1_OUT`);
    expect(n.wires.find(w=>w.to===`X-${a}:L1`).from).toBe('K1:CH1_OUT');
    expect(simulate(n,d,{power:true}).circuits[a].powered).toBe(true);
    d.states.K1=false;
    expect(simulate(n,d,{power:true}).circuits[a].powered).toBe(false);
    expect(n.wires.filter(w=>w.id.startsWith('module-wire:')).every(w=>w.lengthKind==='internal' && !('externalSection' in w))).toBe(true);
  });
  it('uses the explicit common feeder without shorting branch supplies together',()=>{
    const d=fixture('shared'),n=buildWiring(d),source=d.circuits[2].id;
    expect(n.wires.filter(w=>w.to==='K1:L_IN')).toHaveLength(1);
    expect(n.wires.find(w=>w.to==='K1:L_IN').from).toBe(`${source}:L1_OUT`);
    for(const c of d.circuits.slice(0,2)) expect(n.wires.find(w=>w.to===`X-${c.id}:N`).from).toBe(`${source}:N_OUT`);
    d.states[source]=false;
    expect(simulate(n,d,{power:true}).circuits[d.circuits[0].id].powered).toBe(false);
  });
  it('places a meter after the controlling channel and keeps neutral continuous',()=>{
    const d=fixture();
    d.customProducts.push({id:'USR-METER',kind:'meter',name:'Meter',width:36,depth:60,height:86,modules:2,poles:2,channels:1,powerInput:'LN'});
    d.modules.push(normalizeModule({id:'M1',productId:'USR-METER',channels:{1:d.circuits[0].id}}));
    const n=buildWiring(d);
    expect(n.wires.find(w=>w.to==='M1:L_IN').from).toBe('K1:CH1_OUT');
    expect(n.wires.find(w=>w.to===`X-${d.circuits[0].id}:L1`).from).toBe('M1:L_OUT');
    expect(n.wires.find(w=>w.to===`X-${d.circuits[0].id}:N`).from).toBe('M1:N_OUT');
    expect(simulate(n,d,{power:true}).circuits[d.circuits[0].id].powered).toBe(true);
  });
  it('does not invent a common source and rebuilds persisted generated wires',()=>{
    const d=fixture('shared');d.modules[0].feedCircuitId=null;
    expect(buildWiring(d).wiringIssues.some(i=>i.code==='MODULE_FEED_CONFLICT')).toBe(true);
    d.modules[0].feedCircuitId=d.circuits[2].id;
    const w=buildWiring(d).wires.find(w=>w.to==='K1:L_IN');
    d.disconnected.push(w.id);d.wireOverrides[w.id]=6;
    expect(buildWiring(d).wires.find(v=>v.id===w.id)).toMatchObject({section:6,connected:false});
  });
  it('connects a declared 24V bus only with verified voltage and receiver input',()=>{
    const d=fixture();d.modules=[normalizeModule({id:'PS1',productId:'crestron-din-pws50'}),normalizeModule({id:'CPU',productId:'crestron-din-ap4'})];
    d.buses=[{id:'DC1',type:'dc',voltage:24,psuModuleIds:['PS1'],deviceModuleIds:['CPU']}];
    const n=buildWiring(d);
    expect(n.wires.filter(w=>w.class==='dc')).toHaveLength(2);
    expect(n.wires.find(w=>w.to==='CPU:DC+').from).toBe('PS1:DC+');
    d.buses[0].voltage=48;
    expect(buildWiring(d).wires.filter(w=>w.class==='dc')).toHaveLength(0);
    expect(buildWiring(d).wiringIssues[0].code).toBe('BUS_DEVICE_UNVERIFIED');
  });
  it('connects compatible KNX bus ports and refuses automatic PSU paralleling',()=>{
    const d=fixture();d.modules=[normalizeModule({id:'PS1',productId:'mdt-stc-0640-01'}),normalizeModule({id:'K1',productId:'mdt-aks-0816-03',busId:'B1'})];
    d.buses=[{id:'B1',type:'knx',psuModuleIds:['PS1'],deviceModuleIds:[]}];
    expect(buildWiring(d).wires.filter(w=>w.class==='comms')).toHaveLength(2);
    d.modules.push(normalizeModule({id:'PS2',productId:'mdt-stc-0640-01'}));d.buses[0].psuModuleIds.push('PS2');
    expect(buildWiring(d).wires.filter(w=>w.class==='comms')).toHaveLength(0);
    expect(buildWiring(d).wiringIssues.some(i=>i.code==='BUS_SOURCE_UNRESOLVED')).toBe(true);
  });
  it('does not short independent protected neutral sources into a shared module N input',()=>{
    const d=fixture();d.modules[0].productId='crestron-din-1dimu4';
    const n=buildWiring(d);
    expect(n.wiringIssues.some(i=>i.code==='MODULE_NEUTRAL_UNVERIFIED')).toBe(true);
    expect(n.wires.filter(w=>w.to==='K1:N_IN')).toHaveLength(0);
  });
  it('respects a saved meter-before-controller order',()=>{
    const d=fixture();
    d.customProducts.push({id:'USR-METER',kind:'meter',name:'Meter',width:36,depth:60,height:86,modules:2,poles:2,channels:1,powerInput:'LN'});
    d.modules.push(normalizeModule({id:'M1',productId:'USR-METER',channels:{1:d.circuits[0].id}}));
    d.circuits[0].devices=[{role:'protection'},{role:'meter',moduleId:'M1',channel:1},{role:'control',moduleId:'K1',channel:1}];
    const n=buildWiring(d);
    expect(n.wires.find(w=>w.to==='M1:L_IN').from).toBe(`${d.circuits[0].id}:L1_OUT`);
    expect(n.wires.find(w=>w.to==='K1:CH1_IN').from).toBe('M1:L_OUT');
    expect(n.wires.find(w=>w.to===`X-${d.circuits[0].id}:L1`).from).toBe('K1:CH1_OUT');
  });
  it('rejects stale, duplicate and unsupported multistage saved chains without partial rewiring',()=>{
    const d=fixture(),cid=d.circuits[0].id;
    d.circuits[0].devices=[{role:'control',moduleId:'K1',channel:2}];
    expect(buildWiring(d).wiringIssues.some(i=>i.code==='MODULE_CHAIN_ASSIGNMENT')).toBe(true);
    d.modules.push(normalizeModule({id:'K2',productId:'crestron-din-8sw8-i',feed:'perChannel',channels:{1:cid}}));
    d.circuits[0].devices=[{role:'control',moduleId:'K1',channel:1},{role:'control',moduleId:'K2',channel:1}];
    let n=buildWiring(d);
    expect(n.wiringIssues.some(i=>i.code==='MODULE_CHAIN_MULTISTAGE')).toBe(true);
    expect(n.wires.find(w=>w.to===`X-${cid}:L1`).from).toBe(`${cid}:L1_OUT`);
    d.circuits[0].devices.push(d.circuits[0].devices[0]);
    expect(buildWiring(d).wiringIssues.some(i=>i.code==='MODULE_CHAIN_ASSIGNMENT')).toBe(true);
  });
  it('prevalidates all channel endpoints before replacing any original wire',()=>{
    const d=fixture(),cid=d.circuits[0].id;
    d.modules[0].channels={99:cid};d.circuits[0].devices=[];
    const n=buildWiring(d);
    expect(n.wiringIssues.some(i=>i.code==='MODULE_CHAIN_PORT_MISSING')).toBe(true);
    expect(n.wires.find(w=>w.to===`X-${cid}:L1`).from).toBe(`${cid}:L1_OUT`);
    expect(n.wires.some(w=>w.id.startsWith('module-wire:'))).toBe(false);
  });
  it('keeps actual shared feeder protection on output and neutral tails',()=>{
    const d=fixture('shared'),cid=d.circuits[0].id,source=d.circuits[2].id;
    d.circuits[0].productId='A9D32610';d.circuits[0].wire=1.5;
    d.circuits[2].productId='A9D32620';
    const n=buildWiring(d);
    const feed=n.wires.find(w=>w.to==='K1:L_IN');
    for(const conductor of ['L1','N']) expect(n.wires.find(w=>w.to===`X-${cid}:${conductor}`).protect).toBe(feed.protect);
    expect(feed.protect).toBe(20);
    expect(n.wires.find(w=>w.to===`X-${cid}:N`).from).toBe(`${source}:N_OUT`);
  });
  it('supports DC24 and keeps unknown bus sections pending without power-Iz checks',()=>{
    const d=fixture();
    d.customProducts.push({id:'USR-DC',kind:'gateway',name:'DC receiver',width:36,height:86,depth:60,poles:2,modules:2,powerInput:'DC24'});
    d.modules=[normalizeModule({id:'PS1',productId:'crestron-din-pws50'}),normalizeModule({id:'CPU',productId:'USR-DC'})];
    d.buses=[{id:'DC1',type:'dc',voltage:24,psuModuleIds:['PS1'],deviceModuleIds:['CPU']}];
    let n=buildWiring(d),dc=n.wires.filter(w=>w.class==='dc');
    expect(dc).toHaveLength(2);expect(dc.every(w=>w.section===null)).toBe(true);
    expect(n.wiringIssues.some(i=>i.code==='BUS_SECTION_UNVERIFIED')).toBe(true);
    expect(auditWiring(n,d).some(i=>dc.some(w=>w.id===i.wire)&&i.code==='WIRE_TERMINAL')).toBe(false);
    d.buses[0].section=.75;n=buildWiring(d);dc=n.wires.filter(w=>w.class==='dc');
    expect(dc.every(w=>w.section===.75)).toBe(true);
    for(const wire of dc) wire.protect=100;
    expect(auditWiring(n,d).some(i=>dc.some(w=>w.id===i.wire)&&i.code==='WIRE_IZ')).toBe(false);
  });
});
