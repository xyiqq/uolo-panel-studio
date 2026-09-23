import {describe,it,expect} from 'vitest';
import {createDefaultDesign,buildWiring,simulate,auditWiring} from '../../src/core/domain.js';
import {normalizeModule} from '../../src/core/modules.js';
import {buildPortTemplates} from '../../src/core/ports.js';

function fixture(feed='perChannel') {
  const d=createDefaultDesign();d.uiMode='full';d.includeSpd=false;
  d.circuits=d.circuits.filter(c=>c.voltage===220).slice(0,3);
  d.supply='single';
  d.modules=[normalizeModule({id:'K1',productId:'crestron-din-8sw8-i',feed,channels:{1:d.circuits[0].id,2:d.circuits[1].id},feedCircuitId:d.circuits[2].id})];
  return d;
}
describe('explicit module wiring',()=>{
  it.each(['relay','dimmer'])('separates 24V controller power from %s load power',kind=>{
    const d=fixture('shared');
    d.customProducts.push({id:'USR-CONTROL',kind,name:'24V controller',width:144,height:90,depth:60,modules:8,channels:2,powerInput:'24vdc',loadPowerInput:'LN',protocol:['cresnet']});
    d.modules[0].productId='USR-CONTROL';
    d.modules.push(normalizeModule({id:'PS1',productId:'meanwell-hdr-100-24n'}));
    d.buses=[{id:'DC1',type:'dc',voltage:24,section:.75,psuModuleIds:['PS1'],deviceModuleIds:['K1']}];
    const n=buildWiring(d),source=d.circuits[2].id;
    expect(n.wires.find(w=>w.to==='K1:DC+')).toMatchObject({from:'PS1:DC+',class:'dc'});
    expect(n.wires.find(w=>w.to==='K1:DC-')).toMatchObject({from:'PS1:DC-',class:'dc'});
    expect(n.wires.find(w=>w.to==='K1:L_IN').from).toBe(`${source}:L1_OUT`);
    expect(n.wires.find(w=>w.to==='K1:N_IN').from).toBe(`${source}:N_OUT`);
    expect(n.wires.find(w=>w.to===`X-${d.circuits[0].id}:L1`).from).toBe('K1:CH1_OUT');
    expect(n.wires.some(w=>w.class==='dc' && /:(BUS|L_|N_|CH)/.test(w.to))).toBe(false);
    const keys=buildPortTemplates(d.customProducts[0]).map(p=>p.key);
    expect(keys).toEqual(expect.arrayContaining(['DC+','DC-','BUS+','BUS-','L_IN','N_IN','CH1_IN','CH1_OUT']));
  });
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
  it.each(['12vdc','DC12','12 V DC'])('connects HDR-100-12N only to a verified %s input',powerInput=>{
    const d=fixture();
    d.customProducts.push({id:'USR-12',kind:'gateway',name:'12V receiver',width:36,height:86,depth:60,modules:2,powerInput});
    d.modules=[normalizeModule({id:'PS1',productId:'meanwell-hdr-100-12n'}),normalizeModule({id:'CPU',productId:'USR-12'})];
    d.buses=[{id:'DC1',type:'dc',voltage:12,section:.75,psuModuleIds:['PS1'],deviceModuleIds:['CPU']}];
    let n=buildWiring(d);
    expect(n.wires.filter(w=>w.class==='dc')).toHaveLength(2);
    expect(n.wires.find(w=>w.to==='CPU:DC+')).toMatchObject({from:'PS1:DC+',scope:'12V 模块控制供电'});
    d.modules[0].productId='meanwell-hdr-100-24n';d.buses[0].voltage=24;
    n=buildWiring(d);
    expect(n.wires.filter(w=>w.class==='dc')).toHaveLength(0);
    expect(n.wiringIssues.some(i=>i.code==='BUS_DEVICE_UNVERIFIED')).toBe(true);
    d.modules[0].productId='meanwell-hdr-100-12n';d.buses[0].voltage=12;
    d.customProducts[0].powerInput='112vdc';
    expect(buildWiring(d).wires.filter(w=>w.class==='dc')).toHaveLength(0);
  });
  it('connects DLP-04R to DALI modules and the declared 24V USMART input',()=>{
    const d=fixture();
    d.customProducts.push({id:'USR-DALI',kind:'gateway',name:'External-powered DALI device',width:36,height:86,depth:60,modules:2,powerInput:'bus',protocol:['dali']});
    d.modules=[normalizeModule({id:'PS1',productId:'meanwell-dlp-04r'}),normalizeModule({id:'DA1',productId:'USR-DALI'}),normalizeModule({id:'GW1',productId:'usmart-din-tcp-2rs485'})];
    d.buses=[{id:'DA',type:'dali',section:1.5,psuModuleIds:['PS1'],deviceModuleIds:['DA1']}];
    let n=buildWiring(d);
    expect(n.wires.filter(w=>w.busId==='DA')).toHaveLength(2);
    expect(n.wires.find(w=>w.to==='DA1:BUS+')).toMatchObject({from:'PS1:BUS+',class:'comms'});
    d.modules[0].productId='meanwell-hdr-100-24n';
    d.buses=[{id:'DC',type:'dc',voltage:24,psuModuleIds:['PS1'],deviceModuleIds:['GW1']}];
    n=buildWiring(d);
    expect(n.wires.filter(w=>w.class==='dc')).toHaveLength(2);
    expect(n.wires.find(w=>w.to==='GW1:DC+')).toMatchObject({from:'PS1:DC+',scope:'24V 模块控制供电'});
    expect(n.wiringIssues.some(i=>i.code==='BUS_DEVICE_UNVERIFIED'&&i.moduleId==='GW1')).toBe(false);
  });
  it.each(['internal-only','switchable'])('does not parallel DLP-04R with a %s internal DALI supply',daliPowerSupply=>{
    const d=fixture();
    d.customProducts.push({id:'USR-DALI',kind:'gateway',name:'DALI controller',width:36,height:86,depth:60,modules:2,powerInput:'24vdc',protocol:['dali'],daliPowerSupply});
    d.modules=[normalizeModule({id:'PS1',productId:'meanwell-dlp-04r'}),normalizeModule({id:'DA1',productId:'USR-DALI'})];
    d.buses=[{id:'DA',type:'dali',section:1.5,psuModuleIds:['PS1'],deviceModuleIds:['DA1']}];
    const n=buildWiring(d);
    expect(n.wires.filter(w=>w.busId==='DA')).toHaveLength(0);
    expect(n.wiringIssues.some(i=>i.code==='DALI_INTERNAL_SUPPLY_CONFLICT'&&i.moduleId==='DA1')).toBe(true);
  });
  it.each(['dc','dali'])('rejects different supplies on one receiver across separate %s buses',type=>{
    const d=fixture(),psu=type==='dc'?'meanwell-hdr-100-24n':'meanwell-dlp-04r';
    d.customProducts.push({id:'USR-DALI',kind:'gateway',name:'External-powered DALI device',width:36,height:86,depth:60,modules:2,powerInput:'bus',protocol:['dali']});
    d.modules=[normalizeModule({id:'PS1',productId:psu}),normalizeModule({id:'PS2',productId:psu}),normalizeModule({id:'CPU',productId:type==='dc'?'crestron-din-ap4':'USR-DALI'})];
    d.buses=['PS1','PS2'].map((id,i)=>({id:`B${i}`,type,voltage:type==='dc'?24:null,section:.75,psuModuleIds:[id],deviceModuleIds:['CPU']}));
    let n=buildWiring(d);
    expect(n.wires.filter(w=>w.busId)).toHaveLength(0);
    expect(n.wiringIssues.some(i=>i.code==='BUS_DEVICE_SOURCE_CONFLICT'&&i.moduleId==='CPU')).toBe(true);
    d.buses.pop();n=buildWiring(d);
    expect(n.wires.filter(w=>w.busId)).toHaveLength(2);
    d.buses[0].deviceModuleIds=[];
    expect(buildWiring(d).wires.filter(w=>w.busId)).toHaveLength(0);
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
