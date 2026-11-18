import {describe, expect, it} from 'vitest';
import {createBlankDesign,createBreakerPackDesign} from '../../src/data/design-templates.js';
import {allProducts, auditWiring, buildWiring, findProduct, validateDesign} from '../../src/core/domain.js';
import {saveBus, deleteBus} from '../../src/core/bus-editor.js';
import {removeModule} from '../../src/core/modules.js';
import {computeBusBudgets} from '../../src/core/bus-budget.js';
import {auditSmart} from '../../src/core/audit/smart.js';
import {auditElectrical} from '../../src/core/audit/electrical.js';
import {buildBom} from '../../src/core/bom.js';
import {savePsuConnections} from '../../src/core/psu-connections.js';
import {applyLabelRules} from '../../src/core/labels.js';

const data = {id:'NET', type:'cresnet', label:'柜内通信', controllerModuleId:'AP', deviceModuleIds:['D1']};
const dc = {id:'DC', type:'dc', label:'独立控制供电', voltage:24, section:0.82, budgetUnit:'W', psuModuleIds:['PS'], deviceModuleIds:['D1']};
function fixture(count = 1) {
  return createBlankDesign({modules:[
    {id:'AP', productId:'crestron-din-ap4'}, {id:'PS', productId:'meanwell-hdr-100-24n'},
    ...Array.from({length:count}, (_, i) => ({id:`D${i+1}`, productId:'crestron-din-4dimu4-6513187'})),
  ]});
}
const configure = (design, bus) => saveBus(design, bus, id => findProduct(design, id));
const signals = net => net.wires.filter(w => w.cresnet);

function chainFixture(count = 3) {
  const d = createBreakerPackDesign({count:1,productId:'A9D32610'});
  d.modules = fixture(count).modules;
  Object.assign(d.modules.find(m => m.id === 'PS'), {productId:'crestron-din-pws50',protectId:'C01'});
  configure(d, {...data, chainSupplyModuleId:'PS', deviceModuleIds:d.modules.filter(m=>m.id.startsWith('D')).map(m=>m.id),
    cableMeters:24, chainPowerMeters:18});
  return d;
}

