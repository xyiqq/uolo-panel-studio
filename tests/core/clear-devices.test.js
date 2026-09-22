import { describe, it, expect } from 'vitest';
import { clearDevices } from '../../src/core/clear-devices.js';
import { createDefaultDesign, validateDesign, buildAssembly, buildWiring, unassignedLoads } from '../../src/core/domain.js';

describe('清空设备', () => {
  it('清空后可校验、重新载入，装配和接线不残留设备，源表保留', () => {
    const design = createDefaultDesign();
    const before = structuredClone(design);
    design.modules = [{ id: 'K1', productId: 'removed', channelTerminals: { 1: 'T1' } }];
    design.buses = [{ id: 'B1', deviceModuleIds: ['K1'] }];
    design.protectGroups = [{ id: 'P1', moduleIds: ['K1'], breakerNodeId: 'Q0' }];
    design.positions = { K1: { row: 0, slot: 1 } };
    design.connections = { 'K1:L': 'Q0:L1' };
    design.states = { Q0: false };
    design.wireOverrides = { old: 2.5 };
    design.disconnected = ['old'];
    clearDevices(design);
    const restored = validateDesign(JSON.parse(JSON.stringify(design)));
    expect(buildAssembly(restored).nodes).toEqual([]);
    const net = buildWiring(restored);
    expect(net.wires).toEqual([]);
    expect(net.nodes.some(n => ['neutral', 'earth', 'module', 'branch'].includes(n.role))).toBe(false);
    expect(restored.loads).toEqual(before.loads);
    expect(unassignedLoads(restored).length).toBeGreaterThan(0);
    for (const key of ['name', 'cabinet', 'supply', 'customProducts']) expect(restored[key]).toEqual(before[key]);
    expect(restored.buses).toEqual([]);
    expect(restored.protectGroups).toEqual([]);
    for (const key of ['connections', 'positions', 'states', 'wireOverrides']) expect(restored[key]).toEqual({});
    expect(restored.disconnected).toEqual([]);
  });

  it('重复清空结果不变，后续可重新装入设备', () => {
    const design = clearDevices(createDefaultDesign());
    const empty = structuredClone(design);
    clearDevices(design);
    expect(design).toEqual(empty);
    design.includeMain = true;
    expect(buildAssembly(validateDesign(design)).nodes.map(n => n.id)).toEqual(['Q0']);
  });
});
