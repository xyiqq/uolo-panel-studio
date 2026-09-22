import { describe, it, expect } from "vitest";
import { createDefaultDesign, validateDesign, findProduct, buildWiring, buildAssembly } from "../../src/core/domain.js";
import { PHOENIX_TERMINAL_PRODUCTS } from "../../src/data/products/terminal-phoenix.js";
import {
  normalizeModule,
  emptyChannels,
  emptyChannelLabels,
  linkChannelTerminal,
  buildChannelWireSchematic,
  buildChannelRows,
  compactModulePlacement,
} from "../../src/core/modules.js";

describe("菲尼克斯端子与零线排", () => {
  it("目录含灰/蓝 PT2.5 单极与排", () => {
    expect(PHOENIX_TERMINAL_PRODUCTS.some((p) => p.id === "phoenix-pt25-gy-1")).toBe(true);
    expect(PHOENIX_TERMINAL_PRODUCTS.some((p) => p.id === "phoenix-pt25-bu-1")).toBe(true);
    const gy4 = findProduct(createDefaultDesign(), "phoenix-pt25-gy-4");
    expect(gy4?.kind).toBe("terminal");
    expect(gy4?.poles).toBe(4);
    expect(gy4?.terminalColor).toBe("gray");
    const bu4 = findProduct(createDefaultDesign(), "phoenix-pt25-bu-4");
    expect(bu4?.poles).toBe(4);
    expect(bu4?.terminalColor).toBe("blue");
    const gy = findProduct(createDefaultDesign(), "phoenix-pt25-gy-8");
    expect(gy?.kind).toBe("terminal");
    expect(gy?.terminalColor).toBe("gray");
    expect(gy?.conductor).toBe("L");
    const bu = findProduct(createDefaultDesign(), "phoenix-pt25-bu-8");
    expect(bu?.terminalColor).toBe("blue");
    expect(bu?.conductor).toBe("N");
  });

  it("零线排默认最下横装，可改最上", () => {
    const bottom = validateDesign(createDefaultDesign());
    expect(bottom.nBarPosition).toBe("bottom");
    const n = buildWiring(bottom).nodes.find((x) => x.id === "N");
    expect(n.barOrient).toBe("horizontal");
    expect(n.y).toBeLessThan(0);

    const top = validateDesign({ ...createDefaultDesign(), nBarPosition: "top" });
    expect(top.nBarPosition).toBe("top");
    const nTop = buildWiring(top).nodes.find((x) => x.id === "N");
    expect(nTop.y).toBeGreaterThan(0);
  });

  it("灯线→端子→继电器路径可关联", () => {
    const design = createDefaultDesign();
    const relay = findProduct(design, "crestron-din-8sw8-i");
    const term = findProduct(design, "phoenix-pt25-gy-1");
    design.modules = [
      normalizeModule(
        {
          id: "K1",
          productId: relay.id,
          label: "继电器",
          feed: "none",
          channels: emptyChannels(8),
          channelLabels: emptyChannelLabels(8, { 1: "客厅灯" }),
        },
        relay,
      ),
      normalizeModule(
        {
          id: "T1",
          productId: term.id,
          label: "客厅灯端子",
          feed: "none",
          channels: emptyChannels(1),
          channelLabels: emptyChannelLabels(1),
        },
        term,
      ),
    ];
    linkChannelTerminal(design, "K1", 1, "T1");
    expect(design.modules[0].channelTerminals[1]).toBe("T1");
    expect(design.modules[1].linkModuleId).toBe("K1");
    const paths = buildChannelWireSchematic(design, (id) => findProduct(design, id));
    expect(paths[0].path).toContain("灯线 → T1 → K1·CH1");
    const rows = buildChannelRows(design, (id) => findProduct(design, id));
    expect(rows.some((r) => r.moduleId === "K1" && r.terminal === "T1")).toBe(true);
    expect(rows.every((r) => r.moduleId !== "T1")).toBe(true);
  });
});


it("智能模块与端子自动排布优先利用真实剩余空间", () => {
  const design = createDefaultDesign({ includeMain: false, includeSpd: false, modules: [] });
  const relay8 = findProduct(design, "crestron-din-8sw8-i");
  const relay4 = findProduct(design, "crestron-din-4dimflv4");
  const blue = findProduct(design, "phoenix-pt25-bu-4");
  design.modules = [
    normalizeModule({ id: "K1", productId: relay8.id, label: "8路继电器", channels: emptyChannels(8), channelLabels: emptyChannelLabels(8) }, relay8),
    normalizeModule({ id: "T1", productId: blue.id, label: "K1后端子", channels: emptyChannels(4), channelLabels: emptyChannelLabels(4) }, blue),
    normalizeModule({ id: "K2", productId: relay4.id, label: "4路继电器", channels: emptyChannels(4), channelLabels: emptyChannelLabels(4) }, relay4),
    normalizeModule({ id: "T2", productId: blue.id, label: "K2后端子", channels: emptyChannels(4), channelLabels: emptyChannelLabels(4) }, blue),
  ];
  const assembly = compactModulePlacement(buildAssembly(design), design);
  const node = (id) => assembly.nodes.find((item) => item.id === id);
  expect(node("T1").slot).toBe(node("K1").slot + Math.ceil(relay8.width / 18));
  expect(node("T1").row).toBe(node("K1").row);
  expect(node("T2").row).toBe(node("T1").row);
  expect(node("T2").x-node("T2").product.width/2).toBeCloseTo(node("T1").x+node("T1").product.width/2);
  expect(node("K2").row).toBeGreaterThan(node("T2").row);
});





