import { describe, expect, it } from "vitest";
import { compactModulePlacement } from "../../src/core/modules.js";

function node(id, kind, row, slot, { pinned = false, width = 18, modules = width / 18, linkModuleId = null } = {}) {
  return { id, role: "module", module: { id, linkModuleId }, product: { kind, width, modules }, row, slot, pinned };
}

function place(nodes, blockers = [], slots = 12) {
  const occupied = Array.from({ length: 3 }, () => Array(slots).fill(null));
  for (const item of [...nodes, ...blockers]) {
    for (let offset = 0; offset < Math.ceil(item.product.modules); offset++) occupied[item.row][item.slot + offset] = item.id;
  }
  return compactModulePlacement({ nodes, occupied, box: { rows: 3, slots, height: 600, topRail: 60, pitch: 150 } }, { modules: nodes.map((item) => item.module) });
}

describe("PT2.5 automatic placement", () => {
  it.each([null, "K1"])("starts on the first row regardless of the relay link %s", (linkModuleId) => {
    const relay = node("K1", "relay", 2, 3, { pinned: true, width: 72 });
    const terminal = node("T1", "terminal", 2, 7, { width: 20.8, linkModuleId });
    place([relay, terminal]);
    expect(terminal).toMatchObject({ row: 0, slot: 0, overflow: false });
    expect(relay).toMatchObject({ row: 2, slot: 3, pinned: true });
  });

  it("fills an earlier free gap instead of following an automatic relay", () => {
    const relay = node("K1", "relay", 1, 0, { width: 144 });
    const terminal = node("T1", "terminal", 1, 8, { width: 20.8, linkModuleId: "K1" });
    place([relay, terminal], [node("C1", "breaker", 0, 2, { width: 180 })]);
    expect(relay.row).toBe(1);
    expect(terminal).toMatchObject({ row: 0, slot: 0 });
  });

  it("uses the first available position even when the terminal is the only module", () => {
    const terminal = node("T1", "terminal", 2, 0, { width: 5.2 });
    const assembly = place([terminal], [node("C1", "breaker", 0, 0, { width: 36 })]);
    expect(terminal).toMatchObject({ row: 0, slot: 2 });
    expect(assembly.occupied[2][0]).toBeNull();
    expect(assembly.occupied[0][2]).toBe("T1");
  });

  it("preserves the exact slot and coordinates of a pinned terminal", () => {
    const first = node("T1", "terminal", 0, 0, { width: 5.2 });
    const pinned = node("T2", "terminal", 0, 5, { pinned: true, width: 5.2 });
    place([first, pinned]);
    expect(pinned).toMatchObject({ row: 0, slot: 5, pinned: true });
    expect(pinned.x).toBeCloseTo((5 - 6) * 18 + 2.6);
  });

  it("packs adjacent terminals without crossing an intervening breaker", () => {
    const first = node("T1", "terminal", 0, 0, { width: 5.2 });
    const second = node("T2", "terminal", 0, 2, { width: 5.2 });
    place([first, second], [node("C1", "breaker", 0, 1)]);
    expect(second.slot).toBe(2);
    expect(second.x).toBeCloseTo((2 - 6) * 18 + 2.6);
  });

  it("keeps adjacent automatic terminals touching at their real widths", () => {
    const first = node("T1", "terminal", 0, 0, { width: 20.8 });
    const second = node("T2", "terminal", 0, 2, { width: 5.2 });
    place([first, second]);
    expect(second.x - first.x).toBeCloseTo((20.8 + 5.2) / 2);
  });

  it("packs successive pinned gray groups and blue terminals while keeping their slot reservations", () => {
    const terminals = [
      node("T1", "terminal", 0, 1, { pinned: true, width: 41.6 }),
      node("T2", "terminal", 0, 4, { pinned: true, width: 5.2 }),
      node("T3", "terminal", 0, 5, { pinned: true, width: 41.6 }),
      node("T4", "terminal", 0, 8, { pinned: true, width: 5.2 }),
    ];
    const assembly = place(terminals);
    expect(terminals[0].x).toBeCloseTo((1 - 6) * 18 + 41.6 / 2);
    for (let i = 1; i < terminals.length; i++) {
      const previous = terminals[i - 1], current = terminals[i];
      expect(current.x - current.product.width / 2).toBeCloseTo(previous.x + previous.product.width / 2);
      expect(current.pinned).toBe(true);
      expect(assembly.occupied[0][current.slot]).toBe(current.id);
    }
    expect(terminals.map((terminal) => terminal.slot)).toEqual([1, 4, 5, 8]);
  });

  it("starts a separate pinned terminal run after a reserved empty slot", () => {
    const terminals = [
      node("T1", "terminal", 0, 0, { pinned: true, width: 5.2 }),
      node("T2", "terminal", 0, 2, { pinned: true, width: 5.2 }),
      node("T3", "terminal", 0, 3, { pinned: true, width: 5.2 }),
    ];
    place(terminals);
    expect(terminals[1].x).toBeCloseTo((2 - 6) * 18 + 2.6);
    expect(terminals[2].x - terminals[1].x).toBeCloseTo(5.2);
  });

  it("does not pull pinned terminals across a non-terminal module or between rows", () => {
    const first = node("T1", "terminal", 0, 0, { pinned: true, width: 5.2 });
    const relay = node("K1", "relay", 0, 1, { pinned: true, width: 18 });
    const second = node("T2", "terminal", 0, 2, { pinned: true, width: 5.2 });
    const third = node("T3", "terminal", 1, 3, { pinned: true, width: 5.2 });
    place([first, relay, second, third]);
    expect(second.x).toBeCloseTo((2 - 6) * 18 + 2.6);
    expect(third.x).toBeCloseTo((3 - 6) * 18 + 2.6);
  });
});

