import { describe, expect, it } from 'vitest';
import { CRESTRON_PRODUCTS } from '../../src/data/products/smart-crestron.js';
import { auditWiring, buildWiring, createDefaultDesign, findProduct, simulate, validateDesign } from '../../src/core/domain.js';
import { createBreakerPackDesign } from '../../src/data/design-templates.js';
import { normalizeModule } from '../../src/core/modules.js';
import { buildPortTemplates } from '../../src/core/ports.js';
import { DIMMER_BRIDGE_MODES, dimmerOutputGroups } from '../../src/core/dimmer-bridging.js';
import { outputOptions, saveTerminalRows, terminalRows } from '../../src/core/terminal-connections.js';
import { computeBusBudgets } from '../../src/core/buses.js';
import { buildDeliveryNet } from '../../src/core/delivery-net.js';
import { toCsv, wireRows } from '../../src/core/handover.js';

const product = sku => CRESTRON_PRODUCTS.find(p => p.sku === sku);
const verifiedDimmer = product('DIN-4DIMU4 / 6513187');
const phases = ['L1', 'L2', 'L3', 'L1'];
const moduleWires = (net, id = 'D1') => net.wires.filter(w => w.from.startsWith(`${id}:`) || w.to.startsWith(`${id}:`));

function independentFixture(uiMode = 'full') {
  const design = createBreakerPackDesign({ count: 5, productId: 'A9D32610' });
  design.uiMode = uiMode;
  design.supply = 'three';
  design.includeSpd = false;
  design.circuits.slice(0, 4).forEach((circuit, index) => { circuit.phase = phases[index]; });
  const channels = Object.fromEntries(design.circuits.slice(0, 4).map((circuit, index) => [index + 1, circuit.id]));
  design.modules = [
    normalizeModule({id: 'D1', productId: verifiedDimmer.id, feed: 'perChannel', channels}, verifiedDimmer),
    normalizeModule({id: 'PS1', productId: 'meanwell-hdr-100-24n'}),
    normalizeModule({id: 'T1', productId: 'phoenix-pt25-gy-4'}),
  ];
  design.buses = [{id: 'DC1', type: 'dc', voltage: 24, section: .75, psuModuleIds: ['PS1'], deviceModuleIds: ['D1']}];
  return design;
}

