import {describe, expect, it} from 'vitest';
import {createBreakerPackDesign} from '../../src/data/design-templates.js';
import {allProducts, buildWiring, findProduct, validateDesign} from '../../src/core/domain.js';
import {computeBusBudgets} from '../../src/core/bus-budget.js';
import {saveBus} from '../../src/core/bus-editor.js';
import {savePsuConnections} from '../../src/core/psu-connections.js';
import {daliLoopSupplyCandidates, isDaliLoopSupply, saveDaliPower, wireDaliLoops} from '../../src/core/dali-power.js';
import {removeModule} from '../../src/core/modules.js';
import {applyLabelRules} from '../../src/core/labels.js';

function fixture() {
  const d = createBreakerPackDesign({count:3, productId:'A9D32610'});
  d.modules = [
    {id:'GW', productId:'crestron-din-dali-2'},
    {id:'INTONLY', productId:'crestron-din-dli'},
    {id:'CTRL', productId:'meanwell-hdr-100-24n', protectId:'C01'},
    {id:'PS1', productId:'lunatone-dali-ps-24033444', protectId:'C02'},
    {id:'PS2', productId:'meanwell-dlp-04r', protectId:'C03'},
  ];
  d.buses = [{id:'CONTROL', type:'dc', budgetUnit:'W', voltage:24, section:0.82,
    psuModuleIds:['CTRL'], deviceModuleIds:['GW']}];
  return validateDesign(d);
}
const configure = (d, mode, loopSupplies) => saveDaliPower(d, 'GW', {mode, loopSupplies}, id => findProduct(d,id));
const reopen = d => validateDesign(JSON.parse(JSON.stringify(d)));
const loopWires = d => buildWiring(d).wires.filter(w => w.daliLoop);
const budget = d => computeBusBudgets(d,allProducts(d))[0].used;