describe("physical module adjacency", () => {
  it.each([false, true])("packs consecutive 159 mm / 9M relays with pinned=%s", (pinned) => {
    const modules = [0, 9, 18].map((slot, index) => node(`K${index + 1}`, "relay", 0, slot, { pinned, width: 159, modules: 9 }));
    const assembly = place(modules, [], 36);
    expect(modules[0].x - 159 / 2).toBe(-324);
    for (let i = 1; i < modules.length; i++) {
      expect(modules[i].x - 159 / 2).toBeCloseTo(modules[i - 1].x + 159 / 2);
      expect(modules[i].slot).toBe(i * 9);
      expect(assembly.occupied[0].slice(i * 9, i * 9 + 9)).toEqual(Array(9).fill(modules[i].id));
    }
    compactModulePlacement(assembly, { modules: modules.map((item) => item.module) });
    expect(modules[2].x - modules[0].x).toBeCloseTo(318);
  });

  it("packs a 216 mm dimmer and 159 mm relays into the same physical run", () => {
    const modules = [
      node("D1", "dimmer", 0, 0, { pinned: true, width: 216, modules: 12 }),
      node("K1", "relay", 0, 12, { pinned: true, width: 159, modules: 9 }),
      node("K2", "relay", 0, 21, { pinned: true, width: 159, modules: 9 }),
    ];
    place(modules, [], 36);
    for (let i = 1; i < modules.length; i++) {
      expect(modules[i].x - modules[i].product.width / 2).toBeCloseTo(modules[i - 1].x + modules[i - 1].product.width / 2);
    }
  });

  it.each([false, true])("preserves an intervening slot, occupied by a breaker=%s", (withBreaker) => {
    const modules = [
      node("K1", "relay", 0, 0, { pinned: true, width: 159, modules: 9 }),
      node("K2", "relay", 0, 10, { pinned: true, width: 159, modules: 9 }),
      node("K3", "relay", 0, 19, { pinned: true, width: 159, modules: 9 }),
    ];
    place(modules, withBreaker ? [node("C1", "breaker", 0, 9)] : [], 36);
    expect(modules[1].x - 159 / 2).toBeCloseTo((10 - 18) * 18);
    expect(modules[1].x - 159 / 2 - (modules[0].x + 159 / 2)).toBeCloseTo(21);
    expect(modules[2].x - modules[1].x).toBeCloseTo(159);
  });

  it("keeps terminals and different rows outside the relay run", () => {
    const modules = [
      node("K1", "relay", 0, 0, { pinned: true, width: 159, modules: 9 }),
      node("T1", "terminal", 0, 9, { pinned: true, width: 5.2 }),
      node("K2", "relay", 0, 10, { pinned: true, width: 159, modules: 9 }),
      node("K3", "relay", 1, 19, { pinned: true, width: 159, modules: 9 }),
    ];
    place(modules, [], 36);
    expect(modules[1].x - 5.2 / 2).toBeCloseTo((9 - 18) * 18);
    expect(modules[2].x - 159 / 2).toBeCloseTo((10 - 18) * 18);
    expect(modules[3].x - 159 / 2).toBeCloseTo((19 - 18) * 18);
  });
});
