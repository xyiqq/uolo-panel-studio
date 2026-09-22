import { describe, expect, it } from 'vitest';
import { CRESTRON_PRODUCTS } from '../../src/data/products/smart-crestron.js';
import { normalizeModule } from '../../src/core/modules.js';
import { buildPortTemplates } from '../../src/core/ports.js';
import { outputOptions } from '../../src/core/terminal-connections.js';
import { computeBusBudgets } from '../../src/core/buses.js';

const product = sku => CRESTRON_PRODUCTS.find(p => p.sku === sku);

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
    expect(buildPortTemplates(p).filter(port => port.io === 'out').map(port => port.key))
      .toEqual(['CH1_OUT', 'CH2_OUT', 'CH3_OUT', 'CH4_OUT']);
    expect(outputOptions({ modules: [mod] }, () => p).map(option => option.value))
      .toEqual(['D1:CH1_OUT', 'D1:CH2_OUT', 'D1:CH3_OUT', 'D1:CH4_OUT']);
  });

  it.each(['DIN-AP4', 'DIN-DALI-2', 'DIN-DLI'])('%s does not offer nonexistent mains input terminals', sku => {
    expect(buildPortTemplates(product(sku)).some(port => ['L_IN', 'N_IN'].includes(port.key))).toBe(false);
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

  it('retains the unverified historical model without claiming official verification', () => {
    const legacy = product('DIN-4DIMU4');
    expect(legacy.id).toBe('crestron-din-4dimu4');
    expect(legacy.availability).toContain('未获官网核实');
    expect(normalizeModule({ id: 'D1', productId: legacy.id, channels: { 4: 'C4' } }, legacy).channels[4]).toBe('C4');
  });
});
