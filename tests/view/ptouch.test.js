import { describe, it, expect } from "vitest";
import {
  createDefaultDesign,
  buildAssembly,
  buildWiring,
  matchCircuit,
} from "../../src/core/domain.js";
import { applyLabelRules } from "../../src/core/labels.js";
import {
  buildPtouchRows,
  ptouchCsv,
  renderFaceLabelsSvg,
} from "../../src/view/documents/ptouch.js";

describe("ptouch · 标签数据与面标 SVG", () => {
  const design = createDefaultDesign();
  const assembly = buildAssembly(design);
  const net = buildWiring(design, assembly);
  const labels = applyLabelRules(design, net);
  const matches = Object.fromEntries(
    design.circuits.map((c) => [c.id, matchCircuit(design, c)]),
  );
  const ctx = { design, assembly, labels, matches };

  it("每回路一行，列为 label/line1/line2/qr", () => {
    const rows = buildPtouchRows(ctx);
    expect(rows[0]).toEqual(["label", "line1", "line2", "qr"]);
    expect(rows.length).toBe(design.circuits.length + 1);
    expect(rows[1][3]).toBe("");
    expect(rows[1][2]).toMatch(/A$/);
  });

  it("项目网页未配置时不生成纯文本或无效二维码", () => {
    const d2 = { ...design, labelRules: { qrMode: "online" }, publicBaseUrl: null };
    const rows = buildPtouchRows({ ...ctx, design: d2 });
    expect(rows[1][3]).toBe("");
    expect(rows[1][3]).not.toContain("http");
  });

  it("在线模式填了项目网页才生成链接", () => {
    const d3 = {
      ...design,
      labelRules: { qrMode: "online" },
      qrProjectUrl: "https://example.com/projects/abc",
      designId: "abc",
    };
    const rows = buildPtouchRows({ ...ctx, design: d3 });
    expect(rows[1][3]).toBe("https://example.com/projects/abc?c=C01");
  });

  it("CSV 带 BOM 与 CRLF", () => {
    const csv = ptouchCsv(buildPtouchRows(ctx));
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
  });

  it("面标 SVG 覆盖全部回路且无 undefined", () => {
    const svg = renderFaceLabelsSvg(ctx);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain("undefined");
    const count = (svg.match(/data-circuit=/g) || []).length;
    expect(count).toBe(design.circuits.length);
  });
});
