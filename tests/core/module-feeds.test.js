import {describe, it, expect} from 'vitest';
import {createDefaultDesign, buildWiring, buildAssembly, simulate} from '../../src/core/domain.js';
import {normalizeModule} from '../../src/core/modules.js';
import {applyModuleFeeds, resolveModuleFeedBindings} from '../../src/core/module-feeds.js';

function fixture(products = ['crestron-din-8sw8-i', 'crestron-din-1dimu4']) {
  const design = createDefaultDesign();
  design.uiMode = 'simple';
  design.includeSpd = false;
  design.circuits = design.circuits.filter(c => c.voltage === 220).slice(0, 3);
  design.modules = products.map((productId, i) => normalizeModule({id: `K${i + 1}`, productId}));
  return design;
}

describe('module breaker feeds', () => {
  it('keeps 24V controller inputs separate from the simple-mode mains load feeder', () => {
    const design=fixture([]);
    design.customProducts.push({id:'USR-DIMMER',name:'24V dimmer',kind:'dimmer',width:144,height:90,depth:60,modules:8,channels:4,powerInput:'24vdc',loadPowerInput:'LN'});
    design.modules=[normalizeModule({id:'D1',productId:'USR-DIMMER',protectId:design.circuits[0].id}),normalizeModule({id:'PS1',productId:'meanwell-hdr-100-24n'})];
    design.buses=[{id:'DC',type:'dc',voltage:24,section:.75,psuModuleIds:['PS1'],deviceModuleIds:['D1']}];
    const net=buildWiring(design),cid=design.circuits[0].id;
    expect(net.wires.find(w=>w.moduleFeed&&w.moduleId==='D1'&&w.conductor!=='N')).toMatchObject({from:`${cid}:L1_OUT`,scope:'空开 → 负载供电'});
    expect(net.wires.find(w=>w.to==='D1:N_IN').from).toBe(`${cid}:N_OUT`);
    expect(net.wires.find(w=>w.to==='D1:DC+')).toMatchObject({from:'PS1:DC+',class:'dc'});
    expect(net.wires.find(w=>w.to==='D1:DC-')).toMatchObject({from:'PS1:DC-',class:'dc'});
    expect(net.internal.some(w=>[w.a,w.b].some(p=>p.startsWith('D1:DC')))).toBe(false);
  });
  it('does not change designs without shared modules', () => {
    const design = createDefaultDesign(), net = buildWiring(design);
    expect(applyModuleFeeds(net, design)).toBe(net);
  });
  it('pairs physical branch order one to one and never consumes the main breaker', () => {
    const design = fixture();
    const assembly = buildAssembly(design);
    const branches = assembly.nodes.filter(n => n.role === 'branch');
    branches[0].slot = 20;
    branches[1].slot = 3;
    const bindings = resolveModuleFeedBindings(assembly, design);
    expect(bindings[0].breakerId).toBe(branches[1].id);
    expect(new Set(bindings.map(b => b.breakerId)).size).toBe(2);
    expect(bindings.some(b => b.breakerId === 'Q0')).toBe(false);
  });
  it('reserves explicit assignments and does not reassign invalid or duplicate explicit choices', () => {
    const design = fixture();
    design.modules[1].protectId = design.circuits[0].id;
    let bindings = resolveModuleFeedBindings(buildAssembly(design), design);
    expect(bindings.find(b => b.moduleId === 'K2').breakerId).toBe(design.circuits[0].id);
    expect(bindings.find(b => b.moduleId === 'K1').breakerId).not.toBe(design.circuits[0].id);
    design.modules[0].protectId = 'Q0';
    expect(resolveModuleFeedBindings(buildAssembly(design), design)).toHaveLength(1);
    design.modules[0].protectId = design.circuits[0].id;
    expect(resolveModuleFeedBindings(buildAssembly(design), design)).toHaveLength(1);
  });
  it('leaves excess modules unconnected and skips low voltage gateways and terminals', () => {
    const design = fixture(['crestron-din-ap4', 'crestron-din-8sw8-i', 'crestron-din-1dimu4', 'phoenix-pt25-bu-1']);
    design.circuits = design.circuits.slice(0, 1);
    expect(resolveModuleFeedBindings(buildAssembly(design), design).map(b => b.moduleId)).toEqual(['K2']);
    design.circuits = [];
    expect(resolveModuleFeedBindings(buildAssembly(design), design)).toEqual([]);
  });
  it('keeps full mode opt-in and tolerates an uninitialized assembly', () => {
    const design = fixture();
    design.uiMode = 'full';
    expect(resolveModuleFeedBindings(undefined, design)).toEqual([]);
    expect(resolveModuleFeedBindings(buildAssembly(design), design)).toEqual([]);
    design.modules[0].protectId = design.circuits[0].id;
    expect(resolveModuleFeedBindings(buildAssembly(design), design)).toHaveLength(1);
  });
  it('adds phase feeds, preserves relay neutral, connects dimmer neutral and leaves saved data unchanged', () => {
    const design = fixture(), before = structuredClone(design);
    const net = applyModuleFeeds(buildWiring(design), design);
    const feeds = net.wires.filter(w => w.moduleFeed);
    expect(feeds.filter(w => w.conductor !== 'N')).toHaveLength(2);
    expect(feeds.filter(w => w.moduleId === 'K1' && w.conductor === 'N')).toHaveLength(0);
    expect(feeds.filter(w => w.moduleId === 'K2' && w.conductor === 'N')).toHaveLength(1);
    const binding = net.moduleFeedBindings.find(b => b.moduleId === 'K1');
    expect(net.wires.some(w => w.to === `X-${binding.breakerId}:N`)).toBe(true);
    const neutral=net.wires.find(w=>w.to===`X-${binding.breakerId}:N`);
    expect(neutral).toMatchObject({moduleNeutral:true,moduleId:'K1',breakerId:binding.breakerId,conductor:'N'});
    expect(neutral.moduleFeed).not.toBe(true);
    expect(net.ports['K1:N_IN']).toBeUndefined();
    expect(net.wires.some(w => w.to === `X-${binding.breakerId}:${binding.phase}`)).toBe(false);
    expect(design).toEqual(before);
  });
  it('keeps DIN8SW8 load neutral on its real RCD output and preserves circuit simulation',()=>{
    const design=fixture(['crestron-din-8sw8-i']),circuit=design.circuits[0];
    design.customProducts.push({id:'USR-RCD',name:'Test RCD',kind:'rccb',poles:2,width:36,depth:70,modules:2,amps:40,neutralSide:'right'});
    circuit.rcdProductId='USR-RCD';design.modules[0].protectId=circuit.id;
    const net=buildWiring(design),neutral=net.wires.find(w=>w.moduleNeutral);
    expect(neutral.from.startsWith(`${circuit.id}-RCD:`)).toBe(true);
    expect(neutral.to).toBe(`X-${circuit.id}:N`);
    expect(net.internal.some(w=>w.moduleFeed&&w.b===neutral.to)).toBe(false);
    expect(simulate(net,design,{power:true}).circuits[circuit.id].powered).toBe(true);
    neutral.connected=false;
    expect(simulate(net,design,{power:true}).circuits[circuit.id].powered).toBe(false);
  });
  it('preserves circuit supply simulation and cuts it when the new feed is disconnected', () => {
    const design = fixture();
    const net = applyModuleFeeds(buildWiring(design), design);
    const feed = net.wires.find(w => w.moduleFeed && w.conductor !== 'N');
    expect(simulate(net, design, {power: true}).circuits[feed.breakerId].powered).toBe(true);
    feed.connected = false;
    expect(simulate(net, design, {power: true}).circuits[feed.breakerId].powered).toBe(false);
  });
  it('rebuilds persisted feed disconnection and wire section overrides', () => {
    const design = fixture();
    const original = buildWiring(design);
    const feed = original.wires.find(w => w.moduleFeed && w.conductor !== 'N');
    design.disconnected.push(feed.id);
    design.wireOverrides[feed.id] = 6;
    const net = buildWiring(design);
    expect(net.wires.find(w => w.id === feed.id)).toMatchObject({connected: false, section: 6});
    expect(simulate(net, design, {power: true}).circuits[feed.breakerId].powered).toBe(false);
  });
  it('uses the associated RCD for both conductors without borrowing another branch neutral', () => {
    const design = fixture(['crestron-din-1dimu4']);
    const circuit = design.circuits[0];
    design.customProducts.push({id: 'USR-RCD', name: 'Test RCD', kind: 'rccb', poles: 2,
      width: 36, depth: 70, modules: 2, amps: 40, neutralSide: 'right'});
    circuit.rcdProductId = 'USR-RCD';
    design.modules[0].protectId = circuit.id;
    const net = applyModuleFeeds(buildWiring(design), design);
    expect(net.wires.filter(w => w.moduleFeed)).toHaveLength(2);
    expect(net.wires.filter(w => w.moduleFeed).every(w => w.from.startsWith(`${circuit.id}-RCD:`))).toBe(true);
  });
  it('keeps L2 phase identity and does not automatically feed a single phase module from a 380V branch', () => {
    const design = fixture(['crestron-din-1dimu4']);
    design.supply = 'three';
    design.circuits[0].phase = 'L2';
    design.modules[0].protectId = design.circuits[0].id;
    const net = applyModuleFeeds(buildWiring(design), design);
    expect(net.wires.find(w => w.moduleFeed && w.conductor !== 'N').conductor).toBe('L2');
    design.circuits[0].voltage = 380;
    design.circuits[0].phase = 'ABC';
    expect(resolveModuleFeedBindings(buildAssembly(design), design)).toEqual([]);
  });
});