describe('Cresnet external power injection and daisy chaining', () => {
  it('uses three conductors up to the supply and four independent cores per subsequent plug', () => {
    const d = validateDesign(chainFixture());
    const net = buildWiring(d), links = signals(net), labels = applyLabelRules(d,net);
    expect(links).toHaveLength(15);
    expect(new Set(links.map(w=>labels.wireTag(w))).size).toBe(15);
    expect(links.slice(0,3).map(w=>[w.from,w.to,w.conductor])).toEqual([
      ['AP:NET_Y','PS:NET_Y','Y'],['AP:NET_Z','PS:NET_Z','Z'],['AP:NET_G','PS:DC-','G']]);
    for (const [index,from] of ['PS','D1','D2'].entries()) {
      const to = `D${index+1}`;
      expect(links.filter(w=>w.moduleId===to).map(w=>[w.from,w.to,w.class,w.section])).toEqual([
        [`${from}:NET2_24`, `${to}:DC+`,'dc',0.82], [`${from}:NET2_Y`, `${to}:NET_Y`,'comms',0.33],
        [`${from}:NET2_Z`, `${to}:NET_Z`,'comms',0.33], [`${from}:NET2_G`, `${to}:DC-`,'dc',0.82]]);
    }
    const mains=net.wires.filter(w=>w.moduleFeed&&w.moduleId==='PS');
    expect(mains.map(w=>w.to)).toEqual(['PS:L_IN','PS:N_IN','PS:PE_IN']);
    expect(net.internal.some(e=>e.node==='PS' && e.a.includes('PE') && e.b.includes('NET'))).toBe(false);
    expect(net.internal.filter(e=>e.node==='PS' && e.cresnetParallel)).toHaveLength(8);
    expect(net.wiringIssues.filter(i=>i.code.startsWith('CRESNET_'))).toEqual([]);
    expect(computeBusBudgets(d,allProducts(d))[0]).toMatchObject({cresnetChain:true,unit:'W',capacity:50,used:10.8,deviceCount:3});
    expect(buildBom(d,net.assembly,net).wires.filter(w=>w.color==='cresnet')).toMatchObject([{meters:24}]);
  });

  it('retains missing-source drafts and never bypasses a missing or repeated intermediate device', () => {
    const d=chainFixture();
    d.buses[0].deviceModuleIds[1]='missing';
    expect(signals(buildWiring(validateDesign(d)))).toHaveLength(0);
    d.buses[0].deviceModuleIds=['D1','D2','D1'];
    expect(signals(buildWiring(validateDesign(d)))).toHaveLength(0);
    removeModule(d,'PS');
    const loaded=validateDesign(d);
    expect(loaded.buses[0].chainSupplyModuleId).toBeNull();
    expect(signals(buildWiring(loaded))).toHaveLength(0);
    expect(buildWiring(loaded).wiringIssues.some(i=>i.code==='CRESNET_CHAIN_SUPPLY_UNRESOLVED')).toBe(true);
  });

  it('blocks additional sources regardless of editor, including duplicate bus IDs on import', () => {
    const d=chainFixture();
    d.modules.push({id:'EXT',productId:'meanwell-hdr-100-24n'});
    expect(()=>configure(d,{...dc,psuModuleIds:['EXT']})).toThrow('供电');
    expect(()=>savePsuConnections(d,'EXT',findProduct(d,'meanwell-hdr-100-24n'),['D2'])).toThrow('重复出线');
    const extra={...dc,id:'NET',psuModuleIds:['EXT']}; d.buses.push(extra);
    const net=buildWiring(validateDesign(d));
    expect(net.wiringIssues.some(i=>i.code==='CRESNET_CHAIN_POWER_CONFLICT')).toBe(true);
    expect(signals(net)).toHaveLength(0);
    expect(net.wires.filter(w=>w.to==='D1:DC+')).toHaveLength(1);
    extra.id='other';
    d.modules.find(m=>m.id==='D1').busId='other';
    configure(d,{...extra,deviceModuleIds:[]});
    expect(signals(buildWiring(d))).toHaveLength(15);
  });

  it('checks the rated sum and the powered portion of the run separately from aggregate data length', () => {
    const d=chainFixture(13);
    expect(signals(buildWiring(d))).toHaveLength(3+4*13);
    const over=chainFixture(14);
    expect(computeBusBudgets(over,allProducts(over))[0]).toMatchObject({overBudget:true,used:50.4});
    expect(buildWiring(over).wiringIssues.some(i=>i.code==='CRESNET_CHAIN_CAPACITY')).toBe(true);
    expect(signals(buildWiring(over))).toHaveLength(0);
    d.buses[0].cableMeters=450;
    expect(signals(buildWiring(d))).toHaveLength(55);
    d.buses[0].chainPowerMeters=50;
    expect(buildWiring(d).wiringIssues.some(i=>i.code==='CRESNET_CHAIN_POWER_LENGTH')).toBe(true);
    d.buses[0].chainPowerMeters=null;
    expect(buildWiring(d).wiringIssues.some(i=>i.code==='CRESNET_CHAIN_LENGTH_REVIEW')).toBe(true);
    d.buses[0].cableMeters=458;
    expect(signals(buildWiring(d))).toHaveLength(0);
  });

  it('preserves switches and catalog conductor sizes when reloading old and new wire settings', () => {
    const d=chainFixture();
    const legacy='module-feed:C01:L1_OUT>PS:L1_IN', core='module-wire:D1:NET2_24>D2:DC+';
    d.disconnected=[legacy,core];d.wireOverrides={[legacy]:2.5,[core]:4};
    const loaded=validateDesign(d);
    const net=buildWiring(loaded);
    expect(net.wires.find(w=>w.id===legacy)).toMatchObject({to:'PS:L_IN',connected:false,section:2.5});
    expect(net.wires.find(w=>w.id===core)).toMatchObject({connected:false,section:0.82});
    expect(auditWiring(net,loaded).some(i=>i.code==='OPEN_WIRE'&&i.wire===core)).toBe(true);
    loaded.disconnected=[];
    expect(buildWiring(loaded).wires.find(w=>w.to==='PS:L_IN').connected).toBe(true);
    configure(loaded,{...data,chainSupplyModuleId:undefined});
    expect(loaded.buses[0]).not.toHaveProperty('chainSupplyModuleId');
    expect(loaded.buses[0]).not.toHaveProperty('chainPowerMeters');
    expect(signals(buildWiring(loaded))).toHaveLength(3);
  });
});

