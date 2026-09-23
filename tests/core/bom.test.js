import { describe, it, expect } from "vitest";
import {
  createDefaultDesign,
  buildAssembly,
  buildWiring,
  validateDesign,
} from "../../src/core/domain.js";
import { buildBom } from "../../src/core/bom.js";
import { compactModulePlacement } from "../../src/core/modules.js";
import { createBlankDesign } from "../../src/data/design-templates.js";

describe("bom · 物料与线材", () => {
  const design = createDefaultDesign();
  const assembly = buildAssembly(design);
  const net = buildWiring(design, assembly);
  const bom = buildBom(design, assembly, net);

  it("items.length>0 且 wires meters>0", () => {
    expect(bom.items.length).toBeGreaterThan(0);
    expect(bom.wires.length).toBeGreaterThan(0);
    const totalMeters = bom.wires.reduce((s, w) => s + Number(w.meters || 0), 0);
    expect(totalMeters).toBeGreaterThan(0);
  });

  it("紧排端子按实际宽度计算空白盖板，每排只计整 18mm 空位", () => {
    const d = validateDesign(createBlankDesign({ modules: Array.from({ length: 8 }, (_, i) => ({ id: `X${i + 1}`, productId: "phoenix-pt25-gy-1" })) }));
    const a = compactModulePlacement(buildAssembly(d), d);
    const blank = buildBom(d, a, buildWiring(d, a)).items.find((i) => i.sku === "BLANK-COVER").qty;
    const expected = Array.from({ length: a.box.rows }, (_, row) => {
      const used = a.occupied.footprints.filter((f) => f.row === row).reduce((s, f) => s + f.right - f.left, 0);
      return Math.floor((a.box.slots * 18 - used + 1e-6) / 18);
    }).reduce((s, n) => s + n, 0);
    expect(blank).toBe(expected);
    expect(blank).toBeGreaterThan(a.box.rows * a.box.slots - a.modules);
  });

  it("不同品牌的同型号分行统计", () => {
    const a = { nodes: [{ id: "A", product: { id: "p1", sku: "X-1", name: "甲", brand: "A 牌" } }, { id: "B", product: { id: "p2", sku: "X-1", name: "乙", brand: "B 牌" } }], box: null };
    const items = buildBom({ circuits: [] }, a, { ports: {}, wires: [] }).items.filter((i) => i.sku === "X-1");
    expect(items.map((i) => i.brand)).toEqual(["A 牌", "B 牌"]);
  });
});
