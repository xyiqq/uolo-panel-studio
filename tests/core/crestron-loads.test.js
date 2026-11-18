import {describe,it,expect} from 'vitest';
import {createDefaultDesign,buildWiring,findProduct,simulate,validateDesign} from '../../src/core/domain.js';
import {buildDeliveryNet} from '../../src/core/delivery-net.js';
import {normalizeModule,syncCircuitDevices,removeModule} from '../../src/core/modules.js';


function fixture() {
  const d=createDefaultDesign();
  d.circuits=[...d.circuits.filter(c=>c.voltage===220).slice(0,3).map(c=>({...c,phase:'L1'})),d.circuits.find(c=>c.voltage===380)];
  d.modules=[];d.uiMode='simple';d.includeSpd=false;
  return d;
}
function install(d,id,productId,channels={},settings={}) {
  const m=normalizeModule({id,productId,feed:'perChannel',channels,...settings},findProduct(d,productId));
  d.modules.push(m);return m;
}
const incoming=(n,to)=>n.wires.filter(w=>w.to===to);
const connected=(n,from,to)=>n.wires.some(w=>w.from===from&&w.to===to);

describe('manufacturer load terminals',()=>{
  it('preserves the specified order of three dry contacts across save/reopen, stops on either open contact',()=>{
    const d=fixture(),c=d.circuits[0].id;
    for(const [id,order] of [['K3',3],['K1',1],['K2',2]]) install(d,id,'crestron-din-8sw8-i',{1:c},{seriesStages:{1:order}});
    syncCircuitDevices(d,id=>findProduct(d,id));
    expect(d.circuits[0].devices.filter(d=>d.moduleId).map(d=>d.moduleId)).toEqual(['K1','K2','K3']);
    const reopened=validateDesign(JSON.parse(JSON.stringify(d))),n=buildWiring(reopened);
    expect(connected(n,'K1:CH1_OUT','K2:CH1_IN')).toBe(true);
    expect(connected(n,'K2:CH1_OUT','K3:CH1_IN')).toBe(true);
    expect(connected(n,'K3:CH1_OUT','X-'+c+':L1')).toBe(true);
    expect(n.wires.filter(w=>w.scope==='干接点级间馈电')).toHaveLength(2);
    expect(n.ports['K2:N_IN']).toBeUndefined();
    expect(simulate(n,reopened,{power:true}).circuits[c].powered).toBe(true);
    reopened.states.K2=false;
    expect(simulate(n,reopened,{power:true}).circuits[c].powered).toBe(false);
    reopened.modules[0].seriesStages={1:1};
    expect(buildWiring(reopened).wiringIssues.some(i=>i.code==='MODULE_CHAIN_MULTISTAGE')).toBe(true);
  });
  it('keeps old shared-contact disconnections and section overrides on the real contact feeds',()=>{
    const d=fixture(),[a,b,source]=d.circuits;
    install(d,'K1','crestron-din-8sw8-i',{1:a.id,2:b.id},{feed:'shared',feedCircuitId:source.id});
    const original=buildWiring(d),from=incoming(original,'K1:CH1_IN')[0].from;
    d.disconnected=['module-wire:'+from+'>K1:L_IN'];
    d.wireOverrides['module-wire:K1:L_IN>K1:CH2_IN']=2.5;
    const n=buildWiring(d);
    expect(incoming(n,'K1:CH1_IN')[0].connected).toBe(false);
    expect(incoming(n,'K1:CH2_IN')[0]).toMatchObject({connected:false,section:2.5});
    expect(simulate(n,d,{power:true}).circuits[a.id].powered).toBe(false);
  });
  it('maps dimmer contacts, independent protected neutrals and signed analog endpoints without cross-connecting them',()=>{
    const d=fixture(),[a,b]=d.circuits;
    const m=install(d,'D1','crestron-din-4dimflv4',{1:a.id,2:b.id},{analogTerminals:{1:{plus:'T1:1',minus:'T1:2'},2:{plus:'T1:3',minus:'T1:4'}}});
    install(d,'T1','phoenix-pt25-gy-4');
    const n=buildWiring(d);expect(n.ports['D1:L_IN']).toBeUndefined();expect(n.ports['D1:N_IN']).toBeUndefined();
    for(const [i,c] of [a,b].entries()){
      const ch=i+1;expect(incoming(n,'D1:CH'+ch+'_IN')[0].from).toMatch(new RegExp('^'+c.id+'(?:-RCD)?:L1_OUT$'));
      expect(incoming(n,'X-'+c.id+':N')[0].from).not.toContain('D1:');
      expect(connected(n,'D1:CH'+ch+'_PLUS','T1:'+(2*i+1))).toBe(true);
      expect(connected(n,'D1:CH'+ch+'_MINUS','T1:'+(2*i+2))).toBe(true);
    }
    const del=buildDeliveryNet(d,n.assembly,n);
    expect(del.wires.filter(w=>w.conductor.startsWith('0-10V'))).toHaveLength(4);
    m.analogTerminals[2].minus='T1:1';
    const invalid=buildWiring(d);
    expect(invalid.wires.filter(w=>w.conductor.startsWith('0-10V'))).toHaveLength(0);
    expect(invalid.wiringIssues.filter(x=>x.code==='MODULE_ANALOG_TARGET')).toHaveLength(2);
    removeModule(d,'T1');expect(m.analogTerminals[1].plus).toBe('');
  });
  it('uses one insulation class for the four analog outputs sharing the Lutron common',()=>{
    const d=fixture(),[a,b,c]=d.circuits;
    const m=install(d,'D1','lutron-lqse-4t10-d',{1:a.id,2:b.id},{protectId:c.id,analogTerminals:{1:{plus:'T1:1',minus:'T1:2'},2:{plus:'T1:3',minus:'T1:4'}}});
    install(d,'T1','phoenix-pt25-gy-4');
    expect(buildWiring(d).wiringIssues.some(issue=>issue.code==='MODULE_ANALOG_CIRCUIT_CLASS')).toBe(true);
    for(const [key,label] of [['pelv','SELV / IEC PELV'],['nonPelv','非 SELV / IEC PELV']]){
      m.analogCircuitClass=key;
      const n=buildWiring(validateDesign(JSON.parse(JSON.stringify(d))));
      const analog=n.wires.filter(w=>w.conductor.startsWith('0-10V'));
      expect(analog).toHaveLength(4);
      expect(analog.every(w=>w.class==='signal'&&w.scope.endsWith(label))).toBe(true);
      expect(n.wiringIssues.some(issue=>issue.code==='MODULE_ANALOG_CIRCUIT_CLASS')).toBe(false);
    }
  });
  it.each(['crestron-din-1dim4','crestron-din-1dimu4'])('%s uses one common feed and the local neutral/earth takeoff for each output',id=>{
    const d=fixture(),[a,b]=d.circuits;
    const m=install(d,'D1',id,{1:a.id,2:b.id},{feed:'shared',feedCircuitId:a.id});
    const n=buildWiring(d);
    for(const conductor of ['L','N','PE']) expect(incoming(n,'D1:'+conductor+'_IN')).toHaveLength(1);
    for(const [i,c] of [a,b].entries())for(const conductor of ['N','PE'])
      expect(connected(n,'D1:CH'+(i+1)+'_'+conductor,'X-'+c.id+':'+conductor)).toBe(true);
    expect(n.ports['D1:CH2_IN']).toBeUndefined();expect(n.ports['D1:CH2_N'].side).toBe('bottom');
    m.feed='perChannel';expect(buildWiring(d).wiringIssues.some(i=>i.code==='MODULE_NEUTRAL_UNVERIFIED')).toBe(true);
  });
  it('separates both opposing motor directions and leaves the motor neutral on its own branch',()=>{
    const d=fixture(),c=d.circuits[0].id;
    install(d,'K1','crestron-din-2mc2',{2:c});
    const n=buildWiring(d);
    expect(connected(n,'K1:CH2_OP','X-'+c+':L1')).toBe(true);
    expect(connected(n,'K1:CH2_CL','X-'+c+':CL')).toBe(true);
    expect(n.ports['X-'+c+':L1'].displayTag).toBe('X-'+c+'.OP');
    expect(n.internal.some(edge=>['K1:CH2_OP','K1:CH2_CL'].includes(edge.b))).toBe(false);
    expect(n.ports['K1:N_IN']).toBeUndefined();
  });
  it('LQSE-4M-D switches four direction pairs from one protected source with a separate neutral tap',()=>{
    const d=createDefaultDesign();
    d.circuits=d.circuits.filter(c=>c.voltage===220).slice(0,4).map(c=>({...c,phase:'L1'}));
    const feeder=d.circuits[0].id,channels=Object.fromEntries(d.circuits.map((c,i)=>[i+1,c.id]));
    const m=install(d,'LM','lutron-lqse-4m-d',channels,{feed:'shared',protectId:feeder,feedCircuitId:feeder});
    const n=buildWiring(d);
    expect(n.wiringIssues.filter(w=>w.moduleId==='LM')).toEqual([]);
    const neutralSource=incoming(n,'LM:N_IN')[0].from;
    for(const key of ['L','N','PE'])expect(incoming(n,'LM:'+key+'_IN')).toHaveLength(1);
    for(const [i,c] of d.circuits.entries()){
      expect(n.ports['LM:CH'+(i+1)+'_N']).toBeUndefined();
      expect(connected(n,'LM:CH'+(i+1)+'_OP','X-'+c.id+':L1')).toBe(true);
      expect(connected(n,'LM:CH'+(i+1)+'_CL','X-'+c.id+':CL')).toBe(true);
      expect(connected(n,neutralSource,'X-'+c.id+':N')).toBe(true);
      expect(connected(n,'PE:PE-'+c.id,'X-'+c.id+':PE')).toBe(true);
    }
    m.feed='perChannel';
    expect(buildWiring(d).wires.some(w=>w.from.startsWith('LM:CH'))).toBe(false);
  });
  it('chains three direct meters phase by phase and isolates incomplete, duplicated, mixed and reordered saved chains',()=>{
    const d=fixture(),c=d.circuits.at(-1),id=c.id;
    for(const [key,stage] of [['M2',2],['M1',1],['M3',3]])install(d,key,'eastron-sdm630-modbus-v2',{1:id},{seriesStages:{1:stage}});
    syncCircuitDevices(d,p=>findProduct(d,p));
    const fresh=()=>validateDesign(JSON.parse(JSON.stringify(d)));
    const valid=fresh(),n=buildWiring(valid);
    expect(n.wires.filter(w=>w.moduleId&&/^M[123]$/.test(w.moduleId))).toHaveLength(16);
    for(const pole of ['L1','L2','L3','N']){
      expect(connected(n,id+'-RCD:'+pole+'_OUT','M1:'+pole+'_IN')).toBe(true);
      for(const [a,b] of [['M1','M2'],['M2','M3']])expect(connected(n,a+':'+pole+'_OUT',b+':'+pole+'_IN')).toBe(true);
      expect(connected(n,'M3:'+pole+'_OUT','X-'+id+':'+pole)).toBe(true);
    }
    expect(n.moduleFeedBindings.find(b=>b.moduleId==='M2').sourceId).toBe('M1');
    expect(simulate(n,valid,{power:true}).circuits[id].powered).toBe(true);
    const assertIsolated=design=>{
      const failed=buildWiring(design);
      expect(failed.wiringIssues.some(issue=>['METER_THREE_PHASE_SECTION','METER_THREE_PHASE_ORDER','MODULE_CHAIN_ASSIGNMENT'].includes(issue.code))).toBe(true);
      expect(failed.wires.some(w=>[w.from,w.to].some(end=>/^M[123]:/.test(end)))).toBe(false);
      expect(failed.wires.filter(w=>w.to.startsWith('X-'+id+':')).map(w=>w.conductor)).toEqual(['PE']);
      expect(simulate(failed,design,{power:true}).circuits[id].powered).toBe(false);
    };
    const removed=fresh();removeModule(removed,'M2');assertIsolated(validateDesign(removed));
    const reversed=fresh(), rc=reversed.circuits.find(c=>c.id===id);rc.devices=rc.devices.reverse();assertIsolated(validateDesign(reversed));
    const dupe=fresh();dupe.modules.find(m=>m.id==='M3').seriesStages[1]=2;assertIsolated(dupe);
    const badGauge=fresh();badGauge.wireOverrides['module-wire:M1:L2_OUT>M2:L2_IN']=2.5;assertIsolated(badGauge);
    const foreign=fresh();foreign.circuits[0].devices.push({role:'meter',moduleId:'M2',channel:1});assertIsolated(validateDesign(foreign));
    const mixed=fresh();install(mixed,'K1','crestron-din-8sw8-i',{1:id});syncCircuitDevices(mixed,p=>findProduct(mixed,p));assertIsolated(mixed);
  });
  it('keeps all four meter poles in the same phase order, preserves PE and rejects short branches/invalid terminal gauges',()=>{
    const d=fixture(),c=d.circuits.at(-1);
    const m=install(d,'WH1','eastron-sdm630-modbus-v2',{1:c.id});
    const n=buildWiring(d);
    for(const [i,phase] of ['L1','L2','L3','N'].entries()){
      expect(n.ports['WH1:'+phase+'_IN'].marking).toBe((i+1)+'-'+phase);
      expect(n.ports['WH1:'+phase+'_OUT'].marking).toBe((i+5)+'-'+phase);
      expect(connected(n,c.id+'-RCD:'+phase+'_OUT','WH1:'+phase+'_IN')).toBe(true);
      expect(connected(n,'WH1:'+phase+'_OUT','X-'+c.id+':'+phase)).toBe(true);
    }
    expect(n.wires.filter(w=>w.moduleId==='WH1').every(w=>w.section>=4)).toBe(true);
    expect(connected(n,'PE:PE-'+c.id,'X-'+c.id+':PE')).toBe(true);
    expect(simulate(n,d,{power:true}).circuits[c.id].powered).toBe(true);
    const wire=n.wires.find(w=>w.from==='WH1:L1_OUT');d.wireOverrides[wire.id]=2.5;
    expect(buildWiring(d).wiringIssues.some(i=>i.code==='METER_THREE_PHASE_SECTION')).toBe(true);
    m.channels[1]=d.circuits[0].id;
    expect(buildWiring(d).wires.some(w=>w.moduleId==='WH1')).toBe(false);
  });
});