describe('Crestron official catalog integration', () => {
  it.each([
    ['DIN-8SW8-I', 5.4], ['DIN-1DIM4', 0.6], ['DIN-1DIMU4', 0.6],
    ['DIN-4DIMFLV4', 4.2], ['DIN-2MC2', 3],
  ])('%s separates control power from load mains', (sku, watts) => {
    expect(product(sku)).toMatchObject({
      powerInput: '24vdc', loadPowerInput: 'LN', busConsumption: { value: watts, unit: 'W' },
    });
  });

  it('preserves the qualified NET consumption and DALI supply restrictions', () => {
    for (const sku of ['DIN-1DIM4', 'DIN-1DIMU4']) {
      expect(product(sku).busConsumption.condition).toContain('市电缺失');
    }
    expect(product('DIN-DLI')).toMatchObject({ powerInput: '24vdc-or-poe', loadPowerInput: null, daliPowerSupply: 'internal-only', busConsumption: { value: 6, unit: 'W' } });
    expect(product('DIN-DALI-2')).toMatchObject({ powerInput: '24vdc-or-poe', loadPowerInput: null, daliPowerSupply: 'switchable', busConsumption: { value: 9, unit: 'W' } });
    expect(product('DIN-PWS50')).toMatchObject({ powerInput: 'LN', loadPowerInput: null, daliPowerSupply: null });
    expect(product('DIN-4DIMU4')).toMatchObject({ powerInput: 'LN', loadPowerInput: null });
  });

  it.each(['DIN-1DIMU4', 'DIN-1DIM4'])('%s exposes all four outputs to module editing and terminal wiring', sku => {
    const p = product(sku);
    const mod = normalizeModule({ id: 'D1', productId: p.id, channels: { 1: 'C1' }, channelLabels: { 1: '原回路' }, channelTerminals: { 1: 'T1:1' } }, p);
    expect(mod.channels).toEqual({ 1: 'C1', 2: null, 3: null, 4: null });
    expect(mod.channelLabels[1]).toBe('原回路');
    expect(mod.channelTerminals).toEqual({ 1: 'T1:1', 2: null, 3: null, 4: null });
    expect(buildPortTemplates(p).filter(port => port.io === 'out' && port.conductor === 'L').map(port => port.key))
      .toEqual(['CH1_OUT', 'CH2_OUT', 'CH3_OUT', 'CH4_OUT']);
    expect(outputOptions({ modules: [mod] }, () => p).map(option => option.value))
      .toEqual(['D1:CH1_OUT', 'D1:CH2_OUT', 'D1:CH3_OUT', 'D1:CH4_OUT']);
  });

  it.each(['DIN-AP4', 'DIN-DALI-2', 'DIN-DLI'])('%s does not offer nonexistent mains input terminals', sku => {
    expect(buildPortTemplates(product(sku)).some(port => ['L_IN', 'N_IN'].includes(port.key))).toBe(false);
  });

  it('exposes the DIN-AP4 PWR input and both physical NET blocks in front-view order', () => {
    const ports = buildPortTemplates(product('DIN-AP4'));
    expect(ports.map(({key, marking}) => [key, marking])).toEqual([
      ['DC+', 'PWR-24'], ['DC-', 'PWR-G'],
      ['NET_24', 'NET-24'], ['NET_Y', 'NET-Y'], ['NET_Z', 'NET-Z'], ['NET_G', 'NET-G'],
      ['NET2_24', 'NET2-24'], ['NET2_Y', 'NET2-Y'], ['NET2_Z', 'NET2-Z'], ['NET2_G', 'NET2-G'],
      ...['G','TX','RX','RTS','CTS'].map(pin=>['COM1_'+pin,'COM1-'+pin]),
    ]);
    expect(ports.every((p, i) => p.side === 'bottom' && (!i || p.offsetX > ports[i - 1].offsetX))).toBe(true);
  });

  it('keeps physical widths separate from reserved DIN module spaces', () => {
    for (const [sku, width, modules] of [['DIN-AP4', 161, 9], ['DIN-8SW8-I', 159, 9], ['DIN-4DIMFLV4', 159, 9], ['DIN-DALI-2', 159, 9], ['DIN-2MC2', 106, 6], ['DIN-PWS50', 106, 6]]) {
      expect(product(sku)).toMatchObject({ width, modules });
    }
  });

  it('budgets the three shared PWS50 ports as one 50 W supply', () => {
    const psu = product('DIN-PWS50'), relay = product('DIN-8SW8-I');
    const [budget] = computeBusBudgets({ modules: [{ id: 'PS1', productId: psu.id }, { id: 'K1', productId: relay.id }], buses: [{ id: 'B1', type: 'cresnet', psuModuleIds: ['PS1'], deviceModuleIds: ['K1'] }] }, CRESTRON_PRODUCTS);
    expect(budget).toMatchObject({ capacity: 50, used: 5.4, unit: 'W', overBudget: false });
  });

  it('keeps DIN-PWS50 mains and the three four-pin NET blocks in front-panel order', () => {
    const ports = buildPortTemplates(product('DIN-PWS50'));
    const top = ports.filter(p => p.side === 'top'), bottom = ports.filter(p => p.side === 'bottom');
    expect(top.map(p => p.key)).toEqual(['L_IN','N_IN','PE_IN','L_THRU','N_THRU','PE_THRU']);
    expect(bottom.map(p => p.key)).toEqual([
      'DC+','NET_Y','NET_Z','DC-',
      'NET2_24','NET2_Y','NET2_Z','NET2_G',
      'NET3_24','NET3_Y','NET3_Z','NET3_G',
    ]);
    expect(bottom.map(p => p.marking)).toEqual(['NET','NET2','NET3'].flatMap(block =>
      ['24','Y','Z','G'].map(pin => `${block}-${pin}`)));
    for (const side of [top,bottom]) {
      expect(side.every((p,i) => !i || p.offsetX > side[i-1].offsetX)).toBe(true);
    }
    expect(top.every(p => p.offsetX < 0)).toBe(true);
    expect(bottom.every(p => p.offsetX > 0)).toBe(true);
  });

  it('retains the unverified historical model without claiming official verification', () => {
    const legacy = product('DIN-4DIMU4');
    expect(legacy).toMatchObject({ id: 'crestron-din-4dimu4', width: 216, height: 95, depth: 60, modules: 12 });
    expect(legacy.availability).toContain('未获官网核实');
    expect(buildPortTemplates(legacy).map(p => p.key)).toEqual(expect.arrayContaining(['L_IN', 'N_IN', 'CH4_OUT']));
    expect(normalizeModule({ id: 'D1', productId: legacy.id, channels: { 4: 'C4' } }, legacy).channels[4]).toBe('C4');
  });

  it('uses the sourced 6M dimensions and control budget of the exact 6513187 SKU', () => {
    expect(verifiedDimmer).toMatchObject({
      id: 'crestron-din-4dimu4-6513187', width: 106, height: 94, depth: 60, modules: 6, channels: 4,
      powerInput: '24vdc', loadPowerInput: 'independent-LN', protocol: ['cresnet'],
      busConsumption: { value: 3.6, unit: 'W' }, channelAmps: null, channelWatts: null, amps: null,
      source: { file: expect.stringContaining('9454A'), url: expect.stringContaining('mg_pm_din-4dimu4') },
    });
    const ports = buildPortTemplates(verifiedDimmer);
    expect(ports.filter(p => p.side === 'top').map(p => p.marking)).toEqual(
      [1, 2, 3, 4].flatMap(ch => [`CH${ch}-N`, `CH${ch}-L`, `CH${ch}-D`]),
    );
    expect(ports.filter(p => p.side === 'bottom').map(p => [p.key, p.marking])).toEqual([
      ['DC+', 'NET-24'], ['NET_Y', 'NET-Y'], ['NET_Z', 'NET-Z'], ['DC-', 'NET-G'],
      ['NET2_24', 'NET2-24'], ['NET2_Y', 'NET2-Y'], ['NET2_Z', 'NET2-Z'], ['NET2_G', 'NET2-G'],
    ]);
  });

  it.each(['simple', 'full'])('routes four separate branch pairs and separate control DC in %s mode', uiMode => {
    const design = independentFixture(uiMode);
    const net = buildWiring(design);
    const wires = moduleWires(net);
    expect(wires).toHaveLength(18);
    expect(Object.values(net.ports).filter(port => port.node === 'D1')).toHaveLength(20);
    expect(net.moduleFeedBindings.filter(binding => binding.moduleId === 'D1')).toHaveLength(4);
    if (uiMode === 'simple') {
      expect(net.moduleFeedBindings.find(binding => binding.moduleId === 'PS1')?.breakerId).toBe('C05');
    }
    for (const [index, {id}] of design.circuits.slice(0, 4).entries()) {
      const ch = index + 1;
      const phase = phases[index];
      expect(wires.filter(wire => wire.circuit === id).map(wire => [wire.from, wire.to, wire.conductor, wire.class])).toEqual([
        [`${id}:${phase}_OUT`, `D1:CH${ch}_IN`, phase, 'power'],
        [`${id}:N_OUT`, `D1:CH${ch}_N`, 'N', 'power'],
        [`D1:CH${ch}_OUT`, `X-${id}:${phase}`, phase, 'power'],
        [`D1:CH${ch}_N`, `X-${id}:N`, 'N', 'power'],
      ]);
      expect(net.ports[`D1:CH${ch}_OUT`]).toMatchObject({ side: 'top', displayTag: `D1.CH${ch}-D`, maxWire: 2.5 });
    }
    expect(net.internal.filter(link => link.node === 'D1' && link.moduleChannel).map(link => [link.a, link.b])).toEqual(
      [1, 2, 3, 4].map(ch => [`D1:CH${ch}_IN`, `D1:CH${ch}_OUT`]),
    );
    expect(wires.filter(wire => wire.class === 'dc').map(wire => [wire.from, wire.to])).toEqual([
      ['PS1:DC+', 'D1:DC+'], ['PS1:DC-', 'D1:DC-'],
    ]);
    expect(net.ports['D1:DC-']).toMatchObject({ side: 'bottom', displayTag: 'D1.NET-G' });
    expect(net.wiringIssues).toContainEqual(expect.objectContaining({ code: 'MODULE_INDEPENDENT_JUMPERS', moduleId: 'D1' }));
    const {circuits} = simulate(net, design, {power: true, trip: 'C02'});
    expect(circuits.C02).toMatchObject({powered: false, neutralOk: false});
    for (const id of ['C01', 'C03', 'C04']) expect(circuits[id]).toMatchObject({powered: true, neutralOk: true});
  });

  it('derives the neutral from the same protection path, including a separate RCD and a 1P branch', () => {
    const design = independentFixture();
    design.circuits[0].productId = 'A9F74116';
    design.circuits[0].rcdProductId = 'A9R61440';
    design.circuits[1].productId = 'A9F74116';
    const net = buildWiring(design);
    expect(net.wires.find(w => w.to === 'D1:CH1_IN').from).toBe('C01-RCD:L1_OUT');
    expect(net.wires.find(w => w.to === 'D1:CH1_N').from).toBe('C01-RCD:N_OUT');
    expect(net.wires.find(w => w.to === 'D1:CH2_N')).toMatchObject({
      from: 'N:N-C02', protect: net.wires.find(w => w.to === 'D1:CH2_IN').protect,
    });
  });

  it('rejects duplicate, occupied and 380V sources while retaining valid channel and DC wires', () => {
    const design = independentFixture();
    design.modules[0].channels[2] = 'C01';
    design.modules[1].protectId = 'C03';
    const threePhaseCircuit = createDefaultDesign().circuits.find(c => c.voltage === 380);
    design.circuits.push(threePhaseCircuit);
    design.modules[0].channels[4] = threePhaseCircuit.id;
    const net = buildWiring(design);
    expect(net.wiringIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MODULE_INDEPENDENT_FEED_CONFLICT', circuit: 'C01' }),
      expect.objectContaining({ code: 'MODULE_INDEPENDENT_FEED_CONFLICT', circuit: 'C03' }),
      expect.objectContaining({ code: 'MODULE_INDEPENDENT_FEED_INVALID', circuit: threePhaseCircuit.id }),
    ]));
    expect(moduleWires(net).every(wire => wire.class === 'dc')).toBe(true);
    design.modules[0].channels[2] = 'C02';
    expect(moduleWires(buildWiring(design)).filter(wire => wire.circuit === 'C02')).toHaveLength(4);
  });

  it('requires an explicit per-channel configuration and preserves stored unconnected terminal references', () => {
    const design = independentFixture();
    design.modules[0].feed = 'shared';
    design.modules[2].terminalConnections[1] = {output: 'D1:CH1_OUT'};
    const resolve = id => findProduct(design, id);
    const net = buildWiring(design);
    expect(moduleWires(net).every(wire => wire.class === 'dc')).toBe(true);
    expect(net.wiringIssues.map(issue => issue.code)).toContain('MODULE_INDEPENDENT_FEED_REQUIRED');
    expect(outputOptions(design, resolve)).toEqual([]);
    const savedRows = terminalRows(design, resolve);
    expect(savedRows[0].output).toBe('D1:CH1_OUT');
    expect(() => saveTerminalRows(design, savedRows, resolve)).toThrow('所选输出通道已不存在');
    const delivery = buildDeliveryNet(design, net.assembly, net);
    expect(delivery.wiringIssues.map(i => i.code)).toContain('TERMINAL_CONNECTION_UNRESOLVED');
    expect(delivery.wires.some(w => w.terminalConnection)).toBe(false);
  });

  it('replaces the virtual phase output with the real gray terminal without changing the neutral', () => {
    const design = independentFixture();
    const resolve = id => findProduct(design, id);
    expect(outputOptions(design, resolve).map(option => option.value)).toContain('D1:CH2_OUT');
    const rows = terminalRows(design, resolve);
    rows[1].output = 'D1:CH2_OUT';
    saveTerminalRows(design, rows, resolve);
    const net = buildWiring(design);
    const delivery = buildDeliveryNet(design, net.assembly, net);
    expect(delivery.wires.find(wire => wire.from === 'D1:CH2_OUT')).toMatchObject({
      to: 'T1:2', conductor: 'L2', terminalConnection: true, circuit: 'C02',
    });
    expect(delivery.wires.find(wire => wire.from === 'D1:CH2_N').to).toBe('X-C02:N');
    const csv = toCsv(wireRows(delivery));
    expect(csv).toContain('"D1:CH2_OUT","","T1:2"');
    expect(csv).not.toContain('"D1:CH2_OUT","","X-C02:L2"');
  });
});

