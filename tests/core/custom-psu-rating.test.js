import { describe, it, expect } from 'vitest';
import { normalizeCustomElectrical } from '../../src/core/custom-product-electrical.js';
import { computeBusBudgets } from '../../src/core/bus-budget.js';

describe('custom PSU capacity limits', () => {
  it.each([
    { voltage: 24, amps: 1, watts: 100 },
    { voltage: 12, milliamps: 1000, watts: 24 },
    { voltage: 24, amps: 1, milliamps: 2000 },
  ])('rejects conflicting source ratings: %j', psuOutput => {
    expect(() => normalizeCustomElectrical({ kind: 'psu', psuOutput })).toThrow('PSU');
  });
  it('honors a lower manufacturer watt limit and flags excess consumption', () => {
    const fields = normalizeCustomElectrical({ kind: 'psu', psuOutput: { voltage: 24, amps: 1, watts: 20 } });
    const products = [{ id: 'psu', ...fields }, { id: 'load', busConsumption: { value: 21, unit: 'W' } }];
    const design = { modules: [{ id: 'P1', productId: 'psu' }, { id: 'G1', productId: 'load' }], buses: [{ id: 'B1', type: 'dc', budgetUnit: 'W', psuModuleIds: ['P1'], deviceModuleIds: ['G1'] }] };
    expect(computeBusBudgets(design, products)[0]).toMatchObject({ capacity: 20, used: 21, overBudget: true });
  });
  it('leaves a partial output rating unknown instead of filling a voltage', () => {
    expect(normalizeCustomElectrical({ kind: 'psu', psuOutput: { watts: 20 } }).psuOutput).toEqual({ watts: 20 });
  });
});