it("连续端子按真实宽度贴合", () => {
  const design = createDefaultDesign({ includeMain: false, includeSpd: false, modules: [] });
  const gray = findProduct(design, "phoenix-pt25-gy-4");
  const blue1 = findProduct(design, "phoenix-pt25-bu-1");
  design.modules = [
    normalizeModule({ id: "T3", productId: gray.id, channels: emptyChannels(4), channelLabels: emptyChannelLabels(4) }, gray),
    normalizeModule({ id: "T4", productId: blue1.id, channels: emptyChannels(1), channelLabels: emptyChannelLabels(1) }, blue1),
  ];
  const assembly = compactModulePlacement(buildAssembly(design), design);
  const a = assembly.nodes.find((n) => n.id === "T3");
  const b = assembly.nodes.find((n) => n.id === "T4");
  expect(b.row).toBe(a.row);
  expect(b.x).toBeCloseTo(a.x + a.product.width / 2 + b.product.width / 2, 8);
});


it("冲突位置自动避让，端子不覆盖继电器", () => {
  const design = createDefaultDesign({ includeMain: false, includeSpd: false, modules: [] });
  const relay = findProduct(design, "crestron-din-8sw8-i");
  const blue = findProduct(design, "phoenix-pt25-bu-4");
  design.modules = [
    normalizeModule({ id: "K9", productId: relay.id, position: { row: 4, slot: 12 }, channels: emptyChannels(8), channelLabels: emptyChannelLabels(8) }, relay),
    normalizeModule({ id: "T9", productId: blue.id, position: { row: 4, slot: 12 }, channels: emptyChannels(4), channelLabels: emptyChannelLabels(4) }, blue),
  ];
  const assembly = compactModulePlacement(buildAssembly(design), design);
  const relayNode = assembly.nodes.find((n) => n.id === "K9");
  const terminalNode = assembly.nodes.find((n) => n.id === "T9");
  expect(terminalNode.overflow).not.toBe(true);
  expect(terminalNode.placementError).not.toBe(true);
  expect(terminalNode.slot).toBeGreaterThanOrEqual(relayNode.slot + Math.ceil(relay.width / 18));
});


it("手动固定端子排时保留用户选择的排", () => {
  const design = createDefaultDesign({ includeMain: false, includeSpd: false, modules: [] });
  const relay = findProduct(design, "crestron-din-8sw8-i");
  const blue = findProduct(design, "phoenix-pt25-bu-4");
  design.modules = [
    normalizeModule({ id: "K7", productId: relay.id, position: { row: 4, slot: 12 }, channels: emptyChannels(8), channelLabels: emptyChannelLabels(8) }, relay),
    normalizeModule({ id: "T7", productId: blue.id, position: { row: 3, slot: 12 }, channels: emptyChannels(4), channelLabels: emptyChannelLabels(4) }, blue),
  ];
  const assembly = compactModulePlacement(buildAssembly(design), design);
  const terminalNode = assembly.nodes.find((n) => n.id === "T7");
  expect(terminalNode.row).toBe(3);
  expect(terminalNode.pinned).toBe(true);
});

it("先装自动端子再装继电器时不抢占端子位置", () => {
  const design = createDefaultDesign({ includeMain: false, includeSpd: false, modules: [] });
  const relay = findProduct(design, "tuya-relay-4ch");
  const terminal = findProduct(design, "phoenix-pt25-bu-4");
  design.modules = [
    normalizeModule({ id: "T8", productId: terminal.id, label: "已有端子", channels: emptyChannels(4), channelLabels: emptyChannelLabels(4) }, terminal),
    normalizeModule({ id: "K8", productId: relay.id, label: "后添加继电器", channels: emptyChannels(4), channelLabels: emptyChannelLabels(4) }, relay),
  ];
  const assembly = compactModulePlacement(buildAssembly(design), design);
  const terminalNode = assembly.nodes.find((n) => n.id === "T8");
  const relayNode = assembly.nodes.find((n) => n.id === "K8");
  expect(relayNode.row).toBe(terminalNode.row);
  expect(relayNode.slot).toBeGreaterThanOrEqual(
    terminalNode.slot + Math.ceil(terminal.width / 18),
  );
});