const officialGroups = [
  ['0000', [[1], [2], [3], [4]]],
  ['1100', [[1, 2], [3], [4]]],
  ['0011', [[1], [2], [3, 4]]],
  ['1010', [[1, 3], [2], [4]]],
  ['1110', [[1, 2, 3], [4]]],
  ['1001', [[1, 4], [2], [3]]],
  ['1101', [[1, 2, 4], [3]]],
  ['1111', [[1, 2, 3, 4]]],
  ['1122', [[1, 2], [3, 4]]],
];

function bridgeFixture(mode, groups) {
  const design = independentFixture();
  design.modules[0] = normalizeModule({
    ...design.modules[0], bridgeMode: mode,
    channels: Object.fromEntries(groups.map(([leader]) => [leader, `C0${leader}`])),
  }, verifiedDimmer);
  return design;
}

describe('DIN-4DIMU4 bridge wiring (Doc. 9454A)', () => {
  it('accepts the nine official programming patterns and preserves an invalid import as unresolved', () => {
    expect(DIMMER_BRIDGE_MODES).toEqual(officialGroups.map(([mode]) => mode));
    for (const [mode, groups] of officialGroups) expect(dimmerOutputGroups(mode)).toEqual(groups);
    expect(dimmerOutputGroups(11)).toEqual([[1], [2], [3, 4]]);
    const design = validateDesign(bridgeFixture('1212', [[1]]));
    expect(design.modules[0].bridgeMode).toBeNull();
    const net = buildWiring(design);
    expect(moduleWires(net)).toHaveLength(2);
    expect(moduleWires(net).every(w => w.class === 'dc')).toBe(true);
    expect(net.wiringIssues).toContainEqual(expect.objectContaining({code: 'MODULE_DIMMER_BRIDGE_INVALID', moduleId: 'D1'}));
  });

  it.each(officialGroups.filter(([mode]) => ['1100', '0011', '1110', '1111', '1122'].includes(mode)))
    ('%s uses one protected source, one load, and three same-role jumpers per adjacent connection', (mode, groups) => {
      const design = validateDesign(bridgeFixture(mode, groups));
      expect(design.modules[0].bridgeMode).toBe(mode);
      const net = buildWiring(design);
      for (const [leader, ...members] of groups) {
        const circuit = `C0${leader}`;
        const phase = phases[leader - 1];
        const last = members.at(-1) ?? leader;
        const wires = moduleWires(net).filter(w => w.circuit === circuit);
        const endpoints = wires.filter(w => !w.bridgeJumper).map(w => [w.from, w.to]);
        expect(endpoints).toEqual([
          [`${circuit}:${phase}_OUT`, `D1:CH${leader}_IN`],
          [`${circuit}:N_OUT`, `D1:CH${leader}_N`],
          [`D1:CH${leader}_OUT`, `X-${circuit}:${phase}`],
          [`D1:CH${last}_N`, `X-${circuit}:N`],
        ]);
        const chain = [leader, ...members];
        expect(wires.filter(w => w.bridgeJumper).map(w => [w.from, w.to, w.conductor, w.material, w.section]))
          .toEqual(members.flatMap((next, index) =>
            [['IN', phase, '2065817'], ['N', 'N', '2065818'], ['OUT', phase, '2065819']].map(([pin, conductor, part]) => [
              `D1:CH${chain[index]}_${pin}`, `D1:CH${next}_${pin}`, conductor, `厂家跨接件 ${part}`, null,
            ]),
          ));
      }
      expect(moduleWires(net).filter(w => w.class === 'dc').map(w => [w.from, w.to])).toEqual([
        ['PS1:DC+', 'D1:DC+'], ['PS1:DC-', 'D1:DC-'],
      ]);
    });

  it.each(officialGroups.filter(([mode]) => ['1010', '1001', '1101'].includes(mode)))
    ('%s saves the valid firmware setting while wiring only independent channels', (mode, groups) => {
      const design = bridgeFixture(mode, groups);
      const net = buildWiring(design);
      const singles = groups.filter(group => group.length === 1).map(([leader]) => `C0${leader}`);
      expect(moduleWires(net).filter(w => w.class === 'power')).toHaveLength(singles.length * 4);
      expect(moduleWires(net).filter(w => w.class === 'power').every(w => singles.includes(w.circuit))).toBe(true);
      expect(moduleWires(net).filter(w => w.class === 'dc')).toHaveLength(2);
      expect(net.wiringIssues).toContainEqual(expect.objectContaining({code: 'MODULE_DIMMER_BRIDGE_JUMPER_UNVERIFIED'}));
      expect(net.wires.filter(w => net.ports[w.to]?.node === 'X-C01').map(w => w.conductor)).toEqual(['PE']);
      expect(simulate(net, design, {power: true}).circuits.C01.powered).toBe(false);
      expect(outputOptions(design, id => findProduct(design, id)).map(o => o.value)).toEqual(
        groups.filter(group => group.length === 1).map(([leader]) => `D1:CH${leader}_OUT`),
      );
    });

  it('holds an occupied bridge group pending without changing the other group', () => {
    const design = bridgeFixture('1122', [[1, 2], [3, 4]]);
    design.modules[2].terminalConnections[1] = {output: 'D1:CH2_OUT'};
    const net = buildWiring(design);
    expect(net.wiringIssues).toContainEqual(expect.objectContaining({code: 'MODULE_DIMMER_BRIDGE_CHANNEL_CONFLICT', circuit: 'C01'}));
    expect(moduleWires(net).filter(w => w.circuit === 'C01')).toHaveLength(0);
    expect(moduleWires(net).filter(w => w.circuit === 'C03')).toHaveLength(7);
    expect(buildDeliveryNet(design, net.assembly, net).wires.some(w => w.terminalConnection)).toBe(false);
    design.modules[2].terminalConnections = {};
    design.modules[0].channels[3] = 'C01';
    expect(moduleWires(buildWiring(design)).every(w => w.class === 'dc')).toBe(true);
  });

  it('audits a fixed factory jumper for continuity without applying a wire gauge', () => {
    const design = bridgeFixture('1100', [[1, 2], [3], [4]]);
    const first = buildWiring(design);
    const jumper = first.wires.find(w => w.bridgeTerminal === 'N');
    expect(jumper).toBeTruthy();
    expect(auditWiring(first, design).some(issue => issue.wire === jumper.id)).toBe(false);
    design.disconnected = [jumper.id];
    design.wireOverrides = {[jumper.id]: 10};
    const disconnected = buildWiring(design);
    expect(disconnected.wires.find(w => w.id === jumper.id)).toMatchObject({connected: false, section: null});
    expect(auditWiring(disconnected, design)).toEqual(expect.arrayContaining([
      expect.objectContaining({code: 'OPEN_WIRE', wire: jumper.id}),
      expect.objectContaining({code: 'N_CONTINUITY', circuit: 'C01'}),
    ]));
  });
});
