import { describe, it, expect } from "vitest";
import {
  createDefaultDesign,
  buildAssembly,
  buildWiring,
  auditDesign,
  auditWiring,
} from "../../src/core/domain.js";
import { buildBom } from "../../src/core/bom.js";
import { applyLabelRules } from "../../src/core/labels.js";
import { buildDocumentPack } from "../../src/view/documents/index.js";
import {
  buildHandoverFiles,
  circuitRows,
  wireRows,
  bomRows,
  toCsv,
} from "../../src/core/handover.js";

describe("handover · 交底包文件集", () => {
  const design = createDefaultDesign();
  design.uiMode = "full";
  const assembly = buildAssembly(design);
  const net = buildWiring(design, assembly);
  const issues = [...auditDesign(design, assembly), ...auditWiring(net, design)];
  const bom = buildBom(design, assembly, net);
  const labels = applyLabelRules(design, net);
  const pack = buildDocumentPack({
    design,
    assembly,
    net,
    issues,
    bom,
    labels,
    matches: {},
    uiMode: "full",
  });

  it("回路 / 接线 / BOM 行数与数据一致", () => {
    expect(circuitRows(design, issues).length).toBe(design.circuits.length + 1);
    expect(wireRows(net, labels).length).toBe(net.wires.length + 1);
    expect(bomRows(bom).length).toBe(bom.items.length + bom.wires.length + 1);
  });

  it("接线行带两端标签", () => {
    const rows = wireRows(net, labels);
    const body = rows.slice(1);
    expect(body.every((r) => r[1] && r[3])).toBe(true);
  });

  it("CSV 带 BOM 头并转义公式前缀", () => {
    const csv = toCsv([["a"], ["=1+1"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\"'=1+1\"");
  });

  it("文件集含 README、方案、CSV 与各文档页", () => {
    design.uiMode = "full";
    const files = buildHandoverFiles({
      design,
      net,
      issues,
      bom,
      labels,
      pages: pack.pages,
      standaloneHtml: "<html></html>",
    });
    expect(files["README.txt"]).toContain("条件性方案");
    expect(files["方案.json"]).toBeTruthy();
    expect(files["通道清单.csv"]).toBeTruthy();
    expect(files["回路计算.csv"]).toBeTruthy();
    expect(files["端子接线表.csv"]).toBeTruthy();
    expect(files["物料清单.csv"]).toBeTruthy();
    expect(files["校核记录.json"]).toBeTruthy();
    expect(files["方案-独立HTML.html"]).toBe("<html></html>");
    const docNames = Object.keys(files).filter((n) => n.startsWith("文档/"));
    expect(docNames.length).toBe(pack.pages.length);
    expect(docNames.some((n) => n.endsWith(".svg"))).toBe(true);
  });

  it("简易布置交底包不含校核与回路计算表", () => {
    const simpleDesign = { ...design, uiMode: "simple" };
    const files = buildHandoverFiles({
      design: simpleDesign,
      net,
      issues,
      bom,
      labels,
      pages: pack.pages.filter((p) =>
        ["cover", "nameplate", "labels-sheet", "channel-list", "bom"].includes(p.id),
      ),
    });
    expect(files["通道清单.csv"]).toBeTruthy();
    expect(files["方案.json"]).toBeTruthy();
    expect(files["校核记录.json"]).toBeUndefined();
    expect(files["回路计算.csv"]).toBeUndefined();
    expect(files["端子接线表.csv"]).toBeUndefined();
  });
});
