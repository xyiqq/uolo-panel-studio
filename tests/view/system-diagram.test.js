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

  it("A4 纵向按可读字号分页，每页最多四个回路且没有丢失回路", () => {
    expect(pages.length).toBeGreaterThanOrEqual(Math.ceil(design.circuits.length / 4));
    const joined = pages.join('');
    for (const circuit of design.circuits) expect(joined).toContain(`data-circuit="${circuit.id}"`);
    for (const page of pages) {
      expect(page).toContain('viewBox="0 0 210 270"');
      expect((page.match(/data-circuit=/g) || []).length).toBeLessThanOrEqual(4);
      if (page.includes('data-circuit=')) expect(page).toContain('怎么看');
      expect(page).toContain('font-size="3.5"');
    }
    expect(joined).toContain('stroke-dasharray="3.5 1.6"'); // L2
    expect(joined).toContain('stroke-dasharray="1.4 1.4"'); // L3
    expect(joined).toContain("#429cdd"); // N
  });

  it('超长模块信息分段分页，最后的内容仍保留且卡片不超过页底', () => {
    const longDesign = {circuits:[{id:'C1', name:'测试回路', path:'很长的安装路径'.repeat(200) + '最终标记'}]};
    const result = renderSystemDiagram(longDesign,{nodes:[]},{}).pages;
    expect(result.length).toBeGreaterThan(1);
    expect(result.join('').replace(/<[^>]*>/g,'')).toContain('最终标记');
    for (const page of result) {
      for (const match of page.matchAll(/<rect x="(?:10|108)" y="([\d.]+)" width="92" height="([\d.]+)"/g)) {
        expect(Number(match[1]) + Number(match[2])).toBeLessThanOrEqual(253);
      }
    }
  });

  it('保留实际上下游与断开状态，未生成接线时不猜测来源', () => {
    const design = {circuits:[{id:'C1',name:'照明'}]};
    const net = {wires:[
      {from:'SERVICE:L1',to:'Q0:L1_IN',conductor:'L1',connected:true,scope:'入户电缆'},
      {from:'BUS:L1-C1',to:'C1:L1_IN',circuit:'C1',conductor:'L1',connected:false},
      {from:'C1:L1_OUT',to:'X-C1:L1',circuit:'C1',conductor:'L1',connected:true},
      {from:'PE:PE-C1',to:'X-C1:PE',circuit:'C1',conductor:'PE',connected:true},
    ]};
    const joined = renderSystemDiagram(design,{nodes:[]},net).pages.join('').replace(/<[^>]*>/g,'');
    expect(joined).toContain('BUS:L1-C1 → C1:L1_IN（断开）');
    expect(joined).toContain('C1:L1_OUT → X-C1:L1');
    expect(joined).toContain('SERVICE:L1');
    expect(joined).toContain('Q0:L1_IN');
    expect(joined).toContain('非标准电气原理图');
    expect(renderSystemDiagram(design,{nodes:[]},{}).pages.join('')).toContain('未生成接线');
  });
});
