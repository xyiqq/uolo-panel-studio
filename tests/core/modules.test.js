import { describe, it, expect } from "vitest";
import { createDefaultDesign, buildAssembly, validateDesign, findProduct } from "../../src/core/domain.js";
import {
  nextModuleId,
  emptyChannels,
  normalizeModule,
  syncCircuitDevices,
  releaseCircuitFromModules,
  removeModule,
  normalizeProtectGroups,
  setModuleProtect,
  buildChannelRows,
  channelRowsToCsv,
  buildProtectLinkSchematic,
} from "../../src/core/modules.js";

describe("P1-4 shared modules", () => {
  it("nextModuleId 按 kind 前缀递增", () => {
    const d = { modules: [{ id: "K1" }, { id: "K2" }] };
    expect(nextModuleId(d, "relay")).toBe("K3");
    expect(nextModuleId({ modules: [] }, "dimmer")).toBe("D1");
    expect(nextModuleId({ modules: [] }, "psu")).toBe("PS1");
  });

  it("4 路继电器分配 4 回路后装配仅 1 个 K1 节点", () => {
    const design = createDefaultDesign();
    const product = findProduct(design, "crestron-din-4dimu4") || findProduct(design, "crestron-din-8sw8-i");
    expect(product).toBeTruthy();
    const channels = emptyChannels(4);
    const ids = design.circuits.slice(0, 4).map((c) => c.id);
    ids.forEach((cid, i) => {
      channels[i + 1] = cid;
    });
    design.modules = [
      normalizeModule(
        {
          id: "K1",
          productId: product.id,
          label: "K1 测试继电器",
          busId: null,
          feed: "shared",
          feedCircuitId: ids[0],
          channels,
          position: null,
        },
        product
      ),
    ];
    syncCircuitDevices(design, (id) => findProduct(design, id));
    const asm = buildAssembly(design);
    const moduleNodes = asm.nodes.filter((n) => n.role === "module");
    expect(moduleNodes).toHaveLength(1);
    expect(moduleNodes[0].id).toBe("K1");
    for (const cid of ids) {
      const c = design.circuits.find((x) => x.id === cid);
      expect(c.devices.some((d) => d.role === "control" && d.moduleId === "K1")).toBe(true);
    }
  });

  it("删除回路释放通道", () => {
    const design = createDefaultDesign();
    const product = findProduct(design, "crestron-din-8sw8-i");
    design.modules = [
      normalizeModule(
        {
          id: "K1",
          productId: product.id,
          label: "K1",
          feed: "none",
          channels: { 1: "C01", 2: "C08", 3: null, 4: null, 5: null, 6: null, 7: null, 8: null },
        },
        product
      ),
    ];
    releaseCircuitFromModules(design, "C01");
    expect(design.modules[0].channels[1]).toBe(null);
    expect(design.modules[0].channels[2]).toBe("C08");
  });

  it("removeModule 清理 positions 与 devices", () => {
    const design = createDefaultDesign();
    const product = findProduct(design, "crestron-din-8sw8-i");
    design.modules = [
      normalizeModule(
        {
          id: "K1",
          productId: product.id,
          label: "K1",
          feed: "none",
          channels: emptyChannels(8, { 1: "C01" }),
        },
        product
      ),
    ];
    design.positions = { K1: { row: 0, slot: 0 } };
    syncCircuitDevices(design, (id) => findProduct(design, id));
    removeModule(design, "K1");
    expect(design.modules).toHaveLength(0);
    expect(design.positions.K1).toBeUndefined();
    const c01 = design.circuits.find((c) => c.id === "C01");
    expect(c01.devices.every((d) => d.moduleId !== "K1")).toBe(true);
  });

  it("validateDesign 归一化 modules/buses 且黄金装配模位数不变", () => {
    const design = validateDesign(createDefaultDesign());
    expect(Array.isArray(design.modules)).toBe(true);
    expect(Array.isArray(design.buses)).toBe(true);
    expect(Array.isArray(design.protectGroups)).toBe(true);
    expect(design.uiMode === "simple" || design.uiMode === "full").toBe(true);
    const asm = buildAssembly(design);
    expect(asm.modules).toBe(108);
    expect(asm.nodes.some((n) => n.role === "module")).toBe(false);
  });

  it("channelLabels 与 protectGroups 可挂载并导出 CSV", () => {
    const design = createDefaultDesign();
    const product = findProduct(design, "crestron-din-8sw8-i");
    design.modules = [
      normalizeModule(
        {
          id: "K1",
          productId: product.id,
          label: "一层继电器",
          feed: "none",
          channels: emptyChannels(8),
          channelLabels: { 1: "客厅灯", 2: "餐厅灯" },
          protectId: "C01",
        },
        product,
      ),
      normalizeModule(
        {
          id: "K2",
          productId: product.id,
          label: "二层继电器",
          feed: "none",
          channels: emptyChannels(8),
          channelLabels: { 1: "主卧灯" },
          protectId: "C01",
        },
        product,
      ),
    ];
    normalizeProtectGroups(design);
    expect(design.protectGroups).toHaveLength(1);
    expect(design.protectGroups[0].breakerNodeId).toBe("C01");
    expect(design.protectGroups[0].moduleIds.sort()).toEqual(["K1", "K2"]);

    setModuleProtect(design, "K2", "C02");
    expect(design.modules.find((m) => m.id === "K2").protectId).toBe("C02");
    expect(design.protectGroups.find((g) => g.breakerNodeId === "C01").moduleIds).toEqual(["K1"]);

    const rows = buildChannelRows(design, (id) => findProduct(design, id));
    expect(rows.some((r) => r.moduleId === "K1" && r.channel === 1 && r.label === "客厅灯")).toBe(true);
    const csv = channelRowsToCsv(rows);
    expect(csv).toContain("客厅灯");
    expect(csv).toContain("共用空开");

    const schematic = buildProtectLinkSchematic(design, {
      nodes: [
        { id: "C01", label: "C01 空开" },
        { id: "C02", label: "C02 空开" },
        { id: "K1", label: "一层继电器" },
        { id: "K2", label: "二层继电器" },
      ],
    });
    expect(schematic.some((g) => g.breakerNodeId === "C01" && g.modules.some((m) => m.id === "K1"))).toBe(
      true,
    );

    removeModule(design, "K1");
    expect(design.protectGroups.find((g) => g.breakerNodeId === "C01")?.moduleIds || []).not.toContain(
      "K1",
    );
  });
});
