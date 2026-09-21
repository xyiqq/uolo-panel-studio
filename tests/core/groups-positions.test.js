import { describe, it, expect } from "vitest";
import {
  createDefaultDesign,
  buildAssembly,
  validateDesign,
  allGroups,
  groupOf,
  circuitsByGroup,
  validateCustomGroup,
  nodePosition,
  OTHER_GROUP,
  clone,
} from "../../src/core/domain.js";

function withCustomGroup(design) {
  const d = clone(design);
  d.customGroups = [
    validateCustomGroup({ id: "USR-GRP-heat", name: "地暖", icon: "thermometer" }),
  ];
  d.circuits[0].group = "USR-GRP-heat";
  return d;
}

describe("自定义逻辑分区", () => {
  const base = createDefaultDesign();

  it("校验：id/名称不合法时拒绝", () => {
    expect(() => validateCustomGroup({ id: "heat", name: "地暖" })).toThrow();
    expect(() => validateCustomGroup({ id: "USR-GRP-x", name: "" })).toThrow();
    expect(() => validateCustomGroup({ id: "USR-GRP-x", name: "名".repeat(21) })).toThrow();
    expect(() => validateCustomGroup({ id: "USR-GRP-x", name: " 地暖 " }).name).not.toThrow;
    expect(validateCustomGroup({ id: "USR-GRP-x", name: " 地暖 " }).name).toBe("地暖");
  });

  it("内置分区不可被自定义分区顶替", () => {
    expect(() => validateCustomGroup({ id: "lighting", name: "照明" })).toThrow();
  });

  it("allGroups = 内置 + 自定义；分区下的回路能装配", () => {
    const d = withCustomGroup(base);
    expect(allGroups(d).length).toBe(allGroups(base).length + 1);
    expect(groupOf(d, "USR-GRP-heat").name).toBe("地暖");
    const asm = buildAssembly(d);
    expect(asm.nodes.some((n) => n.id === d.circuits[0].id)).toBe(true);
    expect(asm.nodes.length).toBe(buildAssembly(base).nodes.length);
  });

  it("未知分区的回路落入「其它」而不是消失", () => {
    const d = clone(base);
    d.circuits[0].group = "ghost-group";
    const buckets = circuitsByGroup(d);
    const other = buckets.find((b) => b.group.id === OTHER_GROUP.id);
    expect(other?.circuits.map((c) => c.id)).toContain(d.circuits[0].id);
    const asm = buildAssembly(d);
    expect(asm.nodes.some((n) => n.id === d.circuits[0].id)).toBe(true);
  });

  it("方案校验保留自定义分区", () => {
    const d = validateDesign(withCustomGroup(base));
    expect(d.customGroups[0].id).toBe("USR-GRP-heat");
  });
});

describe("器件固定位置", () => {
  const base = createDefaultDesign();

  it("positions 可以钉住任意节点（含总开）", () => {
    const d = clone(base);
    d.positions = { Q0: { row: 2, slot: 5 } };
    const asm = buildAssembly(d);
    const q0 = asm.nodes.find((n) => n.id === "Q0");
    expect([q0.row, q0.slot]).toEqual([2, 5]);
    expect(q0.pinned).toBe(true);
  });

  it("旧的 circuit.position 仍然有效", () => {
    const d = clone(base);
    const c = d.circuits[0];
    c.position = { row: 3, slot: 0 };
    const asm = buildAssembly(d);
    const node = asm.nodes.find((n) => n.id === c.id);
    expect([node.row, node.slot]).toEqual([3, 0]);
    expect(nodePosition(d, c.id, c)).toEqual({ row: 3, slot: 0 });
  });

  it("positions 优先于旧字段", () => {
    const d = clone(base);
    const c = d.circuits[0];
    c.position = { row: 3, slot: 0 };
    d.positions = { [c.id]: { row: 1, slot: 2 } };
    expect(nodePosition(d, c.id, c)).toEqual({ row: 1, slot: 2 });
  });

  it("超出箱体范围的固定位置在校验时被丢弃", () => {
    const d = clone(base);
    d.positions = { Q0: { row: 99, slot: 0 }, SPD: { row: 1, slot: 1 } };
    const out = validateDesign(d);
    expect(out.positions.Q0).toBeUndefined();
    expect(out.positions.SPD).toEqual({ row: 1, slot: 1 });
  });

  it("不设位置时排布与黄金基线一致", () => {
    const a = buildAssembly(base);
    const b = buildAssembly(validateDesign(clone(base)));
    expect(b.nodes.map((n) => [n.id, n.row, n.slot])).toEqual(
      a.nodes.map((n) => [n.id, n.row, n.slot]),
    );
  });
});