describe('DIN-AP4 to separately powered DIN-4DIMU4 NET connections', () => {
  it.each([[data, dc], [dc, data]])('preserves both assignments in either save order', (first, second) => {
    const d = fixture();
    configure(d, first); configure(d, second);
    const loaded = validateDesign(JSON.parse(JSON.stringify(d)));
    const net = buildWiring(loaded);
    expect(signals(net).map(w => [w.from,w.to,w.conductor,w.section])).toEqual(
      ['Y','Z','G'].map(c => [`AP:NET_${c}`, `D1:NET2_${c}`, c, c === 'G' ? 0.82 : 0.33]));
    expect(net.wires.filter(w => w.class === 'dc').map(w => w.to)).toEqual(['D1:DC+', 'D1:DC-']);
    expect(net.ports['AP:L1_IN']).toBeUndefined();
    expect(auditWiring(net, loaded).some(i => i.wire && signals(net).some(w => w.id === i.wire))).toBe(false);
    const budgets = computeBusBudgets(loaded, allProducts(loaded));
    expect(budgets.find(b => b.id === 'DC').used).toBe(3.6);
    expect(budgets.find(b => b.id === 'NET')).toMatchObject({dataOnly:true, used:null, capacity:null});
    expect([...auditSmart(loaded, net.assembly, budgets), ...auditElectrical(loaded, net.assembly, net, budgets)]
      .filter(i => i.ref === 'NET' && /PSU|BUDGET|PARAMETERS_UNKNOWN/.test(i.code))).toEqual([]);
    deleteBus(loaded, 'NET');
    expect(buildWiring(loaded).wires.filter(w => w.class === 'dc')).toHaveLength(2);
  });

  it('uses a different physical G per conductor and models only corresponding internal NET pins', () => {
    const d = fixture(3);
    configure(d, {...data, deviceModuleIds:['D2','D1','D3']});
    configure(d, {...dc, deviceModuleIds:['D1','D2','D3','AP']});
    const net = buildWiring(d);
    expect(signals(net).map(w => [w.from, w.to])).toEqual(['Y','Z','G'].map(c => [`AP:NET_${c}`, `D2:NET2_${c}`])
      .concat(['Y','Z','G'].map(c => [`AP:NET2_${c}`, `D1:NET2_${c}`])));
    expect(net.wiringIssues.some(i => i.moduleId === 'D3' && i.code === 'CRESNET_DISTRIBUTION_REQUIRED')).toBe(true);
    expect(net.ports['AP:DC-'].displayTag).toBe('AP.PWR-G');
    expect(net.internal.filter(e => e.node === 'D1' && e.cresnetParallel).map(e => [e.a, e.b])).toEqual([
      ['D1:DC+','D1:NET2_24'], ['D1:NET_Y','D1:NET2_Y'], ['D1:NET_Z','D1:NET2_Z'], ['D1:DC-','D1:NET2_G']]);
    expect(net.wires.some(w => /^AP:(?:NET2?_24|DC\+)/.test(w.from))).toBe(false);
    expect(net.wires.filter(w => w.class === 'dc')).toHaveLength(8);
    expect(net.internal.filter(e => e.cresnetParallel).every(e => e.always && e.a.split(':')[0] === e.b.split(':')[0])).toBe(true);
  });

  it('does not create links for legacy budgets, unverified model numbers, or a deleted controller', () => {
    const d = fixture();
    d.buses = [{...data, controllerModuleId:'PS'}];
    expect(signals(buildWiring(d))).toHaveLength(0);
    d.buses = [{...dc, type:'cresnet'}];
    expect(signals(buildWiring(d))).toHaveLength(0);
    expect(computeBusBudgets(d, allProducts(d))[0].used).toBe(3.6);
    d.buses = [{...data}];
    d.modules[2].productId = 'crestron-din-4dimu4';
    expect(signals(buildWiring(d))).toHaveLength(0);
    removeModule(d, 'AP');
    const loaded = validateDesign(d);
    expect(loaded.buses[0].controllerModuleId).toBeNull();
    expect(buildWiring(loaded).wiringIssues.some(i => i.code === 'CRESNET_CONTROLLER_UNRESOLVED')).toBe(true);
  });

  it('rejects conflicting bus membership and does not infer a positive supply from data', () => {
    const d = fixture(); configure(d, data);
    expect(() => configure(d, {...data, id:'NET2'})).toThrow('其他总线');
    expect(() => configure(d, {...data, psuModuleIds:['PS']})).toThrow();
    const noPower = buildWiring(d);
    expect(signals(noPower)).toHaveLength(3);
    expect(noPower.wires.some(w => w.to === 'D1:DC+')).toBe(false);
    expect(noPower.wiringIssues.some(i => i.code === 'CRESNET_CONTROL_POWER_REQUIRED')).toBe(true);
    d.buses.push({...data, id:'other', controllerModuleId:'another'});
    expect(signals(buildWiring(d))).toHaveLength(0);
  });

  it('retains a disconnected data wire and the specified cable gauge after reload', () => {
    const d = fixture(); configure(d, data);
    const y = signals(buildWiring(d))[0];
    d.disconnected = [y.id]; d.wireOverrides[y.id] = 6;
    const loaded = validateDesign(d);
    const net = buildWiring(loaded);
    expect(net.wires.find(w => w.id === y.id)).toMatchObject({connected:false, section:0.33});
    expect(auditWiring(net,loaded)).toContainEqual(expect.objectContaining({code:'OPEN_WIRE', wire:y.id}));
  });

  it('counts a single entered cable length and flags runs exceeding the network limit', () => {
    const d = fixture(); configure(d, {...data, cableMeters:7});
    const net = buildWiring(d);
    const bom = buildBom(d,net.assembly,net);
    expect(bom.wires.filter(w => w.color === 'cresnet')).toMatchObject([{meters:7}]);
    expect(bom.wires.filter(w => w.class === 'comms')).toEqual([]);
    d.buses[0].cableMeters = 458;
    const tooLong = buildWiring(d);
    expect(signals(tooLong)).toHaveLength(0);
    expect(tooLong.wiringIssues.some(i => i.code === 'CRESNET_LENGTH_LIMIT')).toBe(true);
  });
});
