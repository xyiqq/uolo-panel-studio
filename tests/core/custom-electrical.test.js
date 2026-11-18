import {describe, it, expect} from 'vitest';
import {validateCustomProduct, createDefaultDesign, buildWiring} from '../../src/core/domain.js';
import {buildPortTemplates} from '../../src/core/ports.js';
import {computeBusBudgets} from '../../src/core/bus-budget.js';
import {normalizeModule} from '../../src/core/modules.js';
import {isMainsFedModule} from '../../src/core/module-feeds.js';

const base = {id:'USR-electrical',brand:'Test',name:'Control',sku:'CTL',kind:'relay',poles:2,width:54,height:94,depth:59,minWire:1,maxWire:16,neutralSide:'left',protocol:['din'],channels:2};
describe('custom electrical model', () => {
  it('persists source, independent control/load supplies and ratings through validation', () => {
    const product=validateCustomProduct({...base,powerInput:'24VDC',loadPowerInput:'LN',channelAmps:5,channelWatts:600,powerConsumptionW:8,busConsumption:{value:200,unit:'mA'},source:{file:'Manufacturer spec',pages:'3',url:'https://example.com/spec'}});
    expect(product.source).toEqual({file:'Manufacturer spec',pages:'3',url:'https://example.com/spec'});
    expect(validateCustomProduct(JSON.parse(JSON.stringify(product)))).toMatchObject({channelAmps:5,channelWatts:600,powerConsumptionW:8,busConsumption:{value:200,unit:'mA'},source:product.source});
    expect(buildPortTemplates(product).map(p=>p.key)).toEqual(expect.arrayContaining(['DC+','DC-','L_IN','N_IN','CH1_IN','CH1_OUT']));
  });
  it.each(['shared','perChannel'])('does not generate mains paths for an unknown load input (%s)', feed => {
    const d=createDefaultDesign(); d.uiMode='full'; d.includeSpd=false; d.supply='single'; d.circuits=d.circuits.filter(c=>c.voltage===220).slice(0,1);
    const p=validateCustomProduct({...base,powerInput:'24VDC',loadPowerInput:'unknown'});
    d.customProducts.push(p); d.modules=[normalizeModule({id:'K1',productId:p.id,feed,feedCircuitId:d.circuits[0].id,channels:{1:d.circuits[0].id}})];
    const net=buildWiring(d);
    expect(buildPortTemplates(p).map(p=>p.key)).toEqual(['DC+','DC-']);
    expect(net.wires.some(w=>w.from.startsWith('K1:CH')||w.to.startsWith('K1:CH')||w.to==='K1:L_IN')).toBe(false);
    expect(net.wires.some(w=>w.to===`X-${d.circuits[0].id}:L1`)).toBe(true);
  });
  it('keeps legacy supply spelling and omitted fields compatible', () => {
    const old=validateCustomProduct(base);
    expect(old.powerInput).toBeUndefined();
    expect(old.loadPowerInput).toBeUndefined();
    expect(buildPortTemplates(old).some(p=>p.key==='CH1_OUT')).toBe(true);
    const nullFields=validateCustomProduct({...base,powerInput:'LN',loadPowerInput:null,busConsumption:null});
    expect(nullFields.loadPowerInput).toBeNull();
    expect(nullFields.busConsumption).toBeNull();
    expect(buildPortTemplates(nullFields).some(p=>p.key==='CH1_OUT')).toBe(true);
    const p=validateCustomProduct({...base,powerInput:'24vdc-or-poe'});
    expect(p.powerInput).toBe('24vdc-or-poe');
    expect(buildPortTemplates(p).some(p=>p.key==='DC+')).toBe(true);
  });
  it.each(['relay','dimmer','contactor','timer','meter'])('blocks explicit unknown/no load supply in simple and full %s wiring',kind=>{
    for (const loadPowerInput of ['unknown','none']) for (const uiMode of ['simple','full']) {
      const d=createDefaultDesign(); d.uiMode=uiMode; d.includeSpd=false; d.supply='single'; d.circuits=d.circuits.filter(c=>c.voltage===220).slice(0,1);
      const p=validateCustomProduct({...base,kind,powerInput:'LN',loadPowerInput});
      d.customProducts.push(p); d.modules=[normalizeModule({id:'K1',productId:p.id,feed:'perChannel',protectId:d.circuits[0].id,channels:{1:d.circuits[0].id}})];
      const net=buildWiring(d);
      expect(isMainsFedModule(p)).toBe(false);
      expect(net.moduleFeedBindings||[]).toEqual([]);
      expect(net.wires.some(w=>w.to.startsWith('K1:')||w.from.startsWith('K1:'))).toBe(false);
      expect(net.wires.some(w=>w.to===`X-${d.circuits[0].id}:L1`)).toBe(true);
    }
  });
  it.each([undefined,null])('retains legacy automatic feed when load supply is %s',loadPowerInput=>{
    const d=createDefaultDesign(); d.uiMode='simple'; d.includeSpd=false; d.supply='single'; d.circuits=d.circuits.filter(c=>c.voltage===220).slice(0,1);
    const p=validateCustomProduct({...base,loadPowerInput});
    d.customProducts.push(p);d.modules=[normalizeModule({id:'K1',productId:p.id})];
    const net=buildWiring(d);
    expect(isMainsFedModule(p)).toBe(true);
    expect(net.wires.some(w=>w.to==='K1:L1_IN'||w.to==='K1:L_IN')).toBe(true);
  });
  it('uses explicit budget consumption and PSU capacity without using total input watts', () => {
    const psu=validateCustomProduct({...base,id:'USR-psu',kind:'psu',powerInput:'LN',psuOutput:{voltage:24,amps:1,watts:24}});
    const device=validateCustomProduct({...base,powerConsumptionW:100,busConsumption:{unit:'mA',value:500}});
    const design={modules:[{id:'PS1',productId:psu.id},{id:'K1',productId:device.id}],buses:[{id:'DC1',type:'dc',psuModuleIds:['PS1'],deviceModuleIds:['K1']}]};
    expect(computeBusBudgets(design,[psu,device])[0]).toMatchObject({capacity:24,used:12,overBudget:false});
    expect(computeBusBudgets(design,[psu,{...device,busConsumption:null}])[0]).toMatchObject({used:null,usedKnown:false});
  });
  it.each([{channelAmps:-1},{channelWatts:Infinity},{powerConsumptionW:-1},{channels:1.5},{busConsumption:{value:-1,unit:'W'}},{psuOutput:{voltage:24}},{source:{url:'javascript:alert(1)'}},{source:{url:'https://user:password@example.com/'}}])('rejects invalid electrical/source input %j', fields => {
    expect(()=>validateCustomProduct({...base,...fields})).toThrow();
  });
  it('keeps missing ratings unknown and explicit zero consumption valid', () => {
    const p=validateCustomProduct({...base,channelAmps:null,channelWatts:null,busConsumption:{unit:'W',value:0}});
    expect(p).toMatchObject({channelAmps:null,channelWatts:null,busConsumption:{unit:'W',value:0}});
  });
});
