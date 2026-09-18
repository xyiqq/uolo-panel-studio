import { describe, it, expect } from "vitest";
import {
  createDefaultDesign,
  buildAssembly,
  buildWiring,
  matchCircuit,
} from "../../src/core/domain.js";
import { renderSystemDiagram } from "../../src/view/system-diagram.js";

describe("system-diagram · 系统图", () => {
  const design = createDefaultDesign();
  const assembly = buildAssembly(design);
  const net = buildWiring(design, assembly);
  const matches = Object.fromEntries(
    design.circuits.map((c) => [c.id, matchCircuit(design, c)]),
  );
  const { pages } = renderSystemDiagram(design, assembly, net, matches);

  it("默认方案 SVG 含 data-circuit 且页数≥1，无 undefined 字样", () => {
    expect(pages.length).toBeGreaterThanOrEqual(1);
    const joined = pages.join("\n");
    expect(joined).toContain('data-circuit="');
    const circuitAttrs = joined.match(/data-circuit="/g) || [];
    expect(circuitAttrs.length).toBeGreaterThan(1);
    expect(joined).not.toContain("undefined");
  });
});
