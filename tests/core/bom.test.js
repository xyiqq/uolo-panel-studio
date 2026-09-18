import { describe, it, expect } from "vitest";
import {
  createDefaultDesign,
  buildAssembly,
  buildWiring,
} from "../../src/core/domain.js";
import { buildBom } from "../../src/core/bom.js";

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
});
