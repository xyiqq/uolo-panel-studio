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

  it("每页含免责声明口径、页码与统一字体栈", () => {
    for (const [i, svg] of pages.entries()) {
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain("条件性方案 · 非施工合格结论");
      expect(svg).toContain(`第 ${i + 1} / ${pages.length} 页`);
      expect(svg).toContain("Microsoft YaHei");
      // 禁止误导性口径（注意免责短句本身包含“施工合格结论”子串，故查完整误导演进）
      expect(svg).not.toContain("符合施工");
      expect(svg).not.toContain("可直接施工");
      expect(svg).not.toContain("已验收");
    }
  });

  it("16 列分页行为不变，母排带相色与线型兜底", () => {
    expect(pages.length).toBe(Math.ceil(design.circuits.length / 16));
    expect(pages[0]).toContain('stroke-dasharray="3.5 1.6"'); // L2
    expect(pages[0]).toContain('stroke-dasharray="1.4 1.4"'); // L3
    expect(pages[0]).toContain("#429cdd"); // N
  });
});
