import { describe, expect, it } from 'vitest';
import { SMART_PRODUCTS } from '../../src/data/products/smart-index.js';
import { buildPortTemplates } from '../../src/core/ports.js';
import { computeBusBudgets } from '../../src/core/buses.js';
import { psuConnectionType } from '../../src/core/psu-connections.js';

const product = id => SMART_PRODUCTS.find(item => item.id === id);

describe('P1 厂家资料与未知参数边界', () => {
  it.each([2, 4])('USMART %s 路接口采用实物确认的 24V，未知额定仍留空', count => {
    const item = product(`usmart-din-tcp-${count}rs485`);
    expect(item).toMatchObject({ powerInput: '24vdc', loadPowerInput: null, psuOutput: null, busConsumption: null, ethernetPorts: 1, serialPorts: count });
    const portKeys = buildPortTemplates(item).map(port => port.key);
    expect(portKeys).toEqual(expect.arrayContaining(['DC+', 'DC-']));
    expect(portKeys.some(key => ['L_IN', 'N_IN', 'LAN'].includes(key))).toBe(false);
    expect(item.source.file).toContain('用户提供实物照片');
    expect(item.source.url).toBeNull();
  });

  it.each([1, 2])('HQP7-%s 使用含端子的尺寸、控制直流输入，不误生市电或负载端子', links => {
    const item = product(`lutron-hqp7-${links}`);
    expect(item).toMatchObject({ width: 108, height: 100, depth: 60.5, modules: 6, powerInput: '24vdc', loadPowerInput: null, busConsumption: null });
    expect(item.source.url).toContain('3691127_ENG.pdf');
    expect(buildPortTemplates(item).filter(port => port.key.startsWith('DC')).map(port => port.key)).toEqual(['DC+', 'DC-']);
    expect(buildPortTemplates(item).some(port => ['L_IN', 'N_IN'].includes(port.key) || port.key.startsWith('CH'))).toBe(false);
  });

  it('新完整型号不擅自替换历史系列占位和旧尺寸', () => {
    expect(product('lutron-hqp7')).toMatchObject({ width: 216, modules: 12, powerInput: null });
    expect(product('lutron-qs-link-psu')).toMatchObject({ width: 108, modules: 6, psuOutput: null });
    expect(product('lutron-qsps-dh-1-75')).toMatchObject({ width: 90, height: 90, depth: 61, psuOutput: { voltage: 24, amps: 2.5 } });
    expect(product('lutron-qsps-dh-1-75').psuOutput.watts).toBeUndefined();
  });

  it('将 HQP7 配套的 -H 电源按自身规格单独建档', () => {
    const psu = product('lutron-qsps-dh-1-75-h');
    expect(psu).toMatchObject({
      sku: 'QSPS-DH-1-75-H', width: 90, height: 90, depth: 61, modules: 5,
      powerInput: 'LN',
    });
    expect(psu.psuOutput).toEqual({ voltage: 24, amps: 2.5 });
    expect(psu.source.file).toContain('369885d');
    expect(psuConnectionType(psu)).toBe('dc');
    const powerPlan = {
      modules: [{ id: 'PS1', productId: psu.id }],
      buses: [{ id: 'DC1', type: 'dc', psuModuleIds: ['PS1'], deviceModuleIds: [] }],
    };
    expect(computeBusBudgets(powerPlan, SMART_PRODUCTS)[0]).toMatchObject({ capacity: 60, unit: 'W' });
  });

  it('DALI PS2 的 240mA 进入总线预算，4.7W 输入不冒充输出', () => {
    const psu = product('tridonic-dali-ps2');
    expect(psu.psuOutput).toEqual({ voltage: 13.5, amps: 0.24 });
    expect(psuConnectionType(psu)).toBe('dali');
    const device = { id: 'test-dali-device', kind: 'gateway', protocol: ['dali'], busConsumption: { value: 250, unit: 'mA' } };
    const [budget] = computeBusBudgets({ modules: [{ id: 'PS1', productId: psu.id }, { id: 'D1', productId: device.id }], buses: [{ id: 'B1', type: 'dali', psuModuleIds: ['PS1'], deviceModuleIds: ['D1'] }] }, [...SMART_PRODUCTS, device]);
    expect(budget).toMatchObject({ capacity: 240, used: 250, unit: 'mA', overBudget: true });
  });
});
