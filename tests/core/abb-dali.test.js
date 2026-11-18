import { describe, expect, it } from 'vitest';
import {createBreakerPackDesign,snapshotDesignTemplate,materializeTemplate} from '../../src/data/design-templates.js';
import {buildWiring,findProduct,validateDesign} from '../../src/core/domain.js';
import {buildPortTemplates} from '../../src/core/ports.js';
import {computeBusBudgets} from '../../src/core/bus-budget.js';
import {savePsuConnections} from '../../src/core/psu-connections.js';
import {applyLabelRules} from '../../src/core/labels.js';
import {abbDaliLines,daliFieldCapacity,fieldLimitError} from '../../src/core/abb-dali.js';
import {renderSystemDiagram} from '../../src/view/system-diagram.js';

function fixture(lines=2) {
  const d=createBreakerPackDesign({count:2,productId:'A9D32610',name:'ABB DALI'});
  d.modules=[
    {id:'GW',productId:'abb-dg-s-'+lines+'-64-5-1',protectId:'C01',daliFieldLoops:{
      1:{plus:'T1:1',minus:'T1:2',name:'调光驱动器',devices:64,milliamps:128,meters:100,section:0.5},
      2:{plus:'T1:3',minus:'T1:4',name:'应急驱动器',devices:6,milliamps:12,meters:20,section:1.5}}},
    {id:'T1',productId:'phoenix-pt25-gy-4'}, {id:'KNX',productId:'mdt-stc-0640-01',protectId:'C02'},
    {id:'PS',productId:'lunatone-dali-ps-24033444'},
  ];
  const normalized=validateDesign(d);
  savePsuConnections(normalized,'KNX',findProduct(normalized,'mdt-stc-0640-01'),['GW']);
  return normalized;
}
describe('ABB Premium DALI outputs',()=>{
  it.each([1,2])('reopens the %i-output gateway and keeps KNX, line and DALI hardware separate',lines=>{
    const d=materializeTemplate(snapshotDesignTemplate(fixture(lines),'ABB'));
    const n=buildWiring(d), w=n.wires.filter(w=>w.daliField);
    expect(w).toHaveLength(lines*2);
    expect(n.ports['GW:L_IN'].displayTag).toBe('GW.1-L');
    expect(n.ports['GW:N_IN'].displayTag).toBe('GW.2-N');
    expect(n.ports['GW:BUS+'].displayTag).toBe('GW.KNX+');
    expect(n.ports['GW:DALI1_PLUS'].displayTag).toBe('GW.A-3-DA+');
    expect(n.wires.filter(w=>w.moduleFeed&&w.moduleId==='GW')).toHaveLength(2);
    expect(n.ports['GW:L1_OUT']).toBeUndefined();
    expect(n.ports['KNX:L1_OUT']).toBeUndefined();
    expect(n.ports['KNX:PE_IN'].displayTag).toBe('KNX.PE');
    expect(n.ports['KNX:U2_PLUS'].displayTag).toBe('KNX.U2+');
    expect(!!n.ports['GW:DALI2_PLUS']).toBe(lines===2);
    expect(n.wires.find(w=>w.from==='KNX:BUS+'&&w.to==='GW:BUS+')).toBeTruthy();
    expect(w[0].to).toBe('T1:1');
    const labels=applyLabelRules(d,n);
    expect(labels.terminalTag(w[0].from)).toBe('GW.A-3-DA+');
    const budget=computeBusBudgets(d,d.modules.map(m=>findProduct(d,m.productId))).find(b=>b.type==='knx');
    expect(budget.used).toBe(10);
    expect(renderSystemDiagram(d,n.assembly,n).pages.join('')).toContain('128 / 160 mA');
  });
  it('checks A and B separately and preserves A when B exceeds the current, length, or device limit',()=>{
    const d=fixture(), gw=d.modules[0], p=findProduct(d,gw.productId), b=gw.daliFieldLoops[2];
    expect(fieldLimitError(p,{devices:65},160)).toContain('64');
    expect(fieldLimitError(p,{section:0.75,meters:150},160)).toBe('');
    expect(fieldLimitError(p,{section:0.75,meters:151},160)).toContain('线长');
    b.milliamps=161;
    const n=buildWiring(d);
    expect(n.wires.filter(w=>w.daliField).map(w=>w.daliLoop)).toEqual([1,1]);
    expect(n.wiringIssues.some(i=>i.code==='DALI_FIELD_LIMIT')).toBe(true);
    expect(()=>savePsuConnections(d,'PS',findProduct(d,'lunatone-dali-ps-24033444'),['GW'])).toThrow(/内置/);
  });
  it('rejects occupied terminals and retains separate KNX wiring in malformed DALI bus imports',()=>{
    const d=fixture(), gw=d.modules[0];
    gw.daliFieldLoops[2].plus='T1:1';
    d.buses.push({id:'bad',type:'dali',psuModuleIds:['PS'],deviceModuleIds:['GW']});
    const n=buildWiring(d);
    expect(n.wires.some(w=>w.daliField)).toBe(false);
    expect(n.wires.some(w=>w.from==='PS:BUS+')).toBe(false);
    expect(n.wires.some(w=>w.from==='KNX:BUS+')).toBe(true);
    expect(abbDaliLines({id:'abb-dg-s'})).toBe(0);
    expect(buildPortTemplates(findProduct(d,gw.productId)).filter(p=>p.io==='both')).toHaveLength(6);
  });
  it('uses the separate downstream plug on existing Crestron DIN-DALI-2 and preserves control supply isolation',()=>{
    const d=fixture(), gw=d.modules[0];
    gw.productId='crestron-din-dali-2';
    gw.daliPowerMode='INT';
    const n=buildWiring(d);
    expect(n.wires.filter(w=>w.daliField).map(w=>w.from)).toEqual(['GW:DALI1_PLUS_2','GW:DALI1_MINUS_2','GW:DALI2_PLUS_2','GW:DALI2_MINUS_2']);
  });
  it.each([['crestron-din-dli',1,170,'_2'],['lutron-lqse-2dal-d',2,128,'']])('uses manufacturer field terminals on %s', (id,lines,capacity,suffix)=>{
    const d=fixture(), gw=d.modules[0];
    gw.productId=id;
    const n=buildWiring(d), p=findProduct(d,id), fields=n.wires.filter(w=>w.daliField);
    expect(fields).toHaveLength(2*lines);
    expect(fields[0].from).toBe(id.startsWith('lutron')?'GW:DALI1_LEFT':'GW:DALI1_PLUS'+suffix);
    expect(n.ports[fields[0].from].side).toBe('top');
    expect(daliFieldCapacity(p,gw,1,()=>null)).toBe(capacity);
    expect(()=>savePsuConnections(d,'PS',findProduct(d,'lunatone-dali-ps-24033444'),['GW'])).toThrow(/内置/);
    if(id.startsWith('lutron')){
      expect(buildPortTemplates(p).map(pin=>pin.key)).toEqual(expect.arrayContaining(['QS_1','QS_3','QS_4','DALI2_RIGHT','PE_IN']));
      expect(fieldLimitError(p,{section:1,meters:80},capacity)).not.toBe('');
      expect(fieldLimitError(p,{section:1.5,meters:300},capacity)).toBe('');
    }
  });
  it('budgets each DIN-DALI-2 EXT field output against its own power supply',()=>{
    const d=fixture(), gw=d.modules[0], p=findProduct(d,'crestron-din-dali-2');
    Object.assign(gw,{productId:p.id,daliPowerMode:'EXT',daliLoopSupplies:{1:'PS'}});
    const resolve=id=>findProduct(d,d.modules.find(m=>m.id===id)?.productId);
    expect(daliFieldCapacity(p,gw,1,resolve)).toBe(200);
    expect(daliFieldCapacity(p,gw,2,resolve)).toBeNull();
    expect(buildWiring(d).wiringIssues.some(i=>i.code==='DALI_FIELD_BUDGET_REVIEW')).toBe(true);
    expect(fieldLimitError(p,{section:0.82,meters:155},200)).toBe('');
    expect(fieldLimitError(p,{section:0.82,meters:156},200)).toContain('155');
  });
  it('uses numbered DLP-04R screws and requires a recorded side for a Tridonic DA/DA supply',()=>{
    const d=fixture(), gw=d.modules[0], ps=d.modules.find(m=>m.id==='PS');
    Object.assign(gw,{productId:'crestron-din-dali-2',daliPowerMode:'EXT',daliLoopSupplies:{1:'PS',2:'MW'}});
    Object.assign(ps,{productId:'tridonic-dali-ps2',protectId:'C01'});
    d.modules.push({id:'MW',productId:'meanwell-dlp-04r'});
    const initial=buildWiring(d);
    expect(initial.wires.some(w=>w.from.startsWith('PS:'))).toBe(false);
    expect(initial.ports['MW:BUS+'].displayTag).toBe('MW.2-DA+');
    expect(initial.ports['MW:BUS-'].displayTag).toBe('MW.1-DA-');
    expect(initial.ports['MW:BUS+'].x).toBeLessThan(initial.ports['MW:BUS-'].x);
    expect(initial.ports['MW:L_IN'].side).toBe('bottom');
    expect(initial.ports['PS:L_IN'].side).toBe('top');
    ps.daliPositiveSide='right';
    d.disconnected=['module-wire:PS:BUS+>GW:DALI1_PLUS'];
    const n=buildWiring(validateDesign(JSON.parse(JSON.stringify(d))));
    const plus=n.wires.find(w=>w.to==='GW:DALI1_PLUS');
    expect(plus.from).toBe('PS:DA_RIGHT');
    expect(plus.connected).toBe(false);
    expect(n.ports[plus.from].displayTag).toBe('PS.DA(右)');
    expect(n.wires.find(w=>w.to==='GW:DALI2_MINUS').from).toBe('MW:BUS-');
  });
});