describe('DIN-DALI-2 whole-unit power switch', () => {
  it('opens legacy designs as INT with two physical DALI loops and a separate Cresnet input', () => {
    const d = fixture(), net = buildWiring(d);
    expect(d.modules[0]).toMatchObject({daliPowerMode:'INT', daliLoopSupplies:{1:null,2:null}});
    expect(budget(d)).toBe(9);
    expect(net.wires.filter(w=>w.moduleId==='GW').map(w=>w.to)).toEqual(['GW:DC+','GW:DC-']);
    expect(net.ports['GW:DC+']).toMatchObject({side:'bottom', displayTag:'GW.NET-24'});
    expect(net.ports['GW:DC-'].displayTag).toBe('GW.NET-G');
    expect(net.ports['GW:L1_IN']).toBeUndefined();
    for (const loop of [1,2]) {
      for (const key of ['PLUS','MINUS']) {
        const id = `GW:DALI${loop}_${key}`;
        expect(net.ports[id].side).toBe('top');
        expect(net.internal).toContainEqual(expect.objectContaining({a:id, b:`${id}_2`, always:true}));
      }
    }
    expect(net.internal.some(e=>e.node==='GW' && /DALI/.test(e.a) && /:DC|:NET/.test(e.b))).toBe(false);
  });

  it('reopens EXT with two separate labelled PSU pairs and charges the controller exactly 2 W', () => {
    let d = fixture();
    configure(d, 'EXT', {1:'PS1', 2:'PS2'});
    d = reopen(d);
    const n = buildWiring(d), labels = applyLabelRules(d,n);
    const pairs = n.wires.filter(w=>w.daliLoop);
    expect(pairs.map(w=>[w.from,w.to,labels.wireTag(w)])).toEqual([
      ['PS1:BUS+', 'GW:DALI1_PLUS','GW.DALI1-DA+'], ['PS1:BUS-', 'GW:DALI1_MINUS','GW.DALI1-DA-'],
      ['PS2:BUS+', 'GW:DALI2_PLUS','GW.DALI2-DA+'], ['PS2:BUS-', 'GW:DALI2_MINUS','GW.DALI2-DA-'],
    ]);
    expect(n.ports['PS1:BUS+']).toMatchObject({side:'top', displayTag:'PS1.DA+'});
    expect(n.ports['PS1:L_IN']).toMatchObject({side:'bottom', displayTag:'PS1.L'});
    const dc = n.wires.filter(w=>w.class==='dc' && w.moduleId==='GW');
    expect(dc.map(w=>labels.wireTag(w))).toEqual(['DC+','DC-']);
    expect(budget(d)).toBe(2);
    configure(d,'INT');
    expect(loopWires(reopen(d))).toEqual([]);
    expect(budget(reopen(d))).toBe(9);
  });

  it('keeps each unpowered external loop pending; removes references when its source is deleted', () => {
    const d = fixture();
    configure(d, 'EXT', {2:'PS2'});
    const n = buildWiring(d);
    expect(n.wires.filter(w=>w.daliLoop).map(w=>w.daliLoop)).toEqual([2,2]);
    expect(n.wiringIssues.filter(i=>i.code==='DALI_LOOP_SUPPLY_REQUIRED')).toHaveLength(1);
    removeModule(d,'PS2');
    d.modules.push({id:'PS2', productId:'meanwell-dlp-04r'});
    expect(loopWires(reopen(d))).toEqual([]);
  });

  it('resolves legacy module-only control assignments without charging the gateway power to a DALI loop', () => {
    const d = fixture();
    d.modules[0].busId = 'CONTROL';
    d.buses[0].deviceModuleIds = [];
    expect(budget(reopen(d))).toBe(9);
    configure(d,'EXT',{1:'PS1',2:'PS2'});
    const n = buildWiring(d);
    expect(n.wires.filter(w=>w.busId==='CONTROL')).toHaveLength(2);
    expect(budget(reopen(d))).toBe(2);
    d.buses.push({id:'LEGACY',type:'dali',budgetUnit:'mA',voltage:16,psuModuleIds:['PS1'],deviceModuleIds:['GW']});
    expect(computeBusBudgets(d,allProducts(d))[1]).toMatchObject({used:null,knownUsed:0});
    const imported = buildWiring(reopen(d));
    expect(imported.wires.filter(w=>w.daliLoop).map(w=>w.daliLoop)).toEqual([2,2]);
    expect(imported.wiringIssues.some(i=>i.code==='DALI_LOOP_SUPPLY_CONFLICT')).toBe(true);
    expect(d.modules[0].daliLoopSupplies).toEqual({1:'PS1',2:'PS2'});
    d.buses = d.buses.filter(b=>b.id !== 'LEGACY');
    expect(loopWires(reopen(d)).map(w=>w.daliLoop)).toEqual([1,1,2,2]);
  });

  it('keeps an entire malformed loop pending while drawing the other output pair', () => {
    const d = fixture();
    configure(d,'EXT',{1:'PS1',2:'PS2'});
    const nodes = new Map(buildWiring(d).nodes.map(n=>[n.id,n]));
    const p = nodes.get('PS1').product;
    expect(isDaliLoopSupply({...p,networkPorts:{count:4}})).toBe(false);
    for (const missing of ['PS1:BUS-','GW:DALI1_PLUS']) {
      const wires = [], issues = [];
      wireDaliLoops({design:d,nodes,port:(id,key) => {
        const portId = `${id}:${key}`;
        return portId === missing ? null : {id:portId};
      }, add:(from,to)=>wires.push([from,to]), pending:code=>issues.push(code)});
      expect(issues).toEqual(['DALI_LOOP_PORT_UNRESOLVED']);
      expect(wires).toEqual([['PS2:BUS+','GW:DALI2_PLUS'],['PS2:BUS-','GW:DALI2_MINUS']]);
      expect(d.modules[0].daliLoopSupplies).toEqual({1:'PS1',2:'PS2'});
    }
  });

  it('retains wire edits for external loops and the legacy Lunatone mains feed when reopening', () => {
    const d = fixture();
    configure(d,'EXT',{1:'PS1'});
    const feed = buildWiring(d).wires.find(w=>w.to==='PS1:L_IN');
    const legacyId = feed.id.replace('PS1:L_IN','PS1:L1_IN');
    const outputId = loopWires(d)[0].id;
    d.disconnected = [legacyId,outputId];
    d.wireOverrides = {[legacyId]:2.5, [outputId]:1.5};
    const n = buildWiring(reopen(d));
    expect(n.wires.find(w=>w.id===legacyId)).toMatchObject({to:'PS1:L_IN',connected:false,section:2.5});
    expect(n.wires.find(w=>w.id===outputId)).toMatchObject({to:'GW:DALI1_PLUS',connected:false,section:1.5});
  });

  it('rejects reused outputs, incompatible power supplies and bypasses through a generic bus', () => {
    const d = fixture(), resolve = id=>findProduct(d,id);
    expect(daliLoopSupplyCandidates(d,'GW',1,resolve).map(m=>m.id)).toEqual(['PS1','PS2']);
    for (const config of [{1:'PS1',2:'PS1'},{1:'CTRL'},{1:'INTONLY'}]) {
      expect(()=>configure(d,'EXT',config)).toThrow();
    }
    expect(()=>configure(d,'INT',{1:'PS1'})).toThrow();
    expect(d.modules[0].daliPowerMode).toBe('INT');
    configure(d,'EXT',{1:'PS1',2:'PS2'});
    expect(daliLoopSupplyCandidates(d,'GW',2,resolve).map(m=>m.id)).toEqual(['PS2']);
    expect(()=>savePsuConnections(d,'PS1',resolve('lunatone-dali-ps-24033444'),['INTONLY'])).toThrow();
    expect(()=>saveBus(d,{id:'DUP', type:'dali',label:'DUP',psuModuleIds:['PS2'],deviceModuleIds:['GW']},resolve)).toThrow();
    d.modules[0].daliLoopSupplies[2] = 'PS1';
    expect(loopWires(reopen(d))).toEqual([]);
    d.modules[0].daliPowerMode = 'bad';
    expect(budget(reopen(d))).toBeNull();
    expect(buildWiring(reopen(d)).wiringIssues.some(i=>i.code==='DALI_POWER_MODE_UNKNOWN')).toBe(true);
  });

  it('never supplies DIN-DLI through an imported DALI loop; the independent control feed survives', () => {
    const d = fixture();
    d.modules[1].daliPowerMode = 'EXT';
    d.modules[1].daliLoopSupplies = {1:'PS1'};
    d.buses.push({id:'LEGACY', type:'dali', psuModuleIds:['PS1'], deviceModuleIds:['INTONLY']});
    const n = buildWiring(reopen(d));
    expect(n.wires.some(w=>w.to.startsWith('INTONLY:'))).toBe(false);
    expect(n.wiringIssues.some(i=>i.code==='DALI_INTERNAL_SUPPLY_CONFLICT')).toBe(true);
    expect(budget(d)).toBe(9);
  });
});
